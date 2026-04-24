from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from .supabase_client import get_supabase


class SupabaseUser:
    """Wrapper cho Supabase user dict — tương thích DRF IsAuthenticated."""
    is_authenticated = True
    is_anonymous = False

    def __init__(self, data: dict):
        self._data = data

    def __getitem__(self, key):
        return self._data[key]

    def get(self, key, default=None):
        return self._data.get(key, default)

    def __repr__(self):
        return f"SupabaseUser(id={self._data.get('id')}, email={self._data.get('email')})"


class SupabaseJWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth.startswith('Bearer '):
            return None
        token = auth.split(' ', 1)[1].strip()
        if not token:
            return None
        try:
            sb = get_supabase()
            resp = sb.auth.get_user(token)
            user = resp.user
            role = (user.app_metadata or {}).get('role', 'student')
            return (
                SupabaseUser({'id': str(user.id), 'email': user.email, 'role': role}),
                token,
            )
        except Exception:
            raise AuthenticationFailed('Invalid or expired Supabase token.')

    def authenticate_header(self, request):
        return 'Bearer'
