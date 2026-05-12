import os
import httpx
from rest_framework.authentication import BaseAuthentication
import logging
from rest_framework.exceptions import AuthenticationFailed
from app.core.supabase_client import get_supabase


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
            url = os.environ['SUPABASE_URL']
            key = os.environ['SUPABASE_SERVICE_KEY']
            resp = httpx.get(
                f"{url}/auth/v1/user",
                headers={'Authorization': f'Bearer {token}', 'apikey': key},
                timeout=10,
            )
            if resp.status_code != 200:
                # log response for debugging
                try:
                    logging.error('Supabase user lookup failed: status=%s body=%s', resp.status_code, resp.text)
                except Exception:
                    logging.exception('Supabase user lookup failed and resp.text could not be read')
                raise AuthenticationFailed('Invalid or expired Supabase token.')
            user = resp.json()
            role = (user.get('app_metadata') or {}).get('role', 'student')
            
            # Query users table để lấy full_name từ database (authoritative source)
            try:
                sb = get_supabase()
                user_record = sb.table('users').select('full_name').eq('id', user['id']).single().execute()
                full_name = user_record.data.get('full_name', '') if user_record.data else ''
            except Exception:
                full_name = ''
            
            return (
                SupabaseUser({'id': user['id'], 'email': user.get('email', ''), 'role': role, 'full_name': full_name}),
                token,
            )
        except AuthenticationFailed:
            raise
        except Exception:
            raise AuthenticationFailed('Invalid or expired Supabase token.')

    def authenticate_header(self, request):
        return 'Bearer'
