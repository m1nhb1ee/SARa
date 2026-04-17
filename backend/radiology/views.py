from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action, api_view
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
import time
import json

from .models import Case, Session, StepAttempt, CaseTag, StudentPerformance
from .serializers import (
    CaseListSerializer, CaseDetailSerializer, SessionListSerializer,
    SessionDetailSerializer, SessionCreateSerializer, StepAnswerSubmitSerializer,
    StepAttemptSerializer, StudentPerformanceSerializer, CaseTagSerializer
)
from .ai_services import MockAIAgent


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
        
        # Gọi AI Agent để đánh giá (Mock)
        start_time = time.time()
        ai_feedback = MockAIAgent.evaluate_answer(
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
            socratic_hint = MockAIAgent.generate_socratic_hint(
                case=case,
                step_index=current_step,
                errors=ai_feedback.get('errors', [])
            )
            response_data['hint'] = socratic_hint
            response_data['message'] = 'Chưa đúng. Hãy xem gợi ý và thử lại.'
        
        return Response(response_data, status=status.HTTP_200_OK)
    
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


@api_view(['POST'])
def analyze_image_view(request):
    """Test endpoint for MedGemma image analysis — accepts multipart file upload"""
    image_file = request.FILES.get('image')
    if not image_file:
        return Response({'error': 'image file is required'}, status=status.HTTP_400_BAD_REQUEST)
    result = MockAIAgent.analyze_image(image_file)
    return Response(result)


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
