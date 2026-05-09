import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Iterator

import requests
from openai import OpenAI
from rest_framework import status
from rest_framework.response import Response

from app.core.step_codes import STEP_CODES, index_by_canonical_step
from app.core.supabase_client import get_supabase
from app.uploads.services import analyze_medical_image

logger = logging.getLogger(__name__)

SWAP_VLM_MAX_IMAGES = max(1, int(os.getenv('SWAP_VLM_MAX_IMAGES', '12')))
SWAP_PERSUASION_THRESHOLD = float(os.getenv('SWAP_PERSUASION_THRESHOLD', '0.5'))

MODALITY_TO_UPLOAD = {
    'X-ray': 'XRAY',
    'XRAY': 'XRAY',
    'CT': 'CT',
    'MRI': 'MRI',
    'Difference': 'DIFF',
    'DIFF': 'DIFF',
}


def _parse_uuid(value: str) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False


def _get_case_for_user(case_id: str, user_id: str) -> tuple[dict | None, Response | None]:
    if not _parse_uuid(case_id):
        return None, Response({'error': 'Invalid case_id'}, status=status.HTTP_400_BAD_REQUEST)

    sb = get_supabase()
    try:
        result = sb.table('cases').select(
            'id, title, modality, difficulty, clinical_history, disease_tag, status, source, uploaded_by, '
            'is_valid, case_images(image_url, slice_index, volume_name)'
        ).eq('id', case_id).single().execute()
    except Exception:
        return None, Response({'error': 'Case not found'}, status=status.HTTP_404_NOT_FOUND)

    case = result.data
    if case.get('uploaded_by') and case['uploaded_by'] != user_id:
        return None, Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    if case.get('is_valid') is not True:
        return None, Response({'error': 'Case is not valid for swap debate'}, status=status.HTTP_400_BAD_REQUEST)
    return case, None


def _download_case_images(case: dict) -> tuple[list[bytes], list[int | None], list[str]]:
    raw_images = case.get('case_images') or []
    raw_images.sort(key=lambda img: (img.get('volume_name') or 'Default', img.get('slice_index') or 0))

    # Cap total images sent to the VLM to keep HF request size + latency bounded.
    if len(raw_images) > SWAP_VLM_MAX_IMAGES:
        raw_images = raw_images[:SWAP_VLM_MAX_IMAGES]

    image_bytes: list[bytes] = []
    slice_indexes: list[int | None] = []
    volume_names: list[str] = []

    for img in raw_images:
        url = img.get('image_url')
        if not url:
            continue
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        image_bytes.append(response.content)
        slice_indexes.append(img.get('slice_index'))
        volume_names.append(img.get('volume_name') or 'Default')

    if not image_bytes:
        raise ValueError('Case has no images')

    return image_bytes, slice_indexes, volume_names


def _answer_key_for_case(case_id: str) -> dict[str, dict[str, Any]]:
    sb = get_supabase()
    result = sb.table('answer_keys').select(
        'step_code, step_order, expected_finding, clinical_explanation, key_points'
    ).eq('case_id', case_id).order('step_order').execute()
    return index_by_canonical_step(result.data or [])


def _json_from_text(text: str) -> dict[str, Any]:
    cleaned = (text or '').strip()
    if cleaned.startswith('```json'):
        cleaned = cleaned[7:]
    if cleaned.startswith('```'):
        cleaned = cleaned[3:]
    if cleaned.endswith('```'):
        cleaned = cleaned[:-3]
    cleaned = cleaned.strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find('{')
        end = cleaned.rfind('}') + 1
        if start >= 0 and end > start:
            return json.loads(cleaned[start:end])
        raise


def _format_history(messages: list[dict], pending_user_message: str) -> str:
    lines = []
    for message in messages:
        role = 'Doctor' if message['role'] == 'doctor' else 'User'
        lines.append(f"{role}: {message['content']}")
    lines.append(f"User: {pending_user_message}")
    return "\n".join(lines)


