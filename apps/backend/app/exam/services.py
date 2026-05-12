from datetime import datetime, timezone
from typing import Any

from rest_framework import status
from rest_framework.response import Response

from app.agents.ai_services import evaluate_answer
from app.core.step_codes import STEP_CODES, index_by_canonical_step
from app.core.supabase_client import get_supabase

EXAM_STEP_SECONDS = 300


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _group_images(case: dict) -> dict:
    raw = case.pop('case_images', None) or []
    volumes: dict[str, list[dict]] = {}
    for img in raw:
        volume = img.get('volume_name') or 'Default'
        volumes.setdefault(volume, []).append({
            'image_url': img.get('image_url'),
            'slice_index': img.get('slice_index'),
        })
    case['images'] = [{'volume_name': name, 'slices': slices} for name, slices in volumes.items()]
    return case


def _case_select() -> str:
    return (
        'id, title, modality, difficulty, clinical_history, disease_tag, status, '
        'source, tags, created_at, uploaded_by, is_valid, is_exam, '
        'case_images(image_url, slice_index, volume_name)'
    )


def list_exam_cases(user_id: str) -> list[dict]:
    sb = get_supabase()
    rows = sb.table('cases').select(_case_select()).eq('is_exam', True).order('created_at', desc=True).execute().data or []
    return [_group_images(row) for row in rows if not row.get('uploaded_by') or row.get('uploaded_by') == user_id]


def list_exam_sessions(user_id: str) -> list[dict]:
    sb = get_supabase()
    return sb.table('exam_sessions').select(
        'id, case_id, status, final_score, completed_at, created_at'
    ).eq('user_id', user_id).order('created_at', desc=True).execute().data or []


def _get_exam_case(case_id: str, user_id: str) -> tuple[dict | None, Response | None]:
    sb = get_supabase()
    try:
        case = sb.table('cases').select(_case_select()).eq('id', case_id).single().execute().data
    except Exception:
        return None, Response({'error': 'Exam case not found'}, status=status.HTTP_404_NOT_FOUND)
    if not case.get('is_exam'):
        return None, Response({'error': 'Case is not available for exam'}, status=status.HTTP_400_BAD_REQUEST)
    if case.get('uploaded_by') and case['uploaded_by'] != user_id:
        return None, Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    return _group_images(case), None


def _answer_key_for_case(case_id: str) -> dict[str, dict[str, Any]]:
    sb = get_supabase()
    rows = sb.table('answer_keys').select(
        'step_code, step_order, expected_finding, clinical_explanation, key_points'
    ).eq('case_id', case_id).order('step_order').execute().data or []
    return index_by_canonical_step(rows)


def _serialize_exam_session(session: dict) -> dict:
    sb = get_supabase()
    case, _ = _get_exam_case(session['case_id'], session['user_id'])
    attempts = sb.table('exam_step_attempts').select('*').eq(
        'exam_session_id', session['id']
    ).order('step_index').execute().data or []
    return {**session, 'case': case, 'step_attempts': attempts, 'step_codes': STEP_CODES}


def create_exam_session(case_id: str, user_id: str) -> tuple[dict | None, Response | None]:
    case, err = _get_exam_case(case_id, user_id)
    if err:
        return None, err
    answer_key = _answer_key_for_case(case_id)
    missing = [code for code in STEP_CODES if code not in answer_key]
    if missing:
        return None, Response({'error': 'Exam case answer key is incomplete', 'missing_steps': missing}, status=status.HTTP_400_BAD_REQUEST)
    sb = get_supabase()
    session = sb.table('exam_sessions').insert({
        'user_id': user_id,
        'case_id': case_id,
        'current_step': 0,
        'status': 'IN_PROGRESS',
    }).execute().data[0]
    sb.table('exam_step_attempts').insert([
        {
            'exam_session_id': session['id'],
            'step_index': idx,
            'step_code': code,
            'time_limit_seconds': EXAM_STEP_SECONDS,
        }
        for idx, code in enumerate(STEP_CODES)
    ]).execute()
    return _serialize_exam_session(session), None


def get_exam_session(session_id: str, user_id: str) -> tuple[dict | None, Response | None]:
    sb = get_supabase()
    try:
        session = sb.table('exam_sessions').select('*').eq('id', session_id).single().execute().data
    except Exception:
        return None, Response({'error': 'Exam session not found'}, status=status.HTTP_404_NOT_FOUND)
    if session['user_id'] != user_id:
        return None, Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    return _serialize_exam_session(session), None


