import logging
from datetime import timezone as dt_timezone
from datetime import datetime

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from app.core.step_codes import STEP_CODES, index_by_canonical_step, normalize_step_code
from app.core.supabase_client import get_supabase
from app.agents.ai_services import classify_intent, evaluate_answer, get_socratic_hint

from .serializers import StepAnswerSubmitSerializer
from .services import get_session, get_rubric_id

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(dt_timezone.utc).isoformat()


class SessionViewSet(viewsets.ViewSet):
    """API quản lý Session — Supabase backend"""
    permission_classes = [IsAuthenticated]

    def list(self, request):
        """GET /api/v1/sessions/"""
        sb = get_supabase()
        user_id = request.user['id']
        status_filter = request.query_params.get('status')
        case_filter = request.query_params.get('case')

        query = sb.table('sessions').select(
            'id, case_id, current_step, status, final_score, started_at, completed_at'
        ).eq('user_id', user_id)

        if status_filter:
            query = query.eq('status', status_filter)
        if case_filter:
            query = query.eq('case_id', case_filter)

        result = query.order('started_at', desc=True).execute()
        return Response({'count': len(result.data), 'results': result.data})

    def create(self, request):
        """POST /api/v1/sessions/  Body: { "case_id": "<uuid>" }"""
        sb = get_supabase()
        user_id = request.user['id']
        case_id = request.data.get('case_id') or request.data.get('case')

        if not case_id:
            return Response({'error': 'case_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        result = sb.table('sessions').insert({
            'user_id': user_id,
            'case_id': case_id,
            'current_step': 0,
            'status': 'IN_PROGRESS',
        }).execute()

        session = result.data[0]

        try:
            case_result = sb.table('cases').select('title').eq('id', case_id).single().execute()
            session['case_title'] = case_result.data.get('title')
        except Exception:
            session['case_title'] = None

        return Response(session, status=status.HTTP_201_CREATED)

    def destroy(self, request, pk=None):
        """DELETE /api/v1/sessions/{id}/ — xóa session và toàn bộ step_attempts"""
        sb = get_supabase()
        session, err = get_session(sb, pk, request.user['id'])
        if err:
            return err

        if session['status'] == 'COMPLETED':
            return Response({'error': 'Không thể xóa session đã hoàn thành'}, status=status.HTTP_400_BAD_REQUEST)

        sb.table('step_attempts').delete().eq('session_id', pk).execute()
        sb.table('sessions').delete().eq('id', pk).execute()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def retrieve(self, request, pk=None):
        """GET /api/v1/sessions/{id}/"""
        sb = get_supabase()
        session, err = get_session(sb, pk, request.user['id'])
        if err:
            return err

        try:
            case_result = sb.table('cases').select(
                'id, title, modality, difficulty, clinical_history, tags, '
                'case_images(image_url, slice_index, volume_name)'
            ).eq('id', session['case_id']).single().execute()
            case = case_result.data or {}
            raw_images = case.pop('case_images', None) or []
            volumes: dict = {}
            for img in raw_images:
                vol = img.get('volume_name') or 'Default'
                volumes.setdefault(vol, []).append({
                    'image_url': img['image_url'],
                    'slice_index': img.get('slice_index'),
                })
            case['images'] = [
                {'volume_name': vol, 'slices': slices}
                for vol, slices in volumes.items()
            ]
            case['image_urls'] = [img['image_url'] for img in raw_images]
            session['case'] = case
        except Exception:
            session['case'] = None

        attempts = sb.table('step_attempts').select(
            'id, step_index, step_code, student_answer, score, errors, feedback, attempt_number, latency_ms, created_at'
        ).eq('session_id', pk).order('step_index').execute()
        session['step_attempts'] = attempts.data

        return Response(session)

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        """POST /api/v1/sessions/{id}/submit_answer/"""
        sb = get_supabase()
        session, err = get_session(sb, pk, request.user['id'])
        if err:
            return err

        if session['status'] != 'IN_PROGRESS':
            return Response({'error': 'Session đã kết thúc'}, status=status.HTTP_403_FORBIDDEN)

        serializer = StepAnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_answer = serializer.validated_data['student_answer']
        current_step = session['current_step']
        if not isinstance(current_step, int) or current_step < 0 or current_step >= len(STEP_CODES):
            return Response(
                {'error': f'Session current_step ({current_step}) ngoài phạm vi'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        step_code = STEP_CODES[current_step]
        is_last = current_step == len(STEP_CODES) - 1

        # ── 1. Classify intent — handle question/chit-chat without evaluating ──
        current_question = request.data.get('current_question', '')
        classified = classify_intent(student_answer, step_code, current_step, current_question)
        if classified['intent'] in ('question', 'chit-chat'):
            return Response({'type': 'socratic', 'message': classified['response']})

        # ── 2. Fetch answer key ───────────────────────────────────────────────
        try:
            ak_result = sb.table('answer_keys').select('expected_finding').eq(
                'case_id', session['case_id']
            ).eq('step_code', step_code).single().execute()
            answer_key = {'expected_finding': ak_result.data.get('expected_finding', '')}
        except Exception:
            answer_key = {'expected_finding': ''}

        # ── 3. Build context from DB ──────────────────────────────────────────
        prev_rows = sb.table('step_attempts').select(
            'step_index, step_code, student_answer, score'
        ).eq('session_id', pk).lt('step_index', current_step).order('step_index').execute()

        best_prev: dict = {}
        for a in (prev_rows.data or []):
            idx = a['step_index']
            if idx not in best_prev or (a['score'] or 0) > (best_prev[idx].get('_score') or 0):
                best_prev[idx] = {'step': a['step_code'], 'answer': a['student_answer'], '_score': a['score']}
        previous_steps = [
            {'step': v['step'], 'answer': v['answer']}
            for v in (best_prev[i] for i in sorted(best_prev))
        ]

        cur_rows = sb.table('step_attempts').select(
            'student_answer, score'
        ).eq('session_id', pk).eq('step_index', current_step).order('attempt_number').execute()
        step_attempts_texts = [a['student_answer'] for a in (cur_rows.data or [])]
        hint_count = sum(1 for a in (cur_rows.data or []) if a['score'] is not None and a['score'] < 0.6)

        # ── 4. Evaluate ───────────────────────────────────────────────────────
        result = evaluate_answer(
            student_answer=student_answer,
            step_code=step_code,
            step_index=current_step,
            answer_key=answer_key,
            cv_findings={},
            previous_steps=previous_steps,
            step_attempts=step_attempts_texts,
            is_last_step=is_last,
        )

        # ── 5. Save attempt ───────────────────────────────────────────────────
        attempt_number = len(step_attempts_texts) + 1
        rubric_id = get_rubric_id(sb, step_code)
        insert_data = {
            'session_id': pk,
            'step_index': current_step,
            'step_code': step_code,
            'student_answer': student_answer,
            'score': result['score'],
            'errors': result['errors'],
            'feedback': result['feedback'] if not result['passed'] else result['positive_feedback'],
            'attempt_number': attempt_number,
            'latency_ms': result['latency_ms'],
        }
        if rubric_id:
            insert_data['rubric_criterion_id'] = rubric_id

        try:
            attempt_result = sb.table('step_attempts').insert(insert_data).execute()
        except Exception as e:
            err_msg = str(e)
            if 'step_index' in err_msg and 'check constraint' in err_msg:
                return Response(
                    {
                        'error': 'DB schema cũ: cần chạy migration fix_step_index_constraint.sql trên Supabase Dashboard.',
                        'detail': err_msg,
                    },
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            raise
        attempt = attempt_result.data[0]

        passed = result['passed']
        force_advance = not passed and hint_count >= 3
        response_data = {
            'attempt': attempt,
            'passed': passed,
            'positive_feedback': result.get('positive_feedback', ''),
            'could_add': result.get('could_add', ''),
        }

        if passed or force_advance:
            response_data['answer_key_preview'] = answer_key.get('expected_finding', '')
            if force_advance:
                response_data['force_advance'] = True
                response_data['message'] = f'Đã nhận {hint_count} gợi ý. Chuyển bước tiếp theo.'
            else:
                response_data['next_step_preview'] = result.get('next_step_preview', '')
                response_data['message'] = 'Đúng rồi! Chuyển sang bước tiếp theo.'

            if not is_last:
                sb.table('sessions').update({'current_step': current_step + 1}).eq('id', pk).execute()
                response_data['next_step'] = current_step + 1
            else:
                all_attempts = sb.table('step_attempts').select(
                    'step_index, score'
                ).eq('session_id', pk).execute()
                best_by_step: dict = {}
                for a in (all_attempts.data or []):
                    if a['score'] is None:
                        continue
                    idx = a['step_index']
                    if idx not in best_by_step or a['score'] > best_by_step[idx]:
                        best_by_step[idx] = a['score']
                final_score = round(
                    sum(best_by_step.values()) / len(STEP_CODES), 4
                ) if best_by_step else 0.0
                sb.table('sessions').update({
                    'status': 'COMPLETED',
                    'final_score': final_score,
                    'completed_at': _now_iso(),
                }).eq('id', pk).execute()
                response_data['session_complete'] = True
                if not force_advance:
                    response_data['message'] = 'Bạn đã hoàn thành toàn bộ 5 bước phân tích. Chúc mừng!'
        else:
            hint = get_socratic_hint(
                step_code, current_step,
                result['errors'], hint_count + 1,
                step_attempts_texts + [student_answer],
            )
            response_data['hint'] = hint
            response_data['message'] = 'Chưa đủ. Hãy xem gợi ý và thử lại.'

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def exit_session(self, request, pk=None):
        """POST /api/v1/sessions/{id}/exit_session/"""
        sb = get_supabase()
        session, err = get_session(sb, pk, request.user['id'])
        if err:
            return err

        if session['status'] != 'IN_PROGRESS':
            return Response({'error': 'Không thể thoát khỏi session này'}, status=status.HTTP_400_BAD_REQUEST)

        sb.table('sessions').update({
            'status': 'ABANDONED',
            'completed_at': _now_iso(),
        }).eq('id', pk).execute()

        return Response({
            'success': True,
            'message': 'Session đã được lưu và thoát thành công',
            'session_id': pk,
            'last_step': session['current_step'],
            'timestamp': _now_iso(),
        })

    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        """POST /api/v1/sessions/{id}/resume/ — reactivate a PAUSED session"""
        sb = get_supabase()
        session, err = get_session(sb, pk, request.user['id'])
        if err:
            return err

        if session['status'] not in ('ABANDONED', 'IN_PROGRESS'):
            return Response({'error': 'Session này không thể tiếp tục'}, status=status.HTTP_400_BAD_REQUEST)

        if session['status'] == 'ABANDONED':
            sb.table('sessions').update({'status': 'IN_PROGRESS', 'completed_at': None}).eq('id', pk).execute()

        return Response({'success': True, 'session_id': pk, 'current_step': session['current_step']})

    @action(detail=True, methods=['get'])
    def step_answers(self, request, pk=None):
        """GET /api/v1/sessions/{id}/step_answers/"""
        sb = get_supabase()
        session, err = get_session(sb, pk, request.user['id'])
        if err:
            return err

        try:
            case_result = sb.table('cases').select('*').eq('id', session['case_id']).single().execute()
            case = case_result.data or {}
        except Exception:
            case = {}

        rubrics_result = sb.table('step_rubrics').select('*').execute()
        step_templates = {
            code: row
            for code, row in index_by_canonical_step(rubrics_result.data or []).items()
        }

        answer_keys_result = sb.table('answer_keys').select('*').eq('case_id', session['case_id']).order('step_order').execute()
        answers = {
            code: {
                'expected_finding': r.get('expected_finding'),
                'clinical_explanation': r.get('clinical_explanation'),
                'key_points': r.get('key_points'),
            }
            for code, r in index_by_canonical_step(answer_keys_result.data or []).items()
        }

        return Response({
            'session_id': pk,
            'case_id': session['case_id'],
            'case_title': case.get('title'),
            'case_modality': case.get('modality'),
            'current_step': session['current_step'],
            'status': session['status'],
            'answers': answers,
            'step_templates': step_templates,
        })

    @action(detail=True, methods=['get'])
    def answer_key(self, request, pk=None):
        """GET /api/v1/sessions/{id}/answer_key/ — only after COMPLETED"""
        sb = get_supabase()
        session, err = get_session(sb, pk, request.user['id'])
        if err:
            return err

        if session['status'] != 'COMPLETED':
            return Response(
                {'error': 'Chỉ xem được đáp án sau khi hoàn thành.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        answer_keys_result = sb.table('answer_keys').select(
            'step_code, step_order, expected_finding, clinical_explanation, key_points'
        ).eq('case_id', session['case_id']).order('step_order').execute()
        answer_key = {
            code: {
                'expected_finding': r.get('expected_finding'),
                'clinical_explanation': r.get('clinical_explanation'),
                'key_points': r.get('key_points', []),
            }
            for code, r in index_by_canonical_step(answer_keys_result.data or []).items()
        }

        attempts = sb.table('step_attempts').select(
            'step_code, score, feedback'
        ).eq('session_id', pk).order('step_index').execute()

        return Response({
            'answer_key': answer_key,
            'your_score': session.get('final_score'),
            'details': [
                {'step': normalize_step_code(a['step_code']), 'score': a['score'], 'feedback': a['feedback']}
                for a in attempts.data
            ],
        })


class StudentPerformanceViewSet(viewsets.ViewSet):
    """GET /api/v1/performance/my_stats/ — thống kê live từ Supabase"""
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def my_stats(self, request):
        user_id = request.user['id']
        sb = get_supabase()

        sessions = sb.table('sessions').select(
            'id, final_score, status, completed_at'
        ).eq('user_id', user_id).eq('status', 'COMPLETED').execute()

        completed = sessions.data or []
        total_cases_completed = len(completed)
        average_score = round(
            sum(s['final_score'] for s in completed if s['final_score'] is not None) / total_cases_completed,
            4,
        ) if total_cases_completed else 0.0

        last_activity = max(
            (s['completed_at'] for s in completed if s['completed_at']),
            default=None,
        )

        accuracy_by_step = {}
        if completed:
            session_ids = [s['id'] for s in completed]
            attempts = sb.table('step_attempts').select(
                'step_code, score'
            ).in_('session_id', session_ids).execute()

            step_scores: dict = {code: [] for code in STEP_CODES}
            for a in (attempts.data or []):
                code = normalize_step_code(a.get('step_code'))
                if code in step_scores and a['score'] is not None:
                    step_scores[code].append(a['score'])

            accuracy_by_step = {
                code: round(sum(scores) / len(scores), 4)
                for code, scores in step_scores.items()
                if scores
            }

        return Response({
            'user_id': user_id,
            'email': request.user.get('email'),
            'total_cases_completed': total_cases_completed,
            'average_score': average_score,
            'accuracy_by_step': accuracy_by_step,
            'last_activity': last_activity,
        })
