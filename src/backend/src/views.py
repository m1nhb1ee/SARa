from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser
import time
import json
import os
import logging
from django.utils import timezone

from .models import Case, CaseTag, StudentPerformance, UserUploadedCase
from .supabase_client import get_supabase
from .serializers import (
    StepAnswerSubmitSerializer, StudentPerformanceSerializer, CaseTagSerializer,
    UserUploadedCaseListSerializer, UserUploadedCaseDetailSerializer,
    UserUploadedCaseUploadSerializer
)
from .ai_services import MockAIAgent, OpenAIAgent
from .huggingface_services import HuggingFaceImageAnalyzer

logger = logging.getLogger(__name__)


def get_ai_agent():
    """
    Trả về AI Agent instance dựa trên biến môi trường USE_OPENAI.
    - Nếu USE_OPENAI=True và OPENAI_API_KEY có, dùng OpenAIAgent
    - Ngược lại, dùng MockAIAgent
    """
    use_openai = os.getenv('USE_OPENAI', 'true').lower() == 'true'
    has_api_key = bool(os.getenv('OPENAI_API_KEY', '').strip())
    
    if use_openai and has_api_key:
        logger.info("Using OpenAI Agent for evaluation")
        return OpenAIAgent
    else:
        reason = "OpenAI disabled" if not use_openai else "OPENAI_API_KEY not set"
        logger.info(f"Using Mock Agent ({reason})")
        return MockAIAgent


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CaseTagViewSet(viewsets.ReadOnlyModelViewSet):
    """API cho Tags - chỉ xem"""
    queryset = CaseTag.objects.all()
    serializer_class = CaseTagSerializer
    pagination_class = StandardPagination


