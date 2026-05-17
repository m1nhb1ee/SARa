import json
import logging
import unicodedata
from datetime import timezone as dt_timezone
from datetime import datetime

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from app.core.step_codes import STEP_CODES, index_by_canonical_step, normalize_step_code
from app.core.supabase_client import get_supabase, get_supabase_service_role
from app.agents.ai_services import classify_intent, evaluate_answer, get_socratic_hint, get_step_rubric
from app.observability import langfuse_obs

from .serializers import StepAnswerSubmitSerializer
from .services import get_session, get_rubric_id

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(dt_timezone.utc).isoformat()


def _is_hint_request_text(text: str | None) -> bool:
    normalized = " ".join((text or "").strip().lower().split())
    ascii_normalized = unicodedata.normalize("NFKD", normalized)
    ascii_normalized = ascii_normalized.encode("ascii", "ignore").decode("ascii")
    ascii_normalized = " ".join(ascii_normalized.split())
    if not normalized or len(normalized) > 80:
        return False
    hint_markers = (
        "hint",
        "help",
        "goi y",
        "gợi ý",
        "khong biet",
        "không biết",
        "khong ro",
        "không rõ",
        "khong nho",
        "không nhớ",
        "khong chac",
        "không chắc",
        "k biet",
        "k biết",
        "ko biet",
        "ko biết",
        "toi khong biet",
        "tôi không biết",
        "em khong biet",
        "em không biết",
        "chịu",
        "bo tay",
        "bó tay",
    )
    ascii_hint_markers = (
        "hint",
        "help",
        "goi y",
        "khong biet",
        "khong ro",
        "khong nho",
        "khong chac",
        "k biet",
        "ko biet",
        "toi khong biet",
        "em khong biet",
        "bo tay",
    )
    return (
        any(marker in normalized for marker in hint_markers)
        or any(marker in ascii_normalized for marker in ascii_hint_markers)
    )


def _pick_hint_error_fragment(
    rubric: dict,
    result: dict,
    hint_number: int,
    previous_failed_error_counts: dict[str, int] | None = None,
) -> tuple[str | None, str | None, bool, int]:
    """
    Pick exactly one fragment for the current hint.
    Priority: higher rubric max_score first. If equal, keep rubric order.
    If an error repeats from the previous failed attempt, keep focus on that
    repeated error rather than switching to a different one.
    """
    errors = result.get('errors') or []
    if not errors:
        return None, None, False, 0
    fragments = result.get('partial_answer_by_error') or []

    rubric_criteria = rubric.get('criteria') or []
    rank_map: dict[str, tuple[float, int]] = {}
    for idx, criterion in enumerate(rubric_criteria):
        code = criterion.get('error_code')
        if code and code not in rank_map:
            rank_map[code] = (float(criterion.get('max_score') or 0), idx)

    fragment_map = {
        item.get('error_code'): item.get('fragment', '')
        for item in fragments
        if isinstance(item, dict) and item.get('error_code')
    }

    current_errors = [code for code in errors if code]
    if not current_errors:
        return None, None, False, 0

    previous_failed_error_counts = previous_failed_error_counts or {}

    def sort_key(code: str) -> tuple[int, float, int]:
        repeat_count = previous_failed_error_counts.get(code, 0)
        weight, idx = rank_map.get(code, (0.0, 10**9))
        return (-repeat_count, -weight, idx)

    current_errors.sort(key=sort_key)
    chosen_code = current_errors[0]
    repeat_depth = previous_failed_error_counts.get(chosen_code, 0) + 1
    repeat_focus = repeat_depth > 1
    fragment = fragment_map.get(chosen_code) if hint_number >= 2 else None
    return fragment or None, chosen_code, repeat_focus, repeat_depth


