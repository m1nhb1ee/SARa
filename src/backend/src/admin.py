from django.contrib import admin
from .models import Case, Session, StepAttempt, CaseTag, StudentPerformance


@admin.register(CaseTag)
class CaseTagAdmin(admin.ModelAdmin):
    list_display = ['name', 'description']
    search_fields = ['name']


@admin.register(Case)
class CaseAdmin(admin.ModelAdmin):
    list_display = ['title', 'modality', 'difficulty', 'is_active', 'created_at']
    list_filter = ['modality', 'difficulty', 'is_active', 'created_at']
    search_fields = ['title', 'description']
    filter_horizontal = ['tags']
    
    fieldsets = (
        ('Thông tin cơ bản', {
            'fields': ('title', 'description', 'modality', 'difficulty', 'tags')
        }),
        ('Lâm sàng', {
            'fields': ('clinical_history',)
        }),
        ('Pipeline & Đáp án', {
            'fields': ('pipeline_rubric', 'answer_key'),
            'classes': ('collapse',)
        }),
        ('Media', {
            'fields': ('image_urls',)
        }),
        ('Trạng thái', {
            'fields': ('is_active', 'created_at', 'updated_at'),
        }),
    )


@admin.register(Session)
class SessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'case', 'status', 'current_step', 'total_score', 'started_at']
    list_filter = ['status', 'started_at', 'case__modality']
    search_fields = ['user__username', 'case__title']
    readonly_fields = ['user', 'case', 'started_at', 'completed_at']
    
    fieldsets = (
        ('Thông tin phiên', {
            'fields': ('user', 'case', 'status')
        }),
        ('Tiến trình', {
            'fields': ('current_step', 'step_history', 'total_score')
        }),
        ('AI', {
            'fields': ('cv_findings',),
            'classes': ('collapse',)
        }),
        ('Thời gian', {
            'fields': ('started_at', 'completed_at'),
        }),
    )


@admin.register(StepAttempt)
class StepAttemptAdmin(admin.ModelAdmin):
    list_display = ['session', 'step_name', 'score', 'created_at']
    list_filter = ['step_name', 'score', 'created_at']
    search_fields = ['session__user__username', 'student_answer']
    readonly_fields = ['session', 'step_name', 'created_at']
    
    fieldsets = (
        ('Phiên làm bài', {
            'fields': ('session', 'step_name')
        }),
        ('Câu trả lời & Điểm', {
            'fields': ('student_answer', 'score')
        }),
        ('Feedback', {
            'fields': ('errors', 'feedback', 'latency_ms'),
            'classes': ('collapse',)
        }),
        ('Thời gian', {
            'fields': ('created_at',)
        }),
    )


@admin.register(StudentPerformance)
class StudentPerformanceAdmin(admin.ModelAdmin):
    list_display = ['user', 'total_cases_completed', 'average_score', 'last_activity']
    list_filter = ['last_activity']
    search_fields = ['user__username']
    readonly_fields = ['user']
