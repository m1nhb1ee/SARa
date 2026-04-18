from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import time
import json
import os
import logging
from django.utils import timezone

from .models import Case, Session, StepAttempt, CaseTag, StudentPerformance, UserUploadedCase
from .serializers import (
    CaseListSerializer, CaseDetailSerializer, SessionListSerializer,
    SessionDetailSerializer, SessionCreateSerializer, SessionStepAnswersSerializer,
    StepAnswerSubmitSerializer, StepAttemptSerializer, StudentPerformanceSerializer, CaseTagSerializer,
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


class CaseViewSet(viewsets.ReadOnlyModelViewSet):
    """API cho Case - chỉ xem, không expose answer key"""
    queryset = Case.objects.filter(is_active=True)
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['modality', 'difficulty']
    search_fields = ['title', 'description', 'clinical_history']
    ordering_fields = ['created_at', 'difficulty']
    ordering = ['-created_at']
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CaseDetailSerializer
        return CaseListSerializer


class SessionViewSet(viewsets.ModelViewSet):
    """API quản lý Session học tập"""
    serializer_class = SessionListSerializer
    pagination_class = StandardPagination
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['status', 'case']
    ordering_fields = ['started_at']
    ordering = ['-started_at']
    
    def get_queryset(self):
        """Mỗi user chỉ thấy session của mình"""
        return Session.objects.filter(user=self.request.user)
    
    def get_serializer_class(self):
        if self.action == 'retrieve':
            return SessionDetailSerializer
        elif self.action == 'create':
            return SessionCreateSerializer
        return SessionListSerializer
    
    def perform_create(self, serializer):
        """Tạo session mới cho user hiện tại"""
        serializer.save(user=self.request.user)
    
    def create(self, request, *args, **kwargs):
        """Override create để return SessionListSerializer response"""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        
        # Return SessionListSerializer response instead of SessionCreateSerializer
        return Response(
            SessionListSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
            headers={'Location': f"/api/v1/sessions/{serializer.instance.id}/"}
        )
    
    @action(detail=True, methods=['post'])
    def submit_answer(self, request, pk=None):
        """Submit câu trả lời cho step hiện tại"""
        session = self.get_object()
        
        # Kiểm tra session này thuộc user hiện tại
        if session.user != request.user:
            return Response(
                {'error': 'Unauthorized'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if session.status != 'IN_PROGRESS':
            return Response(
                {'error': 'Session đã kết thúc'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate input
        serializer = StepAnswerSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        student_answer = serializer.validated_data['student_answer']
        current_step = session.current_step
        case = session.case
        
        # Gọi AI Agent để đánh giá (OpenAI hoặc Mock)
        start_time = time.time()
        ai_agent = get_ai_agent()
        ai_feedback = ai_agent.evaluate_answer(
            case=case,
            step_index=current_step,
            student_answer=student_answer,
            cv_findings=session.cv_findings
        )
        latency_ms = int((time.time() - start_time) * 1000)
        
        # Lưu step attempt
        step_attempt = StepAttempt.objects.create(
            session=session,
            step_index=current_step,
            student_answer=student_answer,
            score=ai_feedback['score'],
            errors=ai_feedback.get('errors', []),
            feedback=ai_feedback.get('feedback', {}),
            latency_ms=latency_ms
        )
        
        # Kiểm tra điểm số >= 0.6 để chuyển bước
        response_data = {
            'attempt': StepAttemptSerializer(step_attempt).data,
            'passed': ai_feedback['score'] >= 0.6,
        }
        
        if ai_feedback['score'] >= 0.6 and current_step < 5:
            # Chuyển sang bước tiếp theo
            session.current_step += 1
            session.save()
            response_data['next_step'] = session.current_step
            response_data['message'] = 'Đáp án số được! Chuyển sang bước tiếp theo.'
        elif current_step == 5 and ai_feedback['score'] >= 0.6:
            # Hoàn thành session
            session.status = 'COMPLETED'
            session.total_score = sum([
                sa.score for sa in session.step_attempts.all()
            ]) / 6
            from django.utils import timezone
            session.completed_at = timezone.now()
            session.save()
            
            # Cập nhật performance
            perf, _ = StudentPerformance.objects.get_or_create(user=request.user)
            perf.total_cases_completed += 1
            perf.last_activity = timezone.now()
            perf.save()
            
            response_data['message'] = 'Chúc mừng! Hoàn thành case này.'
            response_data['session_complete'] = True
        else:
            # Không đạt - gợi ý Socratic
            ai_agent = get_ai_agent()
            socratic_hint = ai_agent.generate_socratic_hint(
                case=case,
                step_index=current_step,
                errors=ai_feedback.get('errors', [])
            )
            response_data['hint'] = socratic_hint
            response_data['message'] = 'Chưa đúng. Hãy xem gợi ý và thử lại.'
        
        return Response(response_data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['post'])
    def exit_session(self, request, pk=None):
        """Thoát khỏi session đang làm - lưu progress"""
        session = self.get_object()
        
        # Kiểm tra session này thuộc user hiện tại
        if session.user != request.user:
            return Response(
                {'error': 'Unauthorized'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Chỉ cho phép thoát nếu session đang diễn hành
        if session.status != 'IN_PROGRESS':
            return Response(
                {'error': 'Không thể thoát khỏi session này'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Lưu session với trạng thái ABANDONED
        from django.utils import timezone
        session.status = 'ABANDONED'
        session.completed_at = timezone.now()
        session.save()
        
        return Response({
            'success': True,
            'message': 'Session đã được lưu và thoát thành công',
            'session_id': session.id,
            'last_step': session.current_step,
            'timestamp': session.completed_at
        }, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get'])
    def step_answers(self, request, pk=None):
        """
        Lấy đáp án từng step cho case - accessible anytime (IN_PROGRESS, COMPLETED, etc.)
        
        GET /api/v1/sessions/{session_id}/step_answers/
        
        Response:
        {
            "session_id": 83,
            "case_id": 39,
            "case_title": "CT Case – MedGemma",
            "case_modality": "CT",
            "current_step": 0,
            "status": "IN_PROGRESS",
            "answers": {
                "OBSERVE": "Não bình thường, không thấy máu tụ...",
                "DESCRIBE": "Các thất não bình thường...",
                ...
            },
            "step_templates": {
                "OBSERVE": "Quan sát kỹ lưỡng các vùng của ảnh...",
                ...
            }
        }
        """
        session = self.get_object()
        
        # Kiểm tra user authorization
        if session.user != request.user:
            return Response(
                {'error': 'Unauthorized'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        case = session.case
        
        # Trả về đáp án + templates
        data = {
            'session_id': session.id,
            'case_id': case.id,
            'case_title': case.title,
            'case_modality': case.modality,
            'current_step': session.current_step,
            'status': session.status,
            'answers': case.answer_key or {},
            'step_templates': case.pipeline_rubric or {},
        }
        
        return Response(data, status=status.HTTP_200_OK)
    
    @action(detail=True, methods=['get'])
    def answer_key(self, request, pk=None):
        """Xem đáp án - chỉ sau khi hoàn thành"""
        session = self.get_object()
        
        if session.user != request.user:
            return Response(
                {'error': 'Unauthorized'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        if session.status != 'COMPLETED':
            return Response(
                {'error': 'Chỉ xem được đáp án sau khi hoàn thành.'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        return Response({
            'answer_key': session.case.answer_key,
            'explanation': session.case.answer_key.get('explanation', 'N/A'),
            'your_score': session.total_score,
            'details': [
                {
                    'step': sa.step_name,
                    'score': sa.score,
                    'feedback': sa.feedback
                }
                for sa in session.step_attempts.all()
            ]
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
        """Lấy thống kê cá nhân"""
        perf, _ = StudentPerformance.objects.get_or_create(user=request.user)
        return Response(StudentPerformanceSerializer(perf).data)


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
            - modality: XRAY|CT|MRI|ULTRASOUND (optional, default='XRAY')
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
            
            # Lưu findings
            upload.ai_findings = findings
            
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
        
        # Tạo Session
        session = Session.objects.create(
            user=request.user,
            case=upload.created_case,
            status='IN_PROGRESS'
        )
        
        logger.info(f"Started practice session {session.id} for user {request.user.username}")
        
        return Response(
            SessionDetailSerializer(session).data,
            status=status.HTTP_201_CREATED
        )
    
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