def _rubric_error_context(rubric: dict, errors: list | None) -> list[dict]:
    """Return safe rubric labels for the current missing error codes."""
    wanted = set(errors or [])
    if not wanted:
        return []
    context = []
    for criterion in rubric.get('criteria') or []:
        code = criterion.get('error_code')
        if code in wanted:
            context.append({
                'error_code': code,
                'label': criterion.get('label') or '',
                'max_score': criterion.get('max_score'),
            })
    return context


def _pick_hint_directive(result: dict, focus_error_code: str | None) -> dict | None:
    """Pick the directive matching the focused error; fallback to criterion target."""
    if not focus_error_code:
        return None
    directives = result.get('hint_directives') or []
    for directive in directives:
        if isinstance(directive, dict) and directive.get('error_code') == focus_error_code:
            return directive

    for criterion in result.get('criterion_results') or []:
        if not isinstance(criterion, dict) or criterion.get('error_code') != focus_error_code:
            continue
        targets = criterion.get('missing_targets') or []
        if not targets:
            continue
        target = targets[0]
        if not isinstance(target, dict):
            continue
        hint_levels = target.get('hint_levels') or {}
        return {
            'error_code': focus_error_code,
            'target_id': target.get('target_id') or focus_error_code,
            'student_has': ', '.join(criterion.get('student_evidence') or []),
            'missing_target': target.get('safe_anchor') or '',
            'safe_anchor': target.get('safe_anchor') or '',
            'safe_hint_level_1': hint_levels.get('1') or target.get('safe_anchor') or '',
            'safe_hint_level_2': hint_levels.get('2') or target.get('safe_anchor') or '',
            'safe_hint_level_3': hint_levels.get('3') or target.get('safe_anchor') or '',
            'do_not_reveal': ['full diagnosis', 'full expected finding'],
        }
    for item in result.get('partial_answer_by_error') or []:
        if not isinstance(item, dict) or item.get('error_code') != focus_error_code:
            continue
        fragment = item.get('fragment') or ''
        if not fragment:
            continue
        return {
            'error_code': focus_error_code,
            'target_id': focus_error_code,
            'student_has': '',
            'missing_target': fragment,
            'safe_anchor': fragment,
            'safe_hint_level_1': 'nhắc người học xem lại tiêu chí còn thiếu',
            'safe_hint_level_2': fragment,
            'safe_hint_level_3': f'nói rõ còn thiếu: {fragment}',
            'do_not_reveal': ['full diagnosis', 'full expected finding'],
        }
    return None


