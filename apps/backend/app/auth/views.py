from rest_framework.views import APIView
import logging
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated

from app.core.supabase_client import get_supabase


def _ensure_user_profile(sb, user, full_name: str = '') -> None:
    role = (user.app_metadata or {}).get('role', 'student')
    payload = {
        'id': str(user.id),
        'email': user.email,
        'full_name': full_name or '',
        'role': role,
    }
    sb.table('users').upsert(payload, on_conflict='id').execute()


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '').strip()
        full_name = request.data.get('full_name', '').strip()

        if not email or not password:
            return Response(
                {'error': 'Email và mật khẩu là bắt buộc'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(password) < 6:
            return Response(
                {'error': 'Mật khẩu phải có ít nhất 6 ký tự'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            sb = get_supabase()
            options = {'data': {'full_name': full_name}} if full_name else {}
            res = sb.auth.sign_up({'email': email, 'password': password, 'options': options})
            user = res.user
            session = res.session
            _ensure_user_profile(sb, user, full_name)

            if session:
                # Email confirmation disabled — user is signed in immediately
                role = (user.app_metadata or {}).get('role', 'student')
                return Response({
                    'user': {'id': str(user.id), 'email': user.email, 'role': role},
                    'access_token': session.access_token,
                    'refresh_token': session.refresh_token,
                    'expires_at': session.expires_at,
                }, status=status.HTTP_201_CREATED)
            else:
                # Email confirmation required
                return Response({
                    'message': 'Đăng ký thành công! Vui lòng check email',
                    'requires_confirmation': True,
                }, status=status.HTTP_201_CREATED)
        except Exception as e:
            logging.exception('RegisterView: error during sign_up')
            err = str(e).lower()
            if 'already registered' in err or 'already been registered' in err:
                return Response(
                    {'error': 'Email này đã được đăng ký'},
                    status=status.HTTP_409_CONFLICT,
                )
            return Response(
                {'error': 'Đăng ký thất bại. Vui lòng thử lại.'},
                status=status.HTTP_400_BAD_REQUEST,
            )


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = request.data.get('email', '').strip()
        password = request.data.get('password', '').strip()

        if not email or not password:
            return Response(
                {'error': 'Email và mật khẩu là bắt buộc'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            sb = get_supabase()
            res = sb.auth.sign_in_with_password({'email': email, 'password': password})
            user = res.user
            session = res.session
            _ensure_user_profile(sb, user, (user.user_metadata or {}).get('full_name', ''))
            role = (user.app_metadata or {}).get('role', 'student')
            profile = sb.table('users').select('is_premium').eq('id', str(user.id)).single().execute()
            is_premium = bool((profile.data or {}).get('is_premium', False))
            return Response({
                'user': {
                    'id': str(user.id),
                    'email': user.email,
                    'role': role,
                    'is_premium': is_premium,
                },
                'access_token': session.access_token,
                'refresh_token': session.refresh_token,
                'expires_at': session.expires_at,
            })
        except Exception as e:
            logging.exception('LoginView: error during sign_in_with_password')
            err = str(e).lower()
            if 'email not confirmed' in err or 'not confirmed' in err:
                return Response(
                    {'error': 'Email chưa được xác nhận', 'requires_confirmation': True},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            return Response(
                {'error': 'Email hoặc mật khẩu không đúng'},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        sb = get_supabase()
        profile = sb.table('users').select('is_premium').eq('id', str(user['id'])).single().execute()
        is_premium = bool((profile.data or {}).get('is_premium', False))
        return Response({
            'user': {
                'id': user['id'],
                'email': user['email'],
                'full_name': user.get('full_name', ''),
                'role': user.get('role', 'student'),
                'is_premium': is_premium,
            }
        })


class LogoutView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        return Response({'success': True})