def submit_exam_step(session_id: str, user_id: str, step_index: int, answer: str, time_spent_seconds: int | None = None) -> tuple[dict | None, Response | None]:
    data, err = get_exam_session(session_id, user_id)
    if err:
        return None, err
    if data['status'] != 'IN_PROGRESS':
        return None, Response({'error': 'Exam session is not in progress'}, status=status.HTTP_400_BAD_REQUEST)
    attempts = {a['step_index']: a for a in data.get('step_attempts') or []}
    attempt = attempts.get(step_index)
    if not attempt:
        return None, Response({'error': 'Invalid step'}, status=status.HTTP_400_BAD_REQUEST)
    spent = min(EXAM_STEP_SECONDS, int(time_spent_seconds if time_spent_seconds is not None else attempt.get('time_spent_seconds') or 0))
    if attempt.get('locked') or spent >= EXAM_STEP_SECONDS:
        spent = EXAM_STEP_SECONDS
        get_supabase().table('exam_step_attempts').update({
            'time_spent_seconds': spent,
            'locked': True,
            'updated_at': _now_iso(),
        }).eq('id', attempt['id']).execute()
        return None, Response({'error': 'Step time has expired'}, status=status.HTTP_400_BAD_REQUEST)
    sb = get_supabase()
    sb.table('exam_step_attempts').update({
        'answer': answer,
        'submitted_at': _now_iso(),
        'time_spent_seconds': spent,
        'locked': spent >= EXAM_STEP_SECONDS,
        'updated_at': _now_iso(),
    }).eq('id', attempt['id']).execute()
    if step_index >= data.get('current_step', 0) and step_index < len(STEP_CODES) - 1:
        sb.table('exam_sessions').update({'current_step': step_index + 1}).eq('id', session_id).execute()
    updated, updated_err = get_exam_session(session_id, user_id)
    if updated_err:
        return None, updated_err
    return updated, None


def complete_exam_session(session_id: str, user_id: str) -> tuple[dict | None, Response | None]:
    data, err = get_exam_session(session_id, user_id)
    if err:
        return None, err
    if data['status'] != 'IN_PROGRESS':
        return None, Response({'error': 'Exam session is not in progress'}, status=status.HTTP_400_BAD_REQUEST)
    attempts = sorted(data.get('step_attempts') or [], key=lambda a: a['step_index'])
    missing = [STEP_CODES[a['step_index']] for a in attempts if not (a.get('submitted_at') and (a.get('answer') or '').strip())]
    if missing:
        return None, Response({'error': 'Submit all steps before completing exam', 'missing_steps': missing}, status=status.HTTP_400_BAD_REQUEST)
    answer_key = _answer_key_for_case(data['case_id'])
    previous_steps: list[dict] = []
    scores: list[float] = []
    sb = get_supabase()
    for attempt in attempts:
        step_index = attempt['step_index']
        step_code = STEP_CODES[step_index]
        target = answer_key.get(step_code, {})
        result = evaluate_answer(
            student_answer=attempt.get('answer') or '',
            step_code=step_code,
            step_index=step_index,
            answer_key={'expected_finding': target.get('expected_finding', '')},
            cv_findings={},
            previous_steps=previous_steps,
            step_attempts=[],
            is_last_step=step_index == len(STEP_CODES) - 1,
        )
        score = float(result.get('score') or 0)
        scores.append(score)
        previous_steps.append({'step': step_code, 'answer': attempt.get('answer') or ''})
        sb.table('exam_step_attempts').update({
            'score': score,
            'feedback': result.get('feedback') or result.get('positive_feedback') or '',
            'errors': result.get('errors') or [],
            'locked': True,
            'updated_at': _now_iso(),
        }).eq('id', attempt['id']).execute()
    final_score = round(sum(scores) / len(STEP_CODES), 4) if scores else 0.0
    sb.table('exam_sessions').update({
        'status': 'COMPLETED',
        'final_score': final_score,
        'completed_at': _now_iso(),
    }).eq('id', session_id).execute()
    return get_exam_session(session_id, user_id)


def get_exam_review(session_id: str, user_id: str) -> tuple[dict | None, Response | None]:
    data, err = get_exam_session(session_id, user_id)
    if err:
        return None, err
    if data['status'] != 'COMPLETED':
        return None, Response({'error': 'Review is only available after completion'}, status=status.HTTP_403_FORBIDDEN)
    return {'session': data, 'answer_key': _answer_key_for_case(data['case_id'])}, None
