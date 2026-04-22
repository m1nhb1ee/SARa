from rest_framework import serializers
from .models import Case, Session, StepAttempt, CaseTag, StudentPerformance, UserUploadedCase
from django.contrib.auth.models import User


class CaseTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseTag
        fields = ['id', 'name', 'description']


class CaseListSerializer(serializers.ModelSerializer):
    tags = CaseTagSerializer(many=True, read_only=True)

    class Meta:
        model = Case
        fields = ['id', 'title', 'modality', 'difficulty', 'tags', 'image_urls', 'created_at']


class CaseDetailSerializer(serializers.ModelSerializer):
    tags = CaseTagSerializer(many=True, read_only=True)

    class Meta:
        model = Case
        fields = [
            'id', 'title', 'modality', 'difficulty',
            'clinical_history', 'image_urls', 'tags', 'created_at', 'updated_at'
        ]
        # Không expose answer_key và pipeline_rubric cho student (giữ kín)
        read_only_fields = fields


class StepAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = StepAttempt
        fields = [
            'id', 'step_index', 'step_name', 'student_answer', 
            'score', 'errors', 'feedback', 'latency_ms', 'created_at'
        ]


class SessionDetailSerializer(serializers.ModelSerializer):
    case = CaseDetailSerializer(read_only=True)
    step_attempts = StepAttemptSerializer(many=True, read_only=True)
    
    class Meta:
        model = Session
        fields = [
            'id', 'case', 'current_step', 'status', 'step_history',
            'total_score', 'started_at', 'completed_at', 'step_attempts'
        ]


class SessionListSerializer(serializers.ModelSerializer):
    case_title = serializers.CharField(source='case.title', read_only=True)
    
    class Meta:
        model = Session
        fields = [
            'id', 'case', 'case_title', 'current_step', 'status',
            'total_score', 'started_at', 'completed_at'
        ]


class SessionCreateSerializer(serializers.ModelSerializer):
    """Serializer để tạo session mới"""
    class Meta:
        model = Session
        fields = ['case']


class SessionStepAnswersSerializer(serializers.Serializer):
    """Serializer để trả về đáp án cho từng step của case"""
    session_id = serializers.IntegerField()
    case_id = serializers.IntegerField()
    case_title = serializers.CharField()
    case_modality = serializers.CharField()
    current_step = serializers.IntegerField()
    status = serializers.CharField()
    answers = serializers.DictField(
        child=serializers.CharField(),
        help_text="Dict của {OBSERVE, DESCRIBE, INTERPRET, HYPOTHESIS, DDx, CONCLUSION}"
    )
    step_templates = serializers.DictField(
        child=serializers.CharField(),
        help_text="Rubric/template cho từng step"
    )


class StepAnswerSubmitSerializer(serializers.Serializer):
    """Serializer để submit câu trả lời cho một step"""
    student_answer = serializers.CharField(required=True)
    
    def validate_student_answer(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Vui lòng cung cấp câu trả lời chi tiết hơn")
        return value


class StudentPerformanceSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = StudentPerformance
        fields = [
            'username', 'total_cases_completed', 'average_score',
            'accuracy_by_step', 'last_activity'
        ]


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'date_joined']


# UserUploadedCase Serializers
class UserUploadedCaseListSerializer(serializers.ModelSerializer):
    """List view cho uploaded cases"""
    processing_status_display = serializers.SerializerMethodField()
    created_case_id = serializers.SerializerMethodField()
    
    class Meta:
        model = UserUploadedCase
        fields = [
            'id', 'title', 'modality', 'processing_status', 'processing_status_display',
            'created_case_id', 'error_message', 'created_at', 'image_url', 'original_image'
        ]
        read_only_fields = fields
    
    def get_processing_status_display(self, obj):
        return obj.get_processing_status_display()
    
    def get_created_case_id(self, obj):
        return obj.created_case.id if obj.created_case else None


class UserUploadedCaseDetailSerializer(serializers.ModelSerializer):
    """Detail view - show all findings"""
    processing_status_display = serializers.SerializerMethodField()
    created_case_id = serializers.SerializerMethodField()
    created_case = CaseDetailSerializer(read_only=True)
    
    class Meta:
        model = UserUploadedCase
        fields = [
            'id', 'title', 'modality', 'ai_findings',
            'processing_status', 'processing_status_display', 'error_message',
            'created_case_id', 'created_case', 'created_at', 'image_url', 'original_image'
        ]
        read_only_fields = [
            'ai_findings', 'processing_status', 'error_message', 
            'created_case', 'created_at', 'original_image'
        ]
    
    def get_processing_status_display(self, obj):
        return obj.get_processing_status_display()
    
    def get_created_case_id(self, obj):
        return obj.created_case.id if obj.created_case else None


class UserUploadedCaseUploadSerializer(serializers.ModelSerializer):
    """For upload endpoint - accept image file"""
    class Meta:
        model = UserUploadedCase
        fields = ['original_image', 'title', 'modality']
    
    def validate_modality(self, value):
        if not value:
            return 'XRAY'  # Default to XRAY
        return value
    
    def validate_original_image(self, value):
        # Validate image format
        allowed_formats = ('jpg', 'jpeg', 'png', 'gif', 'bmp')
        if hasattr(value, 'name'):
            ext = value.name.lower().split('.')[-1]
            if ext not in allowed_formats:
                raise serializers.ValidationError(f"Image format {ext} not allowed. Allowed: {allowed_formats}")
        return value
