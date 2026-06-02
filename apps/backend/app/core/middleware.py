from app.core.supabase_client import set_request_jwt, reset_request_jwt


class SupabaseJWTContextMiddleware:
    """Bind the incoming Bearer token to a contextvar so get_supabase() can
    return a client authenticated as the user (required when SUPABASE_SERVICE_KEY
    is actually an anon key — RLS policies need auth.uid())."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = None
        auth = request.META.get('HTTP_AUTHORIZATION', '')
        if auth.startswith('Bearer '):
            token = auth.split(' ', 1)[1].strip() or None

        marker = set_request_jwt(token)
        try:
            return self.get_response(request)
        finally:
            reset_request_jwt(marker)
