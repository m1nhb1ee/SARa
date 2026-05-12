import uuid
from app.core.supabase_client import get_supabase

MODALITY_FILTER_ALIASES = {
    'XRAY': 'X-ray',
    'X-RAY': 'X-ray',
    'X-ray': 'X-ray',
    'CT': 'CT',
    'MRI': 'MRI',

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


def _group_images(case: dict) -> dict:
    raw = case.pop('case_images', None) or []
    volumes: dict = {}
    for img in raw:
        vol = img.get('volume_name') or 'Default'
        if vol not in volumes:
            volumes[vol] = []
        volumes[vol].append({'image_url': img['image_url'], 'slice_index': img.get('slice_index')})
    case['images'] = [
        {'volume_name': vol, 'slices': slices}
        for vol, slices in volumes.items()
    ]
    return case


def list_cases(user_id: str, source=None, modality=None, difficulty=None, disease_tag=None, status_filter=None, is_valid=None) -> list:
    sb = get_supabase()
    query = sb.table('cases').select(
        'id, title, modality, difficulty, clinical_history, disease_tag, status, source, tags, created_at, uploaded_by, is_valid, case_images(image_url, slice_index, volume_name)'
    )
    if source == 'system':
        query = query.eq('source', 'system')
    elif source == 'uploaded':
        query = query.eq('source', 'uploaded').eq('uploaded_by', user_id)
    else:
        query = query.or_(f'uploaded_by.eq.{user_id},uploaded_by.is.null')
    if status_filter:
        query = query.eq('status', status_filter)
    if modality:
        query = query.eq('modality', MODALITY_FILTER_ALIASES.get(modality, modality))
    if difficulty:
        query = query.eq('difficulty', DIFFICULTY_FILTER_ALIASES.get(difficulty, difficulty))
    if disease_tag:
        query = query.eq('disease_tag', disease_tag)
    if is_valid is not None:
        query = query.eq('is_valid', str(is_valid).lower() in ('true', '1', 'yes'))
    result = query.order('created_at', desc=True).execute()
    return [_group_images(c) for c in (result.data or [])]


def get_case(case_id: str) -> dict | None:
    try:
        uuid.UUID(str(case_id).strip())
    except ValueError:
        return None
    sb = get_supabase()
    try:
        result = sb.table('cases').select(
            'id, title, modality, difficulty, clinical_history, disease_tag, status, source, tags, created_at, uploaded_by, is_valid, case_images(image_url, slice_index, volume_name)'
        ).eq('id', case_id).single().execute()
        return _group_images(result.data)
    except Exception:
        return None