def _fallback_hint_directive_from_rubric(
    rubric: dict,
    step_code: str,
    focus_error_code: str | None,
) -> dict | None:
    """Build a deterministic hint directive when the student has not answered yet."""
    if not focus_error_code:
        return None

    criterion_label = ''
    for criterion in rubric.get('criteria') or []:
        if criterion.get('error_code') == focus_error_code:
            criterion_label = criterion.get('label') or ''
            break

    generic_target = criterion_label or focus_error_code.replace('_', ' ')
    templates = {
        'missing_location': {
            'missing_target': 'vị trí của bất thường',
            'safe_anchor': 'bên, vùng giải phẫu và khoang/liên quan giải phẫu',
            'safe_hint_level_1': 'nhắc người học bắt đầu bằng vị trí của bất thường',
            'safe_hint_level_2': 'yêu cầu nêu bên, vùng giải phẫu và khoang/liên quan giải phẫu của phát hiện',
            'safe_hint_level_3': 'nói rõ còn thiếu vị trí: bên nào, vùng nào và phát hiện nằm trong/liên quan khoang nào',
        },
        'missing_imaging_characteristics': {
            'missing_target': 'đặc điểm hình ảnh của bất thường',
            'safe_anchor': 'đậm độ/tín hiệu, hình dạng, bờ và kích thước tương đối',
            'safe_hint_level_1': 'nhắc người học mô tả đặc điểm hình ảnh thay vì chỉ nói có bất thường',
            'safe_hint_level_2': 'yêu cầu nêu đậm độ/tín hiệu, hình dạng, bờ và kích thước tương đối',
            'safe_hint_level_3': 'nói rõ còn thiếu mô tả đặc điểm: đậm độ/tín hiệu, hình dạng, bờ và kích thước tương đối',
        },
        'missing_associated_findings': {
            'missing_target': 'dấu hiệu liên quan đi kèm',
            'safe_anchor': 'hiệu ứng lên cấu trúc lân cận và dấu hiệu xương/mô mềm/liên quan nếu có',
            'safe_hint_level_1': 'nhắc người học tìm dấu hiệu đi kèm quanh bất thường chính',
            'safe_hint_level_2': 'yêu cầu kiểm tra ảnh hưởng lên cấu trúc lân cận và dấu hiệu xương/mô mềm/liên quan',
            'safe_hint_level_3': 'nói rõ còn thiếu dấu hiệu liên quan: hiệu ứng lên cấu trúc lân cận và dấu hiệu đi kèm nếu có',
        },
        'insufficient_evidence': {
            'missing_target': 'bằng chứng hình ảnh hỗ trợ lập luận',
            'safe_anchor': 'findings đã mô tả ở bước trước',
            'safe_hint_level_1': 'nhắc người học xem lại findings đã mô tả',
            'safe_hint_level_2': 'yêu cầu chọn 1-2 dấu hiệu hình ảnh cụ thể làm bằng chứng',
            'safe_hint_level_3': 'nói rõ còn thiếu bằng chứng hình ảnh cụ thể để hỗ trợ kết luận',
        },
        'missing_finding_mapping': {
            'missing_target': 'liên hệ finding với ý nghĩa lâm sàng/chẩn đoán',
            'safe_anchor': 'finding chính và ý nghĩa của nó',
            'safe_hint_level_1': 'nhắc người học liên hệ finding với ý nghĩa của nó',
            'safe_hint_level_2': 'yêu cầu giải thích finding chính làm giả thiết hợp lý như thế nào',
            'safe_hint_level_3': 'nói rõ còn thiếu cầu nối finding -> giả thiết/kết luận',
        },
        'missing_reasonable_hypothesis': {
            'missing_target': 'giả thiết chẩn đoán ban đầu hợp lý',
            'safe_anchor': 'một giả thiết được hỗ trợ bởi findings',
            'safe_hint_level_1': 'nhắc người học đề xuất một giả thiết dựa trên findings',
            'safe_hint_level_2': 'yêu cầu nêu một giả thiết và gắn nó với bằng chứng hình ảnh',
            'safe_hint_level_3': 'nói rõ còn thiếu giả thiết chẩn đoán ban đầu có dẫn chứng',
        },
    }
    payload = templates.get(focus_error_code, {
        'missing_target': generic_target,
        'safe_anchor': generic_target,
        'safe_hint_level_1': f'nhắc người học xem lại tiêu chí: {generic_target}',
        'safe_hint_level_2': f'yêu cầu người học bổ sung cụ thể phần: {generic_target}',
        'safe_hint_level_3': f'nói rõ còn thiếu tiêu chí: {generic_target}',
    })
    return {
        'error_code': focus_error_code,
        'target_id': focus_error_code,
        'student_has': '',
        'do_not_reveal': ['full diagnosis', 'full expected finding'],
        **payload,
    }


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

        try:
            case_result = sb.table('cases').select('id, title, is_exam').eq('id', case_id).single().execute()
            case = case_result.data or {}
        except Exception:
            return Response({'error': 'Case not found'}, status=status.HTTP_404_NOT_FOUND)

        if case.get('is_exam') is True:
            return Response({'error': 'Exam cases cannot be used for diagnosis sessions'}, status=status.HTTP_400_BAD_REQUEST)

        result = sb.table('sessions').insert({
            'user_id': user_id,
            'case_id': case_id,
            'current_step': 0,
            'status': 'IN_PROGRESS',
        }).execute()

        session = result.data[0]

        session['case_title'] = case.get('title')

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
        user_id = request.user['id']
        session, err = get_session(sb, pk, user_id)
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
        trace_metadata = langfuse_obs.common_metadata(
            feature="practice",
            session_kind="practice",
            case_id=session.get('case_id'),
            step_code=step_code,
            step_index=current_step,
            extra={
                "langfuse_user_id": user_id,
                "langfuse_session_id": f"practice:{pk}",
            },
        )

        # ── 1. Classify intent — handle question/chit-chat without evaluating ──
        current_question = request.data.get('current_question', '')
        classified = classify_intent(
            student_answer,
            step_code,
            current_step,
            current_question,
            trace_metadata=trace_metadata,
        )
        intent = classified.get('intent', 'answer')
        if _is_hint_request_text(student_answer):
            intent = 'need_hint'
        if intent in ('question', 'chit-chat'):
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
            'step_index, step_code, student_answer, score, errors'
        ).eq('session_id', pk).lt('step_index', current_step).order('step_index').execute()

        best_prev: dict = {}
        for a in (prev_rows.data or []):
            if _is_hint_request_text(a.get('student_answer')):
                continue
            idx = a['step_index']
            if idx not in best_prev or (a['score'] or 0) > (best_prev[idx].get('_score') or 0):
                best_prev[idx] = {
                    'step': a['step_code'],
                    'answer': a['student_answer'],
                    'errors': a.get('errors') or [],
                    '_score': a['score'],
                }
        previous_steps = [
            {'step': v['step'], 'answer': v['answer']}
            for v in (best_prev[i] for i in sorted(best_prev))
        ]
        prior_errors = [
            {
                'step': v['step'],
                'errors': v['errors'],
            }
            for v in (best_prev[i] for i in sorted(best_prev))
            if v.get('errors')
        ]

        cur_rows = sb.table('step_attempts').select(
            'student_answer, score, errors'
        ).eq('session_id', pk).eq('step_index', current_step).order('attempt_number').execute()
        current_attempt_rows = cur_rows.data or []
        step_attempts_texts = [
            a['student_answer']
            for a in current_attempt_rows
            if not _is_hint_request_text(a.get('student_answer'))
        ]
        student_answer_for_eval = student_answer
        if intent == 'revise' and step_attempts_texts:
            student_answer_for_eval = (
                "[REVISION: this latest answer should override any conflicting "
                f"details from previous attempts]\n{student_answer}"
            )
        hint_count = sum(1 for a in current_attempt_rows if a['score'] is not None and a['score'] < 0.6)
        previous_failed_error_counts: dict[str, int] = {}
        for a in reversed(current_attempt_rows):
            if a.get('score') is not None and a['score'] < 0.6:
                for code in a.get('errors') or []:
                    previous_failed_error_counts[code] = previous_failed_error_counts.get(code, 0) + 1
        step_rubric = get_step_rubric(step_code)
        rubric_id = get_rubric_id(sb, step_code)

        if intent == 'need_hint':
            rubric_error_codes = [
                c.get('error_code')
                for c in (step_rubric.get('criteria') or [])
                if c.get('error_code')
            ]
            failed_rows = [
                a for a in current_attempt_rows
                if a.get('score') is not None and a['score'] < 0.6
            ]
            last_failed = failed_rows[-1] if failed_rows else {}
            last_errors = last_failed.get('errors') or rubric_error_codes
            hint_result = {
                'errors': last_errors,
                'partial_answer_by_error': [],
            }
            partial_answer, focus_error_code, repeat_focus, repeat_depth = _pick_hint_error_fragment(
                step_rubric,
                hint_result,
                hint_count + 1,
                previous_failed_error_counts=previous_failed_error_counts,
            )
            hint_directive = _pick_hint_directive(hint_result, focus_error_code)
            if not hint_directive:
                hint_directive = _fallback_hint_directive_from_rubric(
                    step_rubric,
                    step_code,
                    focus_error_code,
                )
            focused_errors = [focus_error_code] if focus_error_code else last_errors
            if not focused_errors:
                focused_errors = rubric_error_codes
            if hint_count >= 3:
                force_message = f'Đã nhận {hint_count} gợi ý. Chuyển bước tiếp theo.'
                insert_data = {
                    'session_id': pk,
                    'step_index': current_step,
                    'step_code': step_code,
                    'student_answer': student_answer,
                    'score': 0.0,
                    'errors': focused_errors,
                    'feedback': force_message,
                    'attempt_number': len(current_attempt_rows) + 1,
                    'latency_ms': 0,
                }
                if rubric_id:
                    insert_data['rubric_criterion_id'] = rubric_id
                attempt_result = sb.table('step_attempts').insert(insert_data).execute()
                attempt = attempt_result.data[0]
                response_data = {
                    'attempt': attempt,
                    'passed': False,
                    'force_advance': True,
                    'positive_feedback': '',
                    'could_add': '',
                    'answer_key_preview': answer_key.get('expected_finding', ''),
                    'message': force_message,
                }
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
                return Response(response_data, status=status.HTTP_200_OK)

            if step_attempts_texts:
                hint_probe_result = evaluate_answer(
                    student_answer="",
                    step_code=step_code,
                    step_index=current_step,
                    answer_key=answer_key,
                    cv_findings={},
                    previous_steps=previous_steps,
                    step_attempts=step_attempts_texts,
                    is_last_step=is_last,
                    trace_metadata={
                        **trace_metadata,
                        "attempt_number": len(current_attempt_rows) + 1,
                        "hint_count": hint_count + 1,
                        "explicit_hint_probe": True,
                    },
                )
                if hint_probe_result.get('errors'):
                    partial_answer, focus_error_code, repeat_focus, repeat_depth = _pick_hint_error_fragment(
                        step_rubric,
                        hint_probe_result,
                        hint_count + 1,
                        previous_failed_error_counts=previous_failed_error_counts,
                    )
                    focused_errors = [focus_error_code] if focus_error_code else hint_probe_result['errors']
                    if not focused_errors:
                        focused_errors = rubric_error_codes
                    hint_directive = _pick_hint_directive(hint_probe_result, focus_error_code)
                    if not hint_directive:
                        hint_directive = _fallback_hint_directive_from_rubric(
                            step_rubric,
                            step_code,
                            focus_error_code,
                        )
            hint = get_socratic_hint(
                step_code,
                current_step,
                focused_errors,
                hint_count + 1,
                prior_errors=prior_errors,
                partial_answer=partial_answer,
                focus_error_code=focus_error_code,
                repeat_focus=repeat_focus,
                repeat_depth=repeat_depth,
                step_attempts=step_attempts_texts,
                error_context=_rubric_error_context(step_rubric, focused_errors),
                previous_steps=previous_steps,
                hint_directive=hint_directive,
                trace_metadata={
                    **trace_metadata,
                    "attempt_number": len(current_attempt_rows) + 1,
                    "hint_count": hint_count + 1,
                    "explicit_hint_request": True,
                },
            )
            insert_data = {
                'session_id': pk,
                'step_index': current_step,
                'step_code': step_code,
                'student_answer': student_answer,
                'score': 0.0,
                'errors': focused_errors,
                'feedback': hint,
                'attempt_number': len(current_attempt_rows) + 1,
                'latency_ms': 0,
            }
            if rubric_id:
                insert_data['rubric_criterion_id'] = rubric_id
            sb.table('step_attempts').insert(insert_data).execute()
            return Response({
                'type': 'socratic',
                'message': hint,
            }, status=status.HTTP_200_OK)

        # ── 4. Evaluate ───────────────────────────────────────────────────────
        result = evaluate_answer(
            student_answer=student_answer_for_eval,
            step_code=step_code,
            step_index=current_step,
            answer_key=answer_key,
            cv_findings={},
            previous_steps=previous_steps,
            step_attempts=step_attempts_texts,
            is_last_step=is_last,
            trace_metadata={
                **trace_metadata,
                "attempt_number": len(current_attempt_rows) + 1,
                "hint_count": hint_count,
            },
        )

        # ── 5. Save attempt ───────────────────────────────────────────────────
        attempt_number = len(current_attempt_rows) + 1
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
        next_hint_number = hint_count + 1
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
                    response_data['message'] = f'Bạn đã hoàn thành toàn bộ {len(STEP_CODES)} bước phân tích. Chúc mừng!'
        else:
            partial_answer, focus_error_code, repeat_focus, repeat_depth = _pick_hint_error_fragment(
                step_rubric,
                result,
                next_hint_number,
                previous_failed_error_counts=previous_failed_error_counts,
            )
            hint_directive = _pick_hint_directive(result, focus_error_code)
            focused_errors = [focus_error_code] if focus_error_code else result['errors']
            if not focused_errors:
                focused_errors = [
                    c.get('error_code')
                    for c in (step_rubric.get('criteria') or [])
                    if c.get('error_code')
                ]
            hint = get_socratic_hint(
                step_code, current_step,
                focused_errors, hint_count + 1,
                prior_errors=prior_errors,
                partial_answer=partial_answer,
                focus_error_code=focus_error_code,
                repeat_focus=repeat_focus,
                repeat_depth=repeat_depth,
                step_attempts=step_attempts_texts + [student_answer],
                error_context=_rubric_error_context(step_rubric, focused_errors),
                previous_steps=previous_steps,
                hint_directive=hint_directive,
                trace_metadata={
                    **trace_metadata,
                    "attempt_number": attempt_number,
                    "hint_count": hint_count + 1,
                },
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

        exam_sessions = sb.table('exam_sessions').select(
            'id, final_score, status, completed_at'
        ).eq('user_id', user_id).eq('status', 'COMPLETED').execute()
        completed_exam = exam_sessions.data or []
        exam_cases_completed = len(completed_exam)
        exam_average_score = round(
            sum(s['final_score'] for s in completed_exam if s['final_score'] is not None) / exam_cases_completed,
            4,
        ) if exam_cases_completed else 0.0

        exam_accuracy_by_step = {}
        if completed_exam:
            exam_session_ids = [s['id'] for s in completed_exam]
            exam_attempts = sb.table('exam_step_attempts').select(
                'step_code, score'
            ).in_('exam_session_id', exam_session_ids).execute()

            exam_step_scores: dict = {code: [] for code in STEP_CODES}
            for a in (exam_attempts.data or []):
                code = normalize_step_code(a.get('step_code'))
                if code in exam_step_scores and a['score'] is not None:
                    exam_step_scores[code].append(a['score'])

            exam_accuracy_by_step = {
                code: round(sum(scores) / len(scores), 4)
                for code, scores in exam_step_scores.items()
                if scores
            }

        return Response({
            'user_id': user_id,
            'email': request.user.get('email'),
            'total_cases_completed': total_cases_completed,
            'average_score': average_score,
            'accuracy_by_step': accuracy_by_step,
            'exam_cases_completed': exam_cases_completed,
            'exam_average_score': exam_average_score,
            'exam_accuracy_by_step': exam_accuracy_by_step,
            'last_activity': last_activity,
        })

    @action(detail=False, methods=['get'])
    def leaderboard(self, request):
        """GET /api/v1/performance/leaderboard/?type=exam|case&limit=50

        Returns ranked users by avg score. Minimum 3 completed items.
        Each row: {rank, user_id, display_name, avg_score, total_completed, is_self}.
        Display name = user_name || 'Student #<id4>'.
        """
        sb = get_supabase_service_role()
        board_type = request.query_params.get('type', 'case').lower()
        try:
            limit = max(1, min(int(request.query_params.get('limit', 50)), 100))
        except (TypeError, ValueError):
            limit = 50
        min_completed = 3

        table = 'exam_sessions' if board_type == 'exam' else 'sessions'
        rows = sb.table(table).select(
            'user_id, final_score'
        ).eq('status', 'COMPLETED').not_.is_('final_score', 'null').execute().data or []

        agg: dict = {}
        for row in rows:
            uid = row.get('user_id')
            if not uid:
                continue
            bucket = agg.setdefault(uid, {'sum': 0.0, 'count': 0})
            bucket['sum'] += float(row.get('final_score') or 0)
            bucket['count'] += 1

        qualified = [
            (uid, b['sum'] / b['count'], b['count'])
            for uid, b in agg.items() if b['count'] >= min_completed
        ]
        qualified.sort(key=lambda r: (-r[1], -r[2]))
        top = qualified[:limit]

        user_ids = [uid for uid, _, _ in top]
        profiles: dict = {}
        if user_ids:
            profile_rows = sb.table('users').select(
                'id, user_name, full_name, university'
            ).in_('id', user_ids).execute().data or []
            profiles = {p['id']: p for p in profile_rows}

        me = str(request.user['id'])
        def _display(uid: str, profile: dict) -> str:
            if profile.get('user_name'):
                return profile['user_name']
            short = uid.split('-')[0][:4].upper() if uid else 'XXXX'
            return f'Student #{short}'

        entries = []
        for idx, (uid, avg, count) in enumerate(top):
            profile = profiles.get(uid, {})
            entries.append({
                'rank': idx + 1,
                'user_id': uid,
                'display_name': _display(uid, profile),
                'university': profile.get('university'),
                'avg_score': round(avg, 4),
                'total_completed': count,
                'is_self': uid == me,
            })

        self_entry = next((e for e in entries if e['is_self']), None)
        if not self_entry:
            my_bucket = agg.get(me)
            if my_bucket and my_bucket['count'] >= min_completed:
                my_avg = my_bucket['sum'] / my_bucket['count']
                my_rank = sum(1 for _, a, _ in qualified if a > my_avg) + 1
                my_profile_res = sb.table('users').select(
                    'id, user_name, full_name, university'
                ).eq('id', me).single().execute()
                my_profile = my_profile_res.data or {}
                self_entry = {
                    'rank': my_rank,
                    'user_id': me,
                    'display_name': _display(me, my_profile),
                    'university': my_profile.get('university'),
                    'avg_score': round(my_avg, 4),
                    'total_completed': my_bucket['count'],
                    'is_self': True,
                }

        return Response({
            'type': board_type,
            'entries': entries,
            'self': self_entry,
            'min_required': min_completed,
            'total_qualified': len(qualified),
        })


class TranslateView(APIView):
    """POST /api/v1/translate/
    Body: { "fields": { "feedback": "...", "could_add": "...", ... } }
    Returns: { "fields": { same keys, Vietnamese values } }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        fields = request.data.get('fields', {})
        if not isinstance(fields, dict):
            return Response({'error': 'fields must be an object'}, status=status.HTTP_400_BAD_REQUEST)

        non_empty = {k: v for k, v in fields.items() if v and isinstance(v, str)}
        if not non_empty:
            return Response({'fields': {}})

        try:
            from openai import OpenAI
            client = OpenAI()
            response = client.chat.completions.create(
                model='gpt-4o-mini',
                messages=[
                    {
                        'role': 'system',
                        'content': (
                            'You are a medical radiology translator. '
                            'Translate the JSON fields from English to Vietnamese. '
                            'Return ONLY a valid JSON object with the same keys. '
                            'Preserve medical terms and formatting. Do not add commentary.'
                        ),
                    },
                    {
                        'role': 'user',
                        'content': json.dumps(non_empty, ensure_ascii=False),
                    },
                ],
                response_format={'type': 'json_object'},
                temperature=0.1,
            )
            result = json.loads(response.choices[0].message.content)
            return Response({'fields': result})
        except Exception as e:
            logger.error(f'TranslateView error: {e}')
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
