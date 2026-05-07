from django.urls import path
from rest_framework.routers import DefaultRouter

from app.cases.views import CaseViewSet, CaseTagViewSet
from app.sessions.views import SessionViewSet, StudentPerformanceViewSet
from app.uploads.views import UserUploadedCaseViewSet, VLMAnswerView
from app.swap.views import SwapSessionViewSet
from app.auth.views import LoginView, MeView, LogoutView, RegisterView

router = DefaultRouter()
router.register('cases', CaseViewSet, basename='cases')
router.register('tags', CaseTagViewSet, basename='tags')
router.register('sessions', SessionViewSet, basename='sessions')
router.register('performance', StudentPerformanceViewSet, basename='performance')
router.register('uploaded-cases', UserUploadedCaseViewSet, basename='uploaded-cases')
router.register('swap-sessions', SwapSessionViewSet, basename='swap-sessions')

urlpatterns = router.urls + [
    path('vlm-answer/', VLMAnswerView.as_view()),
    path('auth/register/', RegisterView.as_view()),
    path('auth/login/', LoginView.as_view()),
    path('auth/me/', MeView.as_view()),
    path('auth/logout/', LogoutView.as_view()),
]
