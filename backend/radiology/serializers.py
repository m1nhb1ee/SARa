from rest_framework import serializers
from .models import Case, Session, StepAttempt, CaseTag, StudentPerformance
from django.contrib.auth.models import User


class CaseTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseTag
        fields = ['id', 'name', 'description']


class CaseListSerializer(serializers.ModelSerializer):
    tags = CaseTagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Case
        fields = ['id', 'title', 'modality', 'difficulty', 'description', 'tags', 'created_at']


class CaseDetailSerializer(serializers.ModelSerializer):
    tags = CaseTagSerializer(many=True, read_only=True)
    
    class Meta:
        model = Case
        fields = [
            'id', 'title', 'description', 'modality', 'difficulty', 
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
