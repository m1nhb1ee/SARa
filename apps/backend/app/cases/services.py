import uuid
from app.core.supabase_client import get_supabase

MODALITY_FILTER_ALIASES = {
    'XRAY': 'X-ray',
    'X-RAY': 'X-ray',
    'X-ray': 'X-ray',
    'CT': 'CT',
    'MRI': 'MRI',
    'ULTRASOUND': 'Ultrasound',
    'Ultrasound': 'Ultrasound',
}

DIFFICULTY_FILTER_ALIASES = {
    'BASIC': 'easy',
    'INTERMEDIATE': 'medium',
    'ADVANCED': 'hard',
    'easy': 'easy',
    'medium': 'medium',
    'hard': 'hard',
}


def list_disease_tags() -> list:
    sb = get_supabase()
    result = sb.table('disease_profiles').select(
        'disease_tag, expected_findings, common_errors, ddx_list, clinical_notes'
    ).order('disease_tag').execute()
    return result.data or []


def _flatten_images(case: dict) -> dict:
    case['images'] = case.pop('case_images', None) or []
    return case


def list_cases(user_id: str, modality=None, difficulty=None, disease_tag=None, status_filter=None) -> list:
    sb = get_supabase()
    query = sb.table('cases').select(
        'id, title, modality, difficulty, clinical_history, disease_tag, status, tags, created_at, uploaded_by, case_images(image_url, slice_index)'
    ).or_(f'uploaded_by.eq.{user_id},uploaded_by.is.null')
    if status_filter:
        query = query.eq('status', status_filter)
    if modality:
        query = query.eq('modality', MODALITY_FILTER_ALIASES.get(modality, modality))
    if difficulty:
        query = query.eq('difficulty', DIFFICULTY_FILTER_ALIASES.get(difficulty, difficulty))
    if disease_tag:
        query = query.eq('disease_tag', disease_tag)
    result = query.order('created_at', desc=True).execute()
    return [_flatten_images(c) for c in (result.data or [])]


def get_case(case_id: str) -> dict | None:
    try:
        uuid.UUID(str(case_id).strip())
    except ValueError:
        return None
    sb = get_supabase()
    try:
        result = sb.table('cases').select(
            'id, title, modality, difficulty, clinical_history, disease_tag, status, tags, created_at, uploaded_by, case_images(image_url, slice_index)'
        ).eq('id', case_id).single().execute()
        return _flatten_images(result.data)
    except Exception:
        return None
