from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import StudentPerformance


@receiver(post_save, sender=User)
def create_student_performance(sender, instance, created, **kwargs):
    """Tự động tạo StudentPerformance khi tạo User mới"""
    if created:
        StudentPerformance.objects.get_or_create(user=instance)
