import uuid
from rest_framework import status
from rest_framework.response import Response


def validate_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value).strip())
        return True
    except ValueError:
        return False


def get_session(sb, pk: str, user_id: str):
    """Fetch session và verify ownership. Returns (session_dict, error_response)."""
    if not validate_uuid(pk):
        return None, Response(
            {'error': f'Invalid session id: {repr(pk)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        result = sb.table('sessions').select(
            'id, user_id, case_id, current_step, status, final_score, started_at, completed_at'
        ).eq('id', pk).single().execute()
    except Exception:
        return None, Response({'error': 'Session not found'}, status=status.HTTP_404_NOT_FOUND)
    if result.data.get('user_id') != user_id:
        return None, Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    return result.data, None


def get_rubric_id(sb, step_code: str) -> str | None:
    try:
        r = sb.table('step_rubrics').select('id').eq('step_code', step_code).single().execute()
        return r.data['id']
    except Exception:
        return None