class CaseViewSet(viewsets.ViewSet):
    """API cho Case - fetch từ Supabase, không expose answer key"""
    pagination_class = StandardPagination

    def list(self, request):
        """GET /api/v1/cases/ — filter by modality, difficulty, disease_tag, status"""
        sb = get_supabase()
        modality    = request.query_params.get('modality')
        difficulty  = request.query_params.get('difficulty')
        disease_tag = request.query_params.get('disease_tag')
        status      = request.query_params.get('status')

        query = sb.table('cases').select(
            'id, title, modality, difficulty, clinical_history, disease_tag, status, image_urls, tags, created_at'
        )

        if status:
            query = query.eq('status', status)

        if modality:
            query = query.eq('modality', modality)
        if difficulty:
            query = query.eq('difficulty', difficulty)
        if disease_tag:
            query = query.eq('disease_tag', disease_tag)

        result = query.order('created_at', desc=True).execute()
        return Response({'cases': result.data, 'count': len(result.data)})

    def retrieve(self, _request, pk=None):
        """GET /api/v1/cases/{id}/"""
        import uuid
        try:
            uuid.UUID(str(pk).strip())
        except ValueError:
            return Response({'error': f'Invalid case id: {repr(pk)}'}, status=status.HTTP_400_BAD_REQUEST)

        sb = get_supabase()
        try:
            result = sb.table('cases').select(
                'id, title, modality, difficulty, clinical_history, disease_tag, status, image_urls, tags, created_at'
            ).eq('id', pk).single().execute()
        except Exception:
            return Response({'error': f'Case {pk} not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(result.data)


class SessionViewSet(viewsets.ViewSet):
    """API quản lý Session - Supabase backend"""
    permission_classes = [permissions.IsAuthenticated]

    STEP_CODES = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']

    def _user_uuid(self, user):
        import uuid
        return str(uuid.uuid5(uuid.NAMESPACE_DNS, f'sara_user_{user.id}'))

    def _ensure_user_in_supabase(self, sb, user):
        """Upsert the Django user into Supabase users table so FK constraints pass."""
        user_uuid = self._user_uuid(user)
        email = user.email or f'{user.username}@sara.local'
        full_name = (user.get_full_name() or user.username).strip()
        sb.table('users').upsert({
            'id': user_uuid,
            'email': email,
            'full_name': full_name,
            'role': 'admin' if user.is_staff else 'student',
        }, on_conflict='id').execute()
        return user_uuid

    def _get_session(self, sb, pk, user_uuid):
        """Fetch session and verify ownership. Returns (session_dict, error_response)."""
        import uuid as _uuid
        try:
            _uuid.UUID(str(pk).strip())
        except ValueError:
            return None, Response({'error': f'Invalid session id: {repr(pk)}'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = sb.table('sessions').select(
                'id, user_id, case_id, current_step, status, final_score, started_at, completed_at'
            ).eq('id', pk).single().execute()
        except Exception:
            return None, Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
        if result.data.get('user_id') != user_uuid:
            return None, Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        return result.data, None

    def list(self, request):
        """GET /api/v1/sessions/"""
        sb = get_supabase()
        user_uuid = self._user_uuid(request.user)
        status_filter = request.query_params.get('status')
        case_filter = request.query_params.get('case')

        query = sb.table('sessions').select(
            'id, case_id, current_step, status, final_score, started_at, completed_at'
        ).eq('user_id', user_uuid)

        if status_filter:
            query = query.eq('status', status_filter)
        if case_filter:
            query = query.eq('case_id', case_filter)

        result = query.order('started_at', desc=True).execute()
        return Response({'count': len(result.data), 'results': result.data})

    def create(self, request):
        """POST /api/v1/sessions/  Body: { "case_id": "<uuid>" }"""
        sb = get_supabase()
        user_uuid = self._ensure_user_in_supabase(sb, request.user)
        case_id = request.data.get('case_id') or request.data.get('case')

        if not case_id:
            return Response({'error': 'case_id is required'}, status=status.HTTP_400_BAD_REQUEST)

        result = sb.table('sessions').insert({
            'user_id': user_uuid,
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

    def retrieve(self, request, pk=None):
        """GET /api/v1/sessions/{id}/"""
        sb = get_supabase()
        session, err = self._get_session(sb, pk, self._user_uuid(request.user))
        if err:
            return err

        # Attach case detail
        try:
            case_result = sb.table('cases').select(
                'id, title, modality, difficulty, clinical_history, image_urls, tags'
            ).eq('id', session['case_id']).single().execute()
            session['case'] = case_result.data
        except Exception:
            session['case'] = None

        # Attach step_attempts (no step_history — only step_attempts exist)
        attempts = sb.table('step_attempts').select(
            'id, step_index, step_code, student_answer, score, errors, feedback, attempt_number, latency_ms, created_at'
        ).eq('session_id', pk).order('step_index').execute()
        session['step_attempts'] = attempts.data

        return Response(session)

    def _get_rubric_id(self, sb, step_code):
        """Fetch rubric criterion UUID for the given step_code."""
        try:
            r = sb.table('step_rubrics').select('id').eq('step_code', step_code).single().execute()
            return r.data['id']
        except Exception:
            return None

    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        """POST /api/v1/sessions/{id}/submit_answer/"""
        sb = get_supabase()
        session, err = self._get_session(sb, pk, self._user_uuid(request.user))
        if err:
            return err

        if session['status'] != 'IN_PROGRESS':
            return Response({'error': 'Session đã kết thúc'}, status=status.HTTP_403_FORBIDDEN)

        serializer = StepAnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        student_answer = serializer.validated_data['student_answer']
        current_step = session['current_step']
        step_code = self.STEP_CODES[current_step] if current_step < len(self.STEP_CODES) else 'UNKNOWN'

        rubric_id = self._get_rubric_id(sb, step_code)
        if not rubric_id:
            return Response(
                {'error': f'No rubric found for step {step_code}. Run the SQL migration first.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Fetch case for AI context
        try:
            case_result = sb.table('cases').select('*').eq('id', session['case_id']).single().execute()
            case = case_result.data
        except Exception:
            case = {}

        # Count previous attempts at this step
        prev = sb.table('step_attempts').select('id', count='exact').eq('session_id', pk).eq('step_index', current_step).execute()
        attempt_number = (prev.count or 0) + 1

        # Call AI
        start_time = time.time()
        ai_agent = get_ai_agent()
        ai_feedback = ai_agent.evaluate_answer(
            case=case,
            step_index=current_step,
            student_answer=student_answer,
            cv_findings={}
        )
        latency_ms = int((time.time() - start_time) * 1000)

        feedback_text = ai_feedback.get('feedback', {})
        if isinstance(feedback_text, dict):
            feedback_text = feedback_text.get('content', str(feedback_text))

        # Insert step_attempt into Supabase
        attempt_result = sb.table('step_attempts').insert({
            'session_id': pk,
            'rubric_criterion_id': rubric_id,
            'step_index': current_step,
            'step_code': step_code,
            'student_answer': student_answer,
            'score': ai_feedback['score'],
            'errors': ai_feedback.get('errors', []),
            'feedback': feedback_text,
            'attempt_number': attempt_number,
            'latency_ms': latency_ms,
        }).execute()
        attempt = attempt_result.data[0]

        passed = ai_feedback['score'] >= 0.6
        response_data = {'attempt': attempt, 'passed': passed}

        if passed and current_step < 5:
            sb.table('sessions').update({'current_step': current_step + 1}).eq('id', pk).execute()
            response_data['next_step'] = current_step + 1
            response_data['message'] = 'Đáp án số được! Chuyển sang bước tiếp theo.'
        elif passed and current_step == 5:
            all_attempts = sb.table('step_attempts').select('score').eq('session_id', pk).execute()
            scores = [a['score'] for a in all_attempts.data if a['score'] is not None]
            final_score = round(sum(scores) / len(self.STEP_CODES), 4) if scores else 0.0
            sb.table('sessions').update({
                'status': 'COMPLETED',
                'final_score': final_score,
                'completed_at': timezone.now().isoformat(),
            }).eq('id', pk).execute()
            response_data['message'] = 'Chúc mừng! Hoàn thành case này.'
            response_data['session_complete'] = True
        else:
            hint = ai_agent.generate_socratic_hint(case=case, step_index=current_step, errors=ai_feedback.get('errors', []))
            response_data['hint'] = hint
            response_data['message'] = 'Chưa đúng. Hãy xem gợi ý và thử lại.'

        return Response(response_data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def exit_session(self, request, pk=None):
        """POST /api/v1/sessions/{id}/exit_session/"""
        sb = get_supabase()
        session, err = self._get_session(sb, pk, self._user_uuid(request.user))
        if err:
            return err

        if session['status'] != 'IN_PROGRESS':
            return Response({'error': 'Không thể thoát khỏi session này'}, status=status.HTTP_400_BAD_REQUEST)

        sb.table('sessions').update({
            'status': 'ABANDONED',
            'completed_at': timezone.now().isoformat(),
        }).eq('id', pk).execute()

        return Response({
            'success': True,
            'message': 'Session đã được lưu và thoát thành công',
            'session_id': pk,
            'last_step': session['current_step'],
            'timestamp': timezone.now().isoformat(),
        })

    @action(detail=True, methods=['get'])
    def step_answers(self, request, pk=None):
        """GET /api/v1/sessions/{id}/step_answers/"""
        sb = get_supabase()
        session, err = self._get_session(sb, pk, self._user_uuid(request.user))
        if err:
            return err

        try:
            case_result = sb.table('cases').select('*').eq('id', session['case_id']).single().execute()
            case = case_result.data or {}
        except Exception:
            case = {}

        rubrics_result = sb.table('step_rubrics').select('*').execute()
        step_templates = {r['step_code']: r for r in (rubrics_result.data or [])}

        answer_keys_result = sb.table('answer_keys').select('*').eq('case_id', session['case_id']).order('step_order').execute()
        answers = {
            r['step_code']: {
                'expected_finding': r.get('expected_finding'),
                'clinical_explanation': r.get('clinical_explanation'),
                'key_points': r.get('key_points'),
            }
            for r in (answer_keys_result.data or [])
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
        session, err = self._get_session(sb, pk, self._user_uuid(request.user))
        if err:
            return err

        if session['status'] != 'COMPLETED':
            return Response({'error': 'Chỉ xem được đáp án sau khi hoàn thành.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            case_result = sb.table('cases').select('*').eq('id', session['case_id']).single().execute()
            case = case_result.data or {}
        except Exception:
            case = {}

        attempts = sb.table('step_attempts').select(
            'step_code, score, feedback'
        ).eq('session_id', pk).order('step_index').execute()

        return Response({
            'answer_key': case.get('answer_key'),
            'your_score': session.get('final_score'),
            'details': [{'step': a['step_code'], 'score': a['score'], 'feedback': a['feedback']} for a in attempts.data],
        })


class StudentPerformanceViewSet(viewsets.ReadOnlyModelViewSet):
    """API xem thống kê hiệu suất"""
    serializer_class = StudentPerformanceSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        """Mỗi user chỉ thấy performance của mình"""
        return StudentPerformance.objects.filter(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def my_stats(self, request):
        """Lấy thống kê cá nhân — computed live from Supabase"""
        import uuid as _uuid
        user_uuid = str(_uuid.uuid5(_uuid.NAMESPACE_DNS, f'sara_user_{request.user.id}'))
        sb = get_supabase()

        sessions = sb.table('sessions').select(
            'id, final_score, status, completed_at'
        ).eq('user_id', user_uuid).eq('status', 'COMPLETED').execute()

        completed = sessions.data or []
        total_cases_completed = len(completed)
        average_score = round(
            sum(s['final_score'] for s in completed if s['final_score'] is not None) / total_cases_completed, 4
        ) if total_cases_completed else 0.0

        last_activity = max(
            (s['completed_at'] for s in completed if s['completed_at']), default=None
        )

        # accuracy_by_step: average score per step_code across all sessions
        STEP_CODES = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']
        accuracy_by_step = {}
        if completed:
            session_ids = [s['id'] for s in completed]
            attempts = sb.table('step_attempts').select(
                'step_code, score'
            ).in_('session_id', session_ids).execute()

            step_scores: dict = {code: [] for code in STEP_CODES}
            for a in (attempts.data or []):
                if a['step_code'] in step_scores and a['score'] is not None:
                    step_scores[a['step_code']].append(a['score'])

            accuracy_by_step = {
                code: round(sum(scores) / len(scores), 4)
                for code, scores in step_scores.items()
                if scores
            }

        return Response({
            'username': request.user.username,
            'total_cases_completed': total_cases_completed,
            'average_score': average_score,
            'accuracy_by_step': accuracy_by_step,
            'last_activity': last_activity,
        })


class UserUploadedCaseViewSet(viewsets.ModelViewSet):
    """API quản lý cases do người dùng upload"""
    serializer_class = UserUploadedCaseListSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)
    pagination_class = StandardPagination
    
    def get_queryset(self):
        """Mỗi user chỉ thấy uploads của mình"""
        return UserUploadedCase.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return UserUploadedCaseDetailSerializer
        elif self.action == 'create':
            return UserUploadedCaseUploadSerializer
        return UserUploadedCaseListSerializer
    
    def create(self, request, *args, **kwargs):
        """
        Upload ảnh → Gọi HF API → Tạo Case
        
        POST /api/v1/uploaded-cases/
        Body (multipart/form-data):
            - original_image: file (required)
            - title: string (optional)
            - modality: XRAY|CT|MRI|DIFF (optional, default='XRAY')
        """
        logger.info(f"Received upload request from user {request.user.username}")
        
        # Validate input
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            # Tạo UserUploadedCase với status PENDING
            upload = UserUploadedCase.objects.create(
                user=request.user,
                original_image=serializer.validated_data['original_image'],
                title=serializer.validated_data.get('title', 'Untitled Case'),
                modality=serializer.validated_data.get('modality', 'XRAY'),
                processing_status='PENDING'
            )
            
            # Set image_url từ original_image
            if upload.original_image:
                upload.image_url = request.build_absolute_uri(upload.original_image.url)
                upload.save()
            
            logger.info(f"Created upload {upload.id} for user {request.user.username}")
            logger.info(f"Image URL: {upload.image_url}")
            
            # Mark as PROCESSING
            upload.processing_status = 'PROCESSING'
            upload.save()
            
            # Gọi HF API để phân tích ảnh
            logger.info(f"Calling HF API for upload {upload.id}")
            findings = HuggingFaceImageAnalyzer.analyze_medical_image(
                upload.original_image,
                modality=upload.modality
            )
            
            logger.info(f"HF Analysis complete. Keys in answer_key: {list(findings.get('answer_key', {}).keys())}")
            
            # Tạo Case từ findings
            case_data = HuggingFaceImageAnalyzer.create_case_from_upload(upload)
            
            case = Case.objects.create(
                title=case_data['title'],
                description=case_data['description'],
                modality=case_data['modality'],
                difficulty=case_data['difficulty'],
                clinical_history=case_data['clinical_history'],
                pipeline_rubric=case_data['pipeline_rubric'],
                answer_key=case_data['answer_key'],
                is_active=True
            )
            
            # Set image_urls
            if case_data['image_urls']:
                case.image_urls = case_data['image_urls']
                case.save()
            
            logger.info(f"Case {case.id} created from upload {upload.id}")
            logger.info(f"Case answer_key has steps: {list(case.answer_key.keys())}")

            # Generate a stable UUID for Supabase (Django Case uses integer PK)
            import uuid as _uuid
            supabase_case_id = str(_uuid.uuid5(_uuid.NAMESPACE_DNS, f'uploaded_case_{case.id}'))

            # Sync case to Supabase so SessionViewSet can find it
            difficulty_map = {'BASIC': 'easy', 'INTERMEDIATE': 'medium', 'ADVANCED': 'hard'}
            sb = get_supabase()
            sb.table('cases').upsert({
                'id': supabase_case_id,
                'title': case.title,
                'modality': case.modality,
                'difficulty': difficulty_map.get(case.difficulty, 'medium'),
                'clinical_history': case.clinical_history,
                'status': 'published',
                'image_urls': case.image_urls,
            }, on_conflict='id').execute()
            logger.info(f"Case {case.id} synced to Supabase as {supabase_case_id}")

            # Insert answer_keys rows into Supabase
            STEP_CODES = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']
            step_order_map = {code: i for i, code in enumerate(STEP_CODES)}
            answer_key_rows = [
                {
                    'case_id': supabase_case_id,
                    'step_order': step_order_map.get(step_code, i),
                    'step_code': step_code,
                    'expected_finding': str(answer),
                    'clinical_explanation': case_data.get('description', ''),
                    'key_points': [],
                }
                for i, (step_code, answer) in enumerate(case.answer_key.items())
                if step_code in step_order_map
            ]
            if answer_key_rows:
                sb.table('answer_keys').insert(answer_key_rows).execute()
                logger.info(f"Inserted {len(answer_key_rows)} answer_key rows for case {case.id}")

            # Store supabase_case_id in ai_findings for start_practice to use
            upload.ai_findings = {**findings, 'supabase_case_id': supabase_case_id}

            # Link case to upload
            upload.created_case = case
            upload.processing_status = 'SUCCESS'
            upload.save()
            
            logger.info(f"Upload {upload.id} processed successfully")
            
            return Response(
                UserUploadedCaseDetailSerializer(upload).data,
                status=status.HTTP_201_CREATED
            )
            
        except Exception as e:
            logger.error(f"Error processing upload: {str(e)}", exc_info=True)
            upload.processing_status = 'FAILED'
            upload.error_message = str(e)
            upload.save()
            
            return Response(
                {
                    'error': 'Lỗi xử lý ảnh',
                    'message': str(e),
                    'upload_id': upload.id if 'upload' in locals() else None
                },
                status=status.HTTP_400_BAD_REQUEST
            )
    
    @action(detail=True, methods=['post'])
    def start_practice(self, request, pk=None):
        """
        Bắt đầu luyện tập với case từ upload
        
        POST /api/v1/uploaded-cases/{id}/start_practice/
        
        Returns:
            Session object đã được tạo
        """
        upload = self.get_object()
        
        if upload.processing_status != 'SUCCESS':
            return Response(
                {'error': f'Upload chưa được xử lý thành công. Status: {upload.processing_status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not upload.created_case:
            return Response(
                {'error': 'Case chưa được tạo'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        import uuid as _uuid
        user_uuid = str(_uuid.uuid5(_uuid.NAMESPACE_DNS, f'sara_user_{request.user.id}'))
        supabase_case_id = upload.ai_findings.get('supabase_case_id') or str(
            _uuid.uuid5(_uuid.NAMESPACE_DNS, f'uploaded_case_{upload.created_case.id}')
        )
        sb = get_supabase()
        result = sb.table('sessions').insert({
            'user_id': user_uuid,
            'case_id': supabase_case_id,
            'current_step': 0,
            'status': 'IN_PROGRESS',
        }).execute()
        session = result.data[0]

        logger.info(f"Started practice session {session['id']} for user {request.user.username}")

        return Response(session, status=status.HTTP_201_CREATED)
    
    @action(detail=True, methods=['get'])
    def findings(self, request, pk=None):
        """
        Xem AI findings chi tiết (chỉ sau khi xử lý thành công)
        
        GET /api/v1/uploaded-cases/{id}/findings/
        """
        upload = self.get_object()
        
        if upload.processing_status != 'SUCCESS':
            return Response(
                {'error': f'Upload chưa được xử lý. Status: {upload.processing_status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        findings = upload.ai_findings
        
        return Response({
            'upload_id': upload.id,
            'title': upload.title,
            'modality': upload.modality,
            'clinical_history': findings.get('clinical_history'),
            'answer_key_steps': list(findings.get('answer_key', {}).keys()),
            'answer_key_count': len(findings.get('answer_key', {})),
            'created_case_id': upload.created_case.id if upload.created_case else None
        })
