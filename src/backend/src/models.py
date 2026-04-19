from django.db import models
from django.contrib.auth.models import User
from django.contrib.postgres.fields import ArrayField
import json


class CaseTag(models.Model):
    """Tag để phân loại case (Chest, Neuro, MSK, v.v.)"""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    
    class Meta:
        ordering = ['name']
    
    def __str__(self):
        return self.name


class Case(models.Model):
    """Case học tập chứa ảnh y tế và lịch sử lâm sàng"""
    MODALITY_CHOICES = [
        ('XRAY', 'X-Ray'),
        ('CT', 'CT Scan'),
        ('MRI', 'MRI'),
        ('DIFF', 'Different'),
    ]
    
    DIFFICULTY_CHOICES = [
        ('BASIC', 'Cơ bản'),
        ('INTERMEDIATE', 'Trung bình'),
        ('ADVANCED', 'Nâng cao'),
    ]

    title = models.CharField(max_length=255)
    description = models.TextField()
    modality = models.CharField(max_length=50, choices=MODALITY_CHOICES)
    difficulty = models.CharField(max_length=20, choices=DIFFICULTY_CHOICES, default='INTERMEDIATE')
    clinical_history = models.TextField(help_text="Lịch sử lâm sàng 2-3 dòng")

    # Pipeline rubric - JSON định nghĩa tiêu chí đánh giá từng bước
    pipeline_rubric = models.JSONField(default=dict)

    # Answer key - JSON chứa đáp án chuẩn theo từng bước
    answer_key = models.JSONField(default=dict)

    # Media URLs
    image_urls = models.JSONField(default=list, help_text="List URLs của ảnh y tế")

    # Tags
    tags = models.ManyToManyField(CaseTag, blank=True)

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.title} ({self.get_modality_display()})"


class Session(models.Model):
    """Session luyện tập của sinh viên cho một case"""
    STATUS_CHOICES = [
        ('IN_PROGRESS', 'Đang làm'),
        ('COMPLETED', 'Hoàn thành'),
        ('ABANDONED', 'Bỏ cuộc'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='radiology_sessions')
    case = models.ForeignKey(Case, on_delete=models.CASCADE, related_name='sessions')
    
    current_step = models.IntegerField(default=0, help_text="0=OBSERVE, 1=DESCRIBE, ..., 5=CONCLUSION")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='IN_PROGRESS')
    
    # Pipeline steps - theo dõi hoàn thành
    step_history = models.JSONField(default=list, help_text="[{step: 0, attempts: 1, score: 0.85}, ...]")
    
    # CV Agent findings cache
    cv_findings = models.JSONField(default=dict, help_text="{regions: [], anomalies: [], ...}")
    
    total_score = models.FloatField(default=0.0)
    
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        ordering = ['-started_at']
        unique_together = ['user', 'case', 'started_at']
    
    def __str__(self):
        return f"{self.user.username} - {self.case.title} ({self.status})"


class StepAttempt(models.Model):
    """Mỗi lần sinh viên trả lời một bước trong pipeline"""
    STEP_NAMES = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']
    
    session = models.ForeignKey(Session, on_delete=models.CASCADE, related_name='step_attempts')
    
    step_index = models.IntegerField(help_text="0-5 tương ứng với các bước")
    step_name = models.CharField(max_length=50, editable=False)
    
    student_answer = models.TextField()
    score = models.FloatField(help_text="0.0 - 1.0")
    
    # Feedback từ AI
    errors = models.JSONField(default=list, help_text="['error1', 'error2', ...]")
    feedback = models.JSONField(default=dict, help_text="{type: 'error'|'hint', content: '...'}")
    
    latency_ms = models.IntegerField(default=0, help_text="Response time từ AI")
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['step_index']
    
    def save(self, *args, **kwargs):
        if 0 <= self.step_index < len(self.STEP_NAMES):
            self.step_name = self.STEP_NAMES[self.step_index]
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Session {self.session.id} - Step {self.step_index} ({self.step_name})"


class StudentPerformance(models.Model):
    """Thống kê hiệu suất của sinh viên"""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='radiology_performance')
    
    total_cases_completed = models.IntegerField(default=0)
    average_score = models.FloatField(default=0.0)
    accuracy_by_step = models.JSONField(default=dict, help_text="{step_index: accuracy}")
    
    last_activity = models.DateTimeField(null=True, blank=True)
    
    def __str__(self):
        return f"Perf: {self.user.username}"


class UserUploadedCase(models.Model):
    """Case do người dùng upload - tự động parse bằng Hugging Face API"""
    STATUS_CHOICES = [
        ('PENDING', 'Chờ xử lý'),
        ('PROCESSING', 'Đang xử lý'),
        ('SUCCESS', 'Thành công'),
        ('FAILED', 'Thất bại'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='uploaded_cases')
    
    # File upload
    original_image = models.ImageField(upload_to='user_uploads/%Y/%m/%d/')
    image_url = models.URLField(blank=True, help_text="URL sau khi upload")
    
    # Metadata
    title = models.CharField(max_length=255, blank=True)
    modality = models.CharField(max_length=50, blank=True, choices=[
        ('XRAY', 'X-Ray'),
        ('CT', 'CT Scan'),
        ('MRI', 'MRI'),
        ('DIFF', 'Different'),
    ])
    
    # AI-generated findings
    ai_findings = models.JSONField(default=dict, help_text="Findings từ HF model")
    
    # Status tracking
    processing_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    error_message = models.TextField(blank=True, help_text="Lỗi nếu có")
    
    # Linked Case
    created_case = models.OneToOneField(
        Case, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='uploaded_from'
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"Upload by {self.user.username} - {self.title} ({self.processing_status})"
