import os
from contextvars import ContextVar

from supabase import create_client, Client

_client: Client | None = None
_current_jwt: ContextVar[str | None] = ContextVar("supabase_jwt", default=None)


def _config() -> tuple[str, str]:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return url, key


def set_request_jwt(token: str | None) -> object:
    """Bind the current request's user JWT so subsequent get_supabase() calls
    return a client that authenticates as that user (so RLS auth.uid() works).
    Returns a token usable with reset_request_jwt()."""
    return _current_jwt.set(token)


def reset_request_jwt(token: object) -> None:
    _current_jwt.reset(token)  # type: ignore[arg-type]


def get_supabase() -> Client:
    """Return a Supabase client.

    If a request JWT was bound via set_request_jwt(), a fresh per-call client
    is returned with that JWT applied (RLS policies see auth.uid() == user.id).
    Otherwise a cached anonymous client is returned.
    """
    jwt = _current_jwt.get()
    if jwt:
        url, key = _config()
        client = create_client(url, key)
        try:
            client.postgrest.auth(jwt)
        except Exception:
            pass
        return client

    global _client
    if _client is None:
        url, key = _config()
        _client = create_client(url, key)
    return _client