def _clamp_score(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    if score > 1:
        score = score / 100.0
    return max(0.0, min(score, 1.0))


def _get_openai_client() -> OpenAI:
    api_key = os.getenv('OPENAI_API_KEY', '').strip()
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY is not configured')
    return OpenAI(api_key=api_key)


def _doctor_reply(
    session: dict,
    case: dict,
    answer_key: dict[str, dict[str, Any]],
    messages: list[dict],
    user_message: str,
) -> dict[str, Any]:
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    target = answer_key.get(step_code, {})
    doctor_diagnosis = session.get('doctor_diagnosis') or {}
    doctor_step = doctor_diagnosis.get(step_code, '')

    prompt = f"""
You are roleplaying a radiologist in a medical education debate.

Persona:
- You are knowledgeable, senior, a bit stubborn and high-ego, but ultimately fair.
- You defend your first impression but yield when the student raises a reasonable imaging point.
- Do not mention that you are an AI, a roleplay system, or that you can see a hidden answer key.

Conversation rules:
- Discuss ONLY the current step: {step_code}.
- Do not reveal future steps.
- If the user's argument is clearly wrong or empty, push back briefly with one counter-question.
- If the user's argument touches the main expected finding(s) — even partially — concede with mild reluctance and move the discussion forward. Do not demand textbook-perfect wording.
- Respond in Vietnamese.

Case:
Title: {case.get('title', '')}
Modality: {case.get('modality', '')}
Clinical history: {case.get('clinical_history', '')}

Your initial diagnosis for this step:
{doctor_step}

Hidden target answer for this step:
Expected finding: {target.get('expected_finding', '')}
Clinical explanation: {target.get('clinical_explanation', '')}
Key points: {target.get('key_points', [])}

Conversation history:
{_format_history(messages, user_message)}

Return ONLY valid JSON:
{{
  "doctor_message": "your in-character reply",
  "convinced": true,
  "persuasion_score": 0.0,
  "reasoning_for_grader": "short private grading reason"
}}
"""
    response = _get_openai_client().chat.completions.create(
        model='gpt-4o',
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.45,
        max_tokens=700,
        timeout=45,
    )
    try:
        parsed = _json_from_text(response.choices[0].message.content or '')
    except Exception:
        parsed = {}
    return {
        'doctor_message': str(parsed.get('doctor_message') or '').strip() or 'Tôi chưa bị thuyết phục.',
        'convinced': bool(parsed.get('convinced', False)),
        'persuasion_score': _clamp_score(parsed.get('persuasion_score', 0)),
        'reasoning_for_grader': str(parsed.get('reasoning_for_grader') or '').strip(),
    }


def _doctor_text_prompt(
    session: dict,
    case: dict,
    answer_key: dict[str, dict[str, Any]],
    messages: list[dict],
    user_message: str,
) -> str:
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    target = answer_key.get(step_code, {})
    doctor_diagnosis = session.get('doctor_diagnosis') or {}
    doctor_step = doctor_diagnosis.get(step_code, '')

    return f"""
You are roleplaying a radiologist in a medical education debate.

Persona:
- You are knowledgeable, senior, a bit stubborn and high-ego, but ultimately fair.
- You defend your first impression but yield when the student raises a reasonable imaging point.
- Do not mention that you are an AI, a roleplay system, or that you can see a hidden answer key.

Conversation rules:
- Discuss ONLY the current step: {step_code}.
- Do not reveal future steps.
- If the user's argument is clearly wrong or empty, push back briefly with one counter-question.
- If the user's argument touches the main expected finding(s) — even partially — concede with mild reluctance and move the discussion forward. Do not demand textbook-perfect wording.
- Respond in Vietnamese as the doctor only. Do not return JSON.

Case:
Title: {case.get('title', '')}
Modality: {case.get('modality', '')}
Clinical history: {case.get('clinical_history', '')}

Your initial diagnosis for this step:
{doctor_step}

Hidden target answer for this step:
Expected finding: {target.get('expected_finding', '')}
Clinical explanation: {target.get('clinical_explanation', '')}
Key points: {target.get('key_points', [])}

Conversation history:
{_format_history(messages, user_message)}
"""


def _stream_doctor_text(prompt: str) -> Iterator[str]:
    stream = _get_openai_client().chat.completions.create(
        model='gpt-4o',
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.45,
        max_tokens=700,
        timeout=45,
        stream=True,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content if chunk.choices and chunk.choices[0].delta else None
        if delta:
            yield delta


def _judge_doctor_text(
    session: dict,
    answer_key: dict[str, dict[str, Any]],
    messages: list[dict],
    user_message: str,
    doctor_message: str,
) -> dict[str, Any]:
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    target = answer_key.get(step_code, {})
    prompt = f"""
You are the hidden grader for a medical roleplay debate.

Decide whether the user's latest argument should convince the doctor for the current step.
Use the hidden target answer as ground truth. Return ONLY valid JSON.

Scoring rubric (0.0-1.0):
- 0.0-0.3: argument is irrelevant, wrong, or empty (e.g. only "tiếng việt", off-topic).
- 0.4-0.5: partially correct — touches one relevant finding/term but misses key points.
- 0.6-0.8: covers the main expected finding(s) with adequate reasoning, even if wording differs.
  Reward arguments that hit ANY 1-2 of the target key points clearly. The doctor should concede here.
- 0.9-1.0: argument is precise, complete, and uses correct radiological terminology.
Set "convinced": true whenever persuasion_score >= 0.5. Be generous — this is a teaching tool, not an exam.

Current step: {step_code}
Target expected finding: {target.get('expected_finding', '')}
Target clinical explanation: {target.get('clinical_explanation', '')}
Target key points: {target.get('key_points', [])}

Previous conversation:
{_format_history(messages, user_message)}

Doctor's streamed reply:
{doctor_message}

Return ONLY valid JSON:
{{
  "convinced": true,
  "persuasion_score": 0.0,
  "reasoning_for_grader": "short private grading reason"
}}
"""
    response = _get_openai_client().chat.completions.create(
        model='gpt-4o',
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.2,
        max_tokens=350,
        timeout=45,
    )
    try:
        parsed = _json_from_text(response.choices[0].message.content or '')
    except Exception:
        parsed = {}
    return {
        'doctor_message': doctor_message,
        'convinced': bool(parsed.get('convinced', False)),
        'persuasion_score': _clamp_score(parsed.get('persuasion_score', 0)),
        'reasoning_for_grader': str(parsed.get('reasoning_for_grader') or '').strip(),
    }


def _final_grade(case: dict, answer_key: dict[str, dict[str, Any]], messages: list[dict]) -> list[dict[str, Any]]:
    transcript = "\n".join(
        f"{'Doctor' if message['role'] == 'doctor' else 'User'} [{STEP_CODES[message['step_index']]}]: {message['content']}"
        for message in messages
    )
    targets = {
        code: {
            'expected_finding': answer_key.get(code, {}).get('expected_finding', ''),
            'clinical_explanation': answer_key.get(code, {}).get('clinical_explanation', ''),
            'key_points': answer_key.get(code, {}).get('key_points', []),
        }
        for code in STEP_CODES
    }
    prompt = f"""
You are grading a medical debate training session.

Read the full transcript and score how well the user persuaded the doctor for each diagnostic step.
Score 0.0-1.0. Reward medically accurate reasoning, use of image findings, and successful persuasion.
Return Vietnamese reasoning, but only valid JSON.

Case:
Title: {case.get('title', '')}
Clinical history: {case.get('clinical_history', '')}

Ground truth by step:
{json.dumps(targets, ensure_ascii=False)}

Transcript:
{transcript}

Return ONLY valid JSON:
{{
  "scores": [
    {{"step_code": "DESCRIBE", "persuasion_score": 0.0, "reasoning": "short reason"}},
    {{"step_code": "REASONING", "persuasion_score": 0.0, "reasoning": "short reason"}},
    {{"step_code": "DDx", "persuasion_score": 0.0, "reasoning": "short reason"}},
    {{"step_code": "CONCLUSION", "persuasion_score": 0.0, "reasoning": "short reason"}}
  ]
}}
"""
    response = _get_openai_client().chat.completions.create(
        model='gpt-4o',
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.2,
        max_tokens=900,
        timeout=45,
    )
    parsed = _json_from_text(response.choices[0].message.content or '')
    by_code = {item.get('step_code'): item for item in parsed.get('scores', [])}
    return [
        {
            'step_index': idx,
            'step_code': code,
            'persuasion_score': _clamp_score(by_code.get(code, {}).get('persuasion_score', 0)),
            'reasoning': str(by_code.get(code, {}).get('reasoning') or '').strip(),
        }
        for idx, code in enumerate(STEP_CODES)
    ]


def _case_summary(case: dict) -> dict:
    raw_images = case.get('case_images') or []
    volumes: dict[str, list[dict]] = {}
    for img in raw_images:
        volume = img.get('volume_name') or 'Default'
        volumes.setdefault(volume, []).append({
            'image_url': img.get('image_url'),
            'slice_index': img.get('slice_index'),
        })
    return {
        'id': case.get('id'),
        'title': case.get('title'),
        'modality': case.get('modality'),
        'difficulty': case.get('difficulty'),
        'clinical_history': case.get('clinical_history'),
        'disease_tag': case.get('disease_tag'),
        'images': [{'volume_name': name, 'slices': slices} for name, slices in volumes.items()],
    }


def _serialize_session(session: dict) -> dict:
    sb = get_supabase()
    case, _ = _get_case_for_user(session['case_id'], session['user_id'])
    messages = sb.table('swap_messages').select('*').eq(
        'swap_session_id', session['id']
    ).order('created_at').execute().data or []
    scores = sb.table('swap_step_scores').select('*').eq(
        'swap_session_id', session['id']
    ).order('step_index').execute().data or []
    return {
        **session,
        'case': _case_summary(case or {}),
        'messages': messages,
        'scores': scores,
        'step_codes': STEP_CODES,
    }


def list_swap_sessions(user_id: str) -> list[dict]:
    sb = get_supabase()
    rows = sb.table('swap_sessions').select(
        'id, case_id, status, final_score, current_step, started_at, completed_at'
    ).eq('user_id', user_id).order('started_at', desc=True).execute().data or []
    return rows


def create_swap_session(case_id: str, user_id: str) -> tuple[dict | None, Response | None]:
    case, err = _get_case_for_user(case_id, user_id)
    if err:
        return None, err

    answer_key = _answer_key_for_case(case_id)
    missing = [code for code in STEP_CODES if code not in answer_key]
    if missing:
        return None, Response(
            {
                'error': (
                    f"Case answer key is incomplete. "
                    f"Missing: {missing}. Found: {list(answer_key.keys())}"
                ),
                'missing_steps': missing,
                'found_steps': list(answer_key.keys()),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        image_bytes, _, volume_names = _download_case_images(case)
    except Exception as exc:
        return None, Response({'error': 'Could not load case images', 'message': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    modality = MODALITY_TO_UPLOAD.get(case.get('modality'), 'XRAY')
    findings = analyze_medical_image(
        image_bytes,
        modality=modality,
        region=case.get('disease_tag') or 'unspecified',
        volume_names=volume_names,
    )
    doctor_diagnosis = findings.get('answer_key', {}) or {}

    sb = get_supabase()
    inserted = sb.table('swap_sessions').insert({
        'user_id': user_id,
        'case_id': case_id,
        'doctor_diagnosis': doctor_diagnosis,
        'raw_vlm_output': findings.get('raw_findings', ''),
    }).execute().data[0]

    initial_message = (
        doctor_diagnosis.get('DESCRIBE')
        or doctor_diagnosis.get('OBSERVE')
        or 'Tôi sẽ bắt đầu với bước quan sát, nhưng hình ảnh này khá rõ rồi.'
    )
    sb.table('swap_messages').insert({
        'swap_session_id': inserted['id'],
        'role': 'doctor',
        'step_index': 0,
        'content': initial_message,
        'metadata': {'source': 'initial_vlm'},
    }).execute()

    return _serialize_session(inserted), None


def get_swap_session(session_id: str, user_id: str) -> tuple[dict | None, Response | None]:
    if not _parse_uuid(session_id):
        return None, Response({'error': 'Invalid session id'}, status=status.HTTP_400_BAD_REQUEST)
    sb = get_supabase()
    try:
        session = sb.table('swap_sessions').select('*').eq('id', session_id).single().execute().data
    except Exception:
        return None, Response({'error': 'Swap session not found'}, status=status.HTTP_404_NOT_FOUND)
    if session['user_id'] != user_id:
        return None, Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    return _serialize_session(session), None


def _store_swap_exchange(data: dict, message: str, result: dict[str, Any]) -> tuple[dict | None, Response | None]:
    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_codes')}
    answer_key = _answer_key_for_case(session['case_id'])
    sb = get_supabase()
    session_id = session['id']
    user_id = session['user_id']
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]

    # Advance the step when the judge explicitly concedes OR when the persuasion
    # score is high enough — covers cases where the judge LLM is conservative
    # with the boolean but still scores the argument well.
    advance = bool(result.get('convinced')) or result.get('persuasion_score', 0) >= SWAP_PERSUASION_THRESHOLD
    result['convinced'] = advance

    sb.table('swap_messages').insert([
        {
            'swap_session_id': session_id,
            'role': 'user',
            'step_index': step_index,
            'content': message,
            'metadata': {},
        },
        {
            'swap_session_id': session_id,
            'role': 'doctor',
            'step_index': step_index,
            'content': result['doctor_message'],
            'metadata': {
                'convinced': advance,
                'persuasion_score': result['persuasion_score'],
                'reasoning_for_grader': result['reasoning_for_grader'],
            },
        },
    ]).execute()

    if advance:
        try:
            sb.table('swap_step_scores').upsert({
                'swap_session_id': session_id,
                'step_index': step_index,
                'step_code': step_code,
                'persuasion_score': result['persuasion_score'],
                'convinced': True,
                'reasoning': result['reasoning_for_grader'],
            }, on_conflict='swap_session_id,step_index').execute()
        except Exception as exc:
            logger.exception(
                "swap: failed to upsert swap_step_scores (session=%s step=%s): %s",
                session_id, step_index, exc,
            )
            return None, Response(
                {'error': 'Could not save step score', 'message': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if step_index >= len(STEP_CODES) - 1:
            full_messages = sb.table('swap_messages').select('*').eq(
                'swap_session_id', session_id
            ).order('created_at').execute().data or []
            try:
                final_scores = _final_grade(data['case'], answer_key, full_messages)
            except Exception:
                existing_scores = sb.table('swap_step_scores').select(
                    'step_index, persuasion_score, reasoning'
                ).eq('swap_session_id', session_id).execute().data or []
                existing_by_step = {s['step_index']: s for s in existing_scores}
                final_scores = [
                    {
                        'step_index': idx,
                        'step_code': code,
                        'persuasion_score': (
                            result['persuasion_score']
                            if idx == step_index
                            else float(existing_by_step.get(idx, {}).get('persuasion_score', 0))
                        ),
                        'reasoning': existing_by_step.get(idx, {}).get('reasoning') or 'Fallback score from step-level persuasion.',
                    }
                    for idx, code in enumerate(STEP_CODES)
                ]
            for score in final_scores:
                sb.table('swap_step_scores').upsert({
                    'swap_session_id': session_id,
                    'step_index': score['step_index'],
                    'step_code': score['step_code'],
                    'persuasion_score': score['persuasion_score'],
                    'convinced': True,
                    'reasoning': score['reasoning'],
                }, on_conflict='swap_session_id,step_index').execute()
            final_score = sum(float(s['persuasion_score']) for s in final_scores) / len(STEP_CODES)
            try:
                sb.table('swap_sessions').update({
                    'status': 'COMPLETED',
                    'final_score': round(final_score, 4),
                    'completed_at': datetime.now(timezone.utc).isoformat(),
                }).eq('id', session_id).execute()
                result['session_complete'] = True
            except Exception as exc:
                logger.exception("swap: failed to mark session COMPLETED: %s", exc)
                return None, Response(
                    {'error': 'Could not finalize session', 'message': str(exc)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
        else:
            next_step = step_index + 1
            try:
                sb.table('swap_sessions').update({'current_step': next_step}).eq('id', session_id).execute()
            except Exception as exc:
                logger.exception(
                    "swap: failed to advance current_step (session=%s %s→%s): %s",
                    session_id, step_index, next_step, exc,
                )
                return None, Response(
                    {'error': 'Could not advance step', 'message': str(exc)},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )
            result['next_step'] = next_step
            next_message = (session.get('doctor_diagnosis') or {}).get(STEP_CODES[next_step], '')
            if next_message:
                try:
                    sb.table('swap_messages').insert({
                        'swap_session_id': session_id,
                        'role': 'doctor',
                        'step_index': next_step,
                        'content': next_message,
                        'metadata': {'source': 'initial_vlm'},
                    }).execute()
                except Exception as exc:
                    logger.warning(
                        "swap: could not insert next-step seed message (non-fatal): %s", exc,
                    )

    updated, updated_err = get_swap_session(session_id, user_id)
    if updated_err:
        return None, updated_err
    updated['last_result'] = result
    return updated, None


def submit_swap_message(session_id: str, user_id: str, message: str) -> tuple[dict | None, Response | None]:
    data, err = get_swap_session(session_id, user_id)
    if err:
        return None, err
    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_codes')}
    if session['status'] != 'IN_PROGRESS':
        return None, Response({'error': 'Swap session is already completed'}, status=status.HTTP_400_BAD_REQUEST)

    answer_key = _answer_key_for_case(session['case_id'])
    try:
        result = _doctor_reply(session, data['case'], answer_key, data['messages'], message)
    except Exception as exc:
        return None, Response({'error': 'Doctor model failed', 'message': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

    return _store_swap_exchange(data, message, result)


def _sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def stream_swap_message_events(session_id: str, user_id: str, message: str) -> Iterator[str]:
    data, err = get_swap_session(session_id, user_id)
    if err:
        yield _sse('error', {'error': getattr(err, 'data', {'error': 'Request failed'}).get('error', 'Request failed')})
        return

    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_codes')}
    if session['status'] != 'IN_PROGRESS':
        yield _sse('error', {'error': 'Swap session is already completed'})
        return

    answer_key = _answer_key_for_case(session['case_id'])
    doctor_message = ''
    try:
        prompt = _doctor_text_prompt(session, data['case'], answer_key, data['messages'], message)
        for delta in _stream_doctor_text(prompt):
            doctor_message += delta
            yield _sse('delta', {'delta': delta})

        result = _judge_doctor_text(session, answer_key, data['messages'], message, doctor_message)
        updated, store_err = _store_swap_exchange(data, message, result)
        if store_err:
            yield _sse('error', {'error': getattr(store_err, 'data', {'error': 'Store failed'}).get('error', 'Store failed')})
            return
        yield _sse('done', {'session': updated, 'last_result': result})
    except Exception as exc:
        logger.exception("swap stream failed: %s", exc)
        yield _sse('error', {'error': f'Doctor stream failed: {exc}', 'message': str(exc)})
