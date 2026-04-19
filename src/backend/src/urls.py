from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views, auth_views

router = DefaultRouter()
router.register(r'cases', views.CaseViewSet, basename='case')
router.register(r'sessions', views.SessionViewSet, basename='session')
router.register(r'tags', views.CaseTagViewSet, basename='tag')
router.register(r'performance', views.StudentPerformanceViewSet, basename='performance')
router.register(r'uploaded-cases', views.UserUploadedCaseViewSet, basename='uploaded-case')

urlpatterns = [
    path('', include(router.urls)),
    
    # Auth endpoints
    path('auth/login/', auth_views.login_view, name='auth_login'),
    path('auth/logout/', auth_views.logout_view, name='auth_logout'),
    path('auth/me/', auth_views.me_view, name='auth_me'),
]
