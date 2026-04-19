"""
Custom middleware for development
"""

class SkipCSRFForAuthMiddleware:
    """Skip CSRF check for API endpoints in development"""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Skip CSRF for API endpoints (simplified for dev)
        if request.path.startswith('/api/'):
            request._dont_enforce_csrf_checks = True
        return self.get_response(request)
