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
SWAP_PHASE_DEBATING = 'DEBATING'
SWAP_PHASE_AWAITING_CONFIRMATION = 'AWAITING_CONFIRMATION'
SWAP_PHASE_CONFIRMED = 'CONFIRMED'
SWAP_FINAL_DEBATE_WEIGHT = float(os.getenv('SWAP_FINAL_DEBATE_WEIGHT', '0.3333333333'))
SWAP_FINAL_KNOWLEDGE_WEIGHT = float(os.getenv('SWAP_FINAL_KNOWLEDGE_WEIGHT', '0.3333333333'))
SWAP_FINAL_ACCURACY_WEIGHT = float(os.getenv('SWAP_FINAL_ACCURACY_WEIGHT', '0.3333333333'))


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
            'is_valid, is_exam, case_images(image_url, slice_index, volume_name)'
        ).eq('id', case_id).single().execute()
    except Exception:
        return None, Response({'error': 'Case not found'}, status=status.HTTP_404_NOT_FOUND)

    case = result.data
    if case.get('uploaded_by') and case['uploaded_by'] != user_id:
        return None, Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
    if case.get('is_exam') is True:
        return None, Response({'error': 'Exam cases cannot be used for swap debate'}, status=status.HTTP_400_BAD_REQUEST)
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


def _is_confirmation_message(message: str) -> bool:
    text = " ".join((message or "").strip().lower().split())
    if not text:
        return False
    confirm_words = (
        'dong y', 'đồng ý', 'ok', 'okay', 'yes', 'chot', 'chốt',
        'dung roi', 'đúng rồi', 'nhat tri', 'nhất trí', 'tiep tuc',
        'tiếp tục', 'sang buoc', 'sang bước'
    )
    reject_words = (
        'khong', 'không', 'chua', 'chưa', 'sai', 'bo sung', 'bổ sung',
        'sua', 'sửa', 'nhung', 'nhưng'
    )
    if any(word in text for word in reject_words):
        return False
    return any(word in text for word in confirm_words)


def _step_state_map(states: list[dict] | None) -> dict[int, dict]:
    return {int(state['step_index']): state for state in (states or [])}


def _default_step_state(session_id: str, step_index: int) -> dict:
    return {
        'swap_session_id': session_id,
        'step_index': step_index,
        'step_code': STEP_CODES[step_index],
        'phase': SWAP_PHASE_DEBATING,
        'convinced': False,
        'pending_summary': None,
        'agreed_answer': None,
        'debate_score': None,
        'knowledge_score': None,
        'debate_score_online': None,
        'knowledge_score_final': None,
        'accuracy_score_final': None,
        'reasoning': '',
        'reasoning_online': '',
        'reasoning_final': '',
    }


def _previous_agreed_answers(states: list[dict], current_step: int) -> list[dict]:
    by_step = _step_state_map(states)
    agreed = []
    for idx in range(current_step):
        state = by_step.get(idx) or {}
        if state.get('agreed_answer'):
            agreed.append({'step_code': STEP_CODES[idx], 'agreed_answer': state['agreed_answer']})
    return agreed


def _current_step_visible_history(messages: list[dict], step_index: int, pending_user_message: str) -> str:
    lines = []
    for message in messages:
        if message.get('step_index') != step_index:
            continue
        role = 'Doctor' if message['role'] == 'doctor' else 'User'
        lines.append(f"{role}: {message['content']}")
    lines.append(f"User: {pending_user_message}")
    return "\n".join(lines)


def _combined_score(result: dict[str, Any]) -> float:
    debate = result.get('debate_score')
    knowledge = result.get('knowledge_score')
    if debate is None and knowledge is None:
        return _clamp_score(result.get('persuasion_score', 0))
    values = [_clamp_score(v) for v in (debate, knowledge) if v is not None]
    return sum(values) / len(values) if values else 0.0


def _weight_sum() -> float:
    total = SWAP_FINAL_DEBATE_WEIGHT + SWAP_FINAL_KNOWLEDGE_WEIGHT + SWAP_FINAL_ACCURACY_WEIGHT
    return total if total > 0 else 1.0


def _weighted_final_score(debate_score: float, knowledge_score: float, accuracy_score: float) -> float:
    total = _weight_sum()
    return (
        SWAP_FINAL_DEBATE_WEIGHT * _clamp_score(debate_score)
        + SWAP_FINAL_KNOWLEDGE_WEIGHT * _clamp_score(knowledge_score)
        + SWAP_FINAL_ACCURACY_WEIGHT * _clamp_score(accuracy_score)
    ) / total


def _is_exact_step_answer(agreed_answer: str, target: dict[str, Any]) -> bool:
    target_text = " ".join(
        [
            str(target.get('expected_finding') or ''),
            str(target.get('clinical_explanation') or ''),
            " ".join(str(k) for k in (target.get('key_points') or [])),
        ]
    ).strip().lower()
    agreed = (agreed_answer or '').strip().lower()
    return bool(agreed) and bool(target_text) and agreed in target_text


def _clamp_score(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    if score > 1:
        score = score / 100.0
    return max(0.0, min(score, 1.0))


def _sanitize_consensus_summary(text: str) -> str:
    summary = (text or '').strip()
    if not summary:
        return ''
    lower = summary.lower()
    markers = [' tuy nhiên', '. tuy nhiên', ' nhưng ', '. nhưng ', ' however ']
    cut_positions = [lower.find(marker) for marker in markers if lower.find(marker) > 0]
    if cut_positions:
        summary = summary[:min(cut_positions)].rstrip(' ,;:.')
    return summary.strip()


def _get_openai_client() -> OpenAI:
    api_key = os.getenv('OPENAI_API_KEY', '').strip()
    if not api_key:
        raise RuntimeError('OPENAI_API_KEY is not configured')
    return OpenAI(api_key=api_key)


def _translate_doctor_diagnosis_for_user(doctor_diagnosis: dict[str, Any]) -> dict[str, str]:
    source_by_step = {
        code: str(
            doctor_diagnosis.get(code)
            or doctor_diagnosis.get('OBSERVE' if code == 'DESCRIBE' else code)
            or ''
        ).strip()
        for code in STEP_CODES
    }
    if not any(source_by_step.values()):
        return source_by_step

    prompt = f"""
Translate and polish these radiology step answers into Vietnamese before they are shown to a student.

Rules:
- Return ONLY valid JSON.
- Keep exactly these keys: {STEP_CODES}.
- Translate all English to natural Vietnamese.
- Keep standard radiology abbreviations when useful, but explain them in Vietnamese if needed.
- Do not add hidden answer-key details that are not present in the source.
- Do not prefix the value with the step code, for example do not start with "DESCRIBE:".
- Write each value as the doctor speaking concisely to the student.

Source JSON:
{json.dumps(source_by_step, ensure_ascii=False)}

Return JSON shape:
{{
  "DESCRIBE": "...",
  "REASONING": "...",
  "DDx": "...",
  "CONCLUSION": "..."
}}
"""
    response = _get_openai_client().chat.completions.create(
        model='gpt-4o',
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.2,
        max_tokens=1000,
        timeout=45,
    )
    parsed = _json_from_text(response.choices[0].message.content or '')
    translated = {}
    for code in STEP_CODES:
        value = str(parsed.get(code) or source_by_step.get(code) or '').strip()
        translated[code] = value
    return translated


def _summarize_agreed_answer_from_conversation(
    session: dict,
    messages: list[dict],
    user_message: str,
    doctor_message: str = '',
    states: list[dict] | None = None,
) -> str:
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    previous_agreed = _previous_agreed_answers(states or [], step_index)
    prompt = f"""
Create the agreed answer for the current radiology debate step.

Rules:
- Use ONLY the visible conversation below and the latest user answer.
- Do NOT use or infer from any hidden answer key, rubric, target answer, or model diagnosis.
- The agreed answer should reflect what the user and doctor have actually discussed.
- The doctor has already conceded for this step. The agreed answer must reflect the final accepted position only.
- Do not include unresolved disagreement, contrast clauses, or "however/but" style contradictions.
- Do not mention both sides if they conflict; keep only the final consensus statement.
- Respond in Vietnamese.
- Avoid repetitive openings like "Tôi hiểu rằng", "Tôi biết rằng", "Tôi đồng ý rằng".
- Use natural Vietnamese phrasing with varied sentence openings.
- Keep an annoyed-doctor tone: direct, concise, slightly sharp, but still professional.
- Return ONLY valid JSON.
- Do not prefix the answer with the step code.

Current step: {step_code}
Previous agreed answers, for context only:
{json.dumps(previous_agreed, ensure_ascii=False)}

Visible conversation for current step:
{_current_step_visible_history(messages, step_index, user_message)}

Doctor's latest conceded reply:
{doctor_message}

Return JSON:
{{
  "agreed_answer": "one concise Vietnamese paragraph based only on the conversation"
}}
"""
    response = _get_openai_client().chat.completions.create(
        model='gpt-4o',
        messages=[{'role': 'user', 'content': prompt}],
        temperature=0.2,
        max_tokens=400,
        timeout=45,
    )
    parsed = _json_from_text(response.choices[0].message.content or '')
    return str(parsed.get('agreed_answer') or '').strip()


def _doctor_reply(
    session: dict,
    case: dict,
    describe_key: dict[str, Any],
    messages: list[dict],
    user_message: str,
    states: list[dict] | None = None,
) -> dict[str, Any]:
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    doctor_diagnosis = session.get('doctor_diagnosis') or {}
    doctor_step = doctor_diagnosis.get(step_code, '')
    previous_agreed = _previous_agreed_answers(states or [], step_index)
    step_mode = (
        'Observation reconciliation. Validate image description; do not debate subjective reasoning.'
        if step_code == 'DESCRIBE'
        else 'Diagnostic debate. Defend a clear argument and concede only to stronger reasoning.'
    )

    prompt = f"""
You are roleplaying a radiologist in a medical education debate.

Persona:
- You are knowledgeable, senior, stubborn, conservative, and easily annoyed.
- You often work too quickly and defend your first impression.
- You can be convinced only by strong imaging reasoning based on visible case context and transcript.
- Do not mention that you are an AI or a roleplay system.

Conversation rules:
- Discuss ONLY the current step: {step_code}.
- Do not reveal future steps.
- Current mode: {step_mode}
- Use only previous agreed answers as context.
- For REASONING, DDx, CONCLUSION: do not claim there is a hidden official answer at runtime.
- If the user's argument is weak, push back confidently.
- If the user's argument touches the main expected finding(s) and good reasoning — concede with mild reluctance and move the discussion forward. Do not demand textbook-perfect wording.
- Respond in Vietnamese.

Case:
Title: {case.get('title', '')}
Modality: {case.get('modality', '')}
Clinical history: {case.get('clinical_history', '')}

Your initial diagnosis for this step:
{doctor_step}

DESCRIBE answer key (only this key is visible online for grounding):
Expected finding: {describe_key.get('expected_finding', '')}
Clinical explanation: {describe_key.get('clinical_explanation', '')}
Key points: {describe_key.get('key_points', [])}

Previous agreed answers:
{json.dumps(previous_agreed, ensure_ascii=False)}

Conversation history:
{_format_history(messages, user_message)}

Return ONLY valid JSON:
{{
  "doctor_message": "your in-character reply",
  "convinced": false,
  "persuasion_score": 0.0,
  "debate_score": 0.0,
  "knowledge_score": 0.0,
  "pending_summary": "",
  "reasoning_for_grader": "short private grading reason"
}}

Note: Set "convinced": true ONLY IF persuasion_score >= 0.7. If less than 0.7, set "convinced": false.
Note: Leave "pending_summary" empty. The system will build the user-visible agreed answer from the visible conversation only.
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
    persuasion_score = _clamp_score(parsed.get('persuasion_score', 0))
    return {
        'doctor_message': str(parsed.get('doctor_message') or '').strip() or 'Tôi chưa bị thuyết phục.',
        'convinced': bool(parsed.get('convinced', False)) and persuasion_score >= 0.7,
        'persuasion_score': persuasion_score,
        'debate_score': _clamp_score(parsed.get('debate_score', persuasion_score)),
        'knowledge_score': _clamp_score(parsed.get('knowledge_score', persuasion_score)),
        'pending_summary': str(parsed.get('pending_summary') or '').strip(),
        'reasoning_for_grader': str(parsed.get('reasoning_for_grader') or '').strip(),
    }


def _doctor_text_prompt(
    session: dict,
    case: dict,
    describe_key: dict[str, Any],
    messages: list[dict],
    user_message: str,
    states: list[dict] | None = None,
) -> str:
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    doctor_diagnosis = session.get('doctor_diagnosis') or {}
    doctor_step = doctor_diagnosis.get(step_code, '')
    previous_agreed = _previous_agreed_answers(states or [], step_index)
    step_mode = (
        'Observation reconciliation. Validate image description; do not debate subjective reasoning.'
        if step_code == 'DESCRIBE'
        else 'Diagnostic debate. Defend a clear argument and concede only to stronger reasoning.'
    )

    return f"""
You are roleplaying a radiologist in a medical education debate.

Persona:
- You are knowledgeable, senior, stubborn, conservative, and easily annoyed.
- You often work too quickly and defend your first impression.
- You can be convinced only by strong imaging reasoning based on visible case context and transcript.
- Do not mention that you are an AI or a roleplay system.

Conversation rules:
- Discuss ONLY the current step: {step_code}.
- Do not reveal future steps.
- Current mode: {step_mode}
- Use only previous agreed answers as context.
- For REASONING, DDx, CONCLUSION: do not claim there is a hidden official answer at runtime.
- If the user's argument is weak, push back confidently.
- If the user's argument touches the main expected finding(s) and good reasoning — concede with mild reluctance and move the discussion forward. Do not demand textbook-perfect wording but also do not let the user get away with weak arguments.
- Weak arguments might be vague or off-topic. Strong arguments clearly reference specific imaging findings with coherent logic.
- Respond in Vietnamese as the doctor only. Do not return JSON.
- Avoid repetitive openings like "Tôi hiểu rằng", "Tôi biết rằng", "Tôi đồng ý rằng".
- Use natural Vietnamese phrasing with varied sentence openings.
- Keep an annoyed-doctor tone: direct, concise, slightly sharp, but still professional.

Case:
Title: {case.get('title', '')}
Modality: {case.get('modality', '')}
Clinical history: {case.get('clinical_history', '')}

Your initial diagnosis for this step:
{doctor_step}

DESCRIBE answer key (only this key is visible online for grounding):
Expected finding: {describe_key.get('expected_finding', '')}
Clinical explanation: {describe_key.get('clinical_explanation', '')}
Key points: {describe_key.get('key_points', [])}

Previous agreed answers:
{json.dumps(previous_agreed, ensure_ascii=False)}

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
    messages: list[dict],
    user_message: str,
    doctor_message: str,
    states: list[dict] | None = None,
) -> dict[str, Any]:
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    previous_agreed = _previous_agreed_answers(states or [], step_index)
    prompt = f"""
You are the online self-judge for a medical roleplay debate.

Decide whether the user's latest argument should convince the doctor for the current step.
Use only visible conversation context. Return ONLY valid JSON.

Scoring rubric (0.0-1.0):
- 0.0-0.3: argument is irrelevant, wrong, or empty (e.g. only "tiếng việt", off-topic).
- 0.4-0.5: partially correct — touches one relevant finding/term but misses points.
- 0.6-0.8: covers the main arguments with adequate reasoning, even if wording differs.
- 0.9-1.0: argument is precise, complete, and uses correct radiological terminology.
Set "convinced": true whenever persuasion_score >= 0.7.

Current step: {step_code}
Previous agreed answers:
{json.dumps(previous_agreed, ensure_ascii=False)}

Previous conversation:
{_format_history(messages, user_message)}

Doctor's streamed reply:
{doctor_message}

Return ONLY valid JSON:
{{
  "convinced": true,
  "persuasion_score": 0.0,
  "debate_score": 0.0,
  "knowledge_score": 0.0,
  "pending_summary": "",
  "reasoning_for_grader": "short private grading reason"
}}

Important: Leave "pending_summary" empty.
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
    persuasion_score = _clamp_score(parsed.get('persuasion_score', 0))
    return {
        'doctor_message': doctor_message,
        'convinced': bool(parsed.get('convinced', False)) and persuasion_score >= 0.7,
        'persuasion_score': persuasion_score,
        'debate_score': _clamp_score(parsed.get('debate_score', persuasion_score)),
        'knowledge_score': _clamp_score(parsed.get('knowledge_score', persuasion_score)),
        'pending_summary': str(parsed.get('pending_summary') or '').strip(),
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

Read the full transcript and score the user for each diagnostic step.
Score 0.0-1.0:
- debate_score: argumentative quality and rebuttal quality.
- knowledge_score: medical correctness against ground truth.
- accuracy_score: step-level exactness score.
Accuracy scoring rule (semantic exactness, not string match):
- 1.0: meaning is essentially equivalent to ground truth for that step.
- 0.5: partially correct meaning, but missing or incorrect important elements.
- 0.0: meaning does not match the expected step conclusion.
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
    {{"step_code": "DESCRIBE", "debate_score": 0.0, "knowledge_score": 0.0, "accuracy_score": 0.0, "reasoning": "short reason"}},
    {{"step_code": "REASONING", "debate_score": 0.0, "knowledge_score": 0.0, "accuracy_score": 0.0, "reasoning": "short reason"}},
    {{"step_code": "DDx", "debate_score": 0.0, "knowledge_score": 0.0, "accuracy_score": 0.0, "reasoning": "short reason"}},
    {{"step_code": "CONCLUSION", "debate_score": 0.0, "knowledge_score": 0.0, "accuracy_score": 0.0, "reasoning": "short reason"}}
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
            'debate_score': _clamp_score(by_code.get(code, {}).get('debate_score', by_code.get(code, {}).get('persuasion_score', 0))),
            'knowledge_score': _clamp_score(by_code.get(code, {}).get('knowledge_score', by_code.get(code, {}).get('persuasion_score', 0))),
            'accuracy_score': _clamp_score(by_code.get(code, {}).get('accuracy_score', by_code.get(code, {}).get('persuasion_score', 0))),
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
    states = sb.table('swap_step_states').select('*').eq(
        'swap_session_id', session['id']
    ).order('step_index').execute().data or []
    state_by_step = _step_state_map(states)
    scores_out: list[dict[str, Any]] = []
    for idx, code in enumerate(STEP_CODES):
        state = state_by_step.get(idx) or {}
        debate_score = state.get('debate_score')
        knowledge_score = state.get('knowledge_score_final')
        accuracy_score = state.get('accuracy_score_final')
        if debate_score is None:
            debate_score = state.get('debate_score_online')
        if knowledge_score is None:
            knowledge_score = state.get('knowledge_score')
        persuasion_alias = _combined_score({
            'debate_score': debate_score,
            'knowledge_score': knowledge_score,
        })
        scores_out.append({
            'step_index': idx,
            'step_code': code,
            'debate_score': _clamp_score(debate_score),
            'knowledge_score': _clamp_score(knowledge_score),
            'accuracy_score': _clamp_score(accuracy_score),
            'persuasion_score': persuasion_alias,
            'reasoning_online': state.get('reasoning_online') or '',
            'reasoning_final': state.get('reasoning_final') or '',
        })

    final_debate = sum(s['debate_score'] for s in scores_out) / len(STEP_CODES)
    final_knowledge = sum(s['knowledge_score'] for s in scores_out) / len(STEP_CODES)
    final_accuracy = sum(s['accuracy_score'] for s in scores_out) / len(STEP_CODES)
    final_breakdown = {
        'debate_score': round(final_debate, 4),
        'knowledge_score': round(final_knowledge, 4),
        'accuracy_score': round(final_accuracy, 4),
        'weights': {
            'debate': SWAP_FINAL_DEBATE_WEIGHT,
            'knowledge': SWAP_FINAL_KNOWLEDGE_WEIGHT,
            'accuracy': SWAP_FINAL_ACCURACY_WEIGHT,
        },
    }
    final_score = _weighted_final_score(final_debate, final_knowledge, final_accuracy)

    return {
        **session,
        'case': _case_summary(case or {}),
        'messages': messages,
        'scores': scores_out or scores,
        'step_states': states,
        'step_codes': STEP_CODES,
        'final_score': round(final_score, 4) if session.get('status') == 'COMPLETED' else session.get('final_score'),
        'final_score_breakdown': final_breakdown,
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
    try:
        doctor_diagnosis = _translate_doctor_diagnosis_for_user(doctor_diagnosis)
    except Exception as exc:
        logger.exception("swap: failed to translate initial doctor diagnosis: %s", exc)
        return None, Response(
            {'error': 'Could not translate swap answers before showing them to the user', 'message': str(exc)},
            status=status.HTTP_502_BAD_GATEWAY,
        )

    sb = get_supabase()
    inserted = sb.table('swap_sessions').insert({
        'user_id': user_id,
        'case_id': case_id,
        'doctor_diagnosis': doctor_diagnosis,
        'raw_vlm_output': findings.get('raw_findings', ''),
    }).execute().data[0]
    sb.table('swap_step_states').insert([
        _default_step_state(inserted['id'], idx)
        for idx in range(len(STEP_CODES))
    ]).execute()

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
    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_states', 'step_codes')}
    answer_key = _answer_key_for_case(session['case_id'])
    sb = get_supabase()
    session_id = session['id']
    user_id = session['user_id']
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    combined_score = _combined_score(result)

    # Advance the step when the judge explicitly concedes.
    # We rely on the LLM's 'convinced' boolean to ensure the system state
    # matches the textual message (e.g. avoiding advancing when the doctor's text was a rejection).
    advance = bool(result.get('convinced'))
    result['convinced'] = advance
    if advance:
        try:
            pending_summary = _summarize_agreed_answer_from_conversation(
                session,
                data['messages'],
                message,
                result.get('doctor_message') or '',
                data.get('step_states'),
            )
        except Exception as exc:
            logger.exception("swap: failed to summarize agreed answer from conversation: %s", exc)
            pending_summary = message
        pending_summary = _sanitize_consensus_summary(pending_summary)
        result['pending_summary'] = pending_summary
        result['doctor_message'] = (
            f"{result['doctor_message']}\n\n"
            f"Phần thống nhất cho bước {step_code}: {pending_summary}\n"
            "Bạn có đồng ý với kết luận này để chuyển sang bước tiếp theo không?"
        )

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
                'debate_score': result.get('debate_score'),
                'knowledge_score': result.get('knowledge_score'),
                'pending_summary': result.get('pending_summary', ''),
                'reasoning_for_grader': result['reasoning_for_grader'],
            },
        },
    ]).execute()

    if advance:
        sb.table('swap_step_states').upsert({
            'swap_session_id': session_id,
            'step_index': step_index,
            'step_code': step_code,
            'phase': SWAP_PHASE_AWAITING_CONFIRMATION,
            'convinced': True,
            'pending_summary': pending_summary,
            'agreed_answer': None,
            'debate_score': result.get('debate_score', combined_score),
            'knowledge_score': result.get('knowledge_score', combined_score),
            'reasoning': result.get('reasoning_for_grader', ''),
            'debate_score_online': result.get('debate_score', combined_score),
            'reasoning_online': result.get('reasoning_for_grader', ''),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }, on_conflict='swap_session_id,step_index').execute()
        result['awaiting_confirmation'] = True
        advance = False
    else:
        sb.table('swap_step_states').upsert({
            'swap_session_id': session_id,
            'step_index': step_index,
            'step_code': step_code,
            'phase': SWAP_PHASE_DEBATING,
            'convinced': False,
            'pending_summary': None,
            'agreed_answer': None,
            'debate_score': result.get('debate_score'),
            'knowledge_score': result.get('knowledge_score'),
            'reasoning': result.get('reasoning_for_grader', ''),
            'debate_score_online': result.get('debate_score'),
            'reasoning_online': result.get('reasoning_for_grader', ''),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }, on_conflict='swap_session_id,step_index').execute()

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


def _confirm_swap_step(data: dict, message: str) -> tuple[dict | None, Response | None]:
    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_states', 'step_codes')}
    sb = get_supabase()
    session_id = session['id']
    user_id = session['user_id']
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    state = _step_state_map(data.get('step_states')).get(step_index) or {}
    agreed_answer = state.get('pending_summary') or ''
    if not agreed_answer:
        return None, Response({'error': 'No pending step summary to confirm'}, status=status.HTTP_400_BAD_REQUEST)

    sb.table('swap_messages').insert([
        {
            'swap_session_id': session_id,
            'role': 'user',
            'step_index': step_index,
            'content': message,
            'metadata': {'confirmation': True},
        },
        {
            'swap_session_id': session_id,
            'role': 'doctor',
            'step_index': step_index,
            'content': f'Thống nhất bước {step_code}: {agreed_answer}',
            'metadata': {'confirmed': True},
        },
    ]).execute()
    sb.table('swap_step_states').upsert({
        'swap_session_id': session_id,
        'step_index': step_index,
        'step_code': step_code,
        'phase': SWAP_PHASE_CONFIRMED,
        'convinced': True,
        'pending_summary': None,
        'agreed_answer': agreed_answer,
        'debate_score': state.get('debate_score'),
        'knowledge_score': state.get('knowledge_score'),
        'reasoning': state.get('reasoning') or '',
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }, on_conflict='swap_session_id,step_index').execute()
    sb.table('swap_step_scores').upsert({
        'swap_session_id': session_id,
        'step_index': step_index,
        'step_code': step_code,
        'persuasion_score': _combined_score(state),
        'convinced': True,
        'reasoning': state.get('reasoning') or '',
    }, on_conflict='swap_session_id,step_index').execute()

    result: dict[str, Any] = {'confirmed': True}
    if step_index >= len(STEP_CODES) - 1:
        full_messages = sb.table('swap_messages').select('*').eq(
            'swap_session_id', session_id
        ).order('created_at').execute().data or []
        answer_key = _answer_key_for_case(session['case_id'])
        try:
            final_scores = _final_grade(data['case'], answer_key, full_messages)
        except Exception:
            states = sb.table('swap_step_states').select('*').eq('swap_session_id', session_id).execute().data or []
            final_scores = []
            for idx in range(len(STEP_CODES)):
                current_state = (_step_state_map(states).get(idx) or {})
                code = STEP_CODES[idx]
                final_scores.append({
                    'step_index': idx,
                    'step_code': code,
                    'debate_score': _clamp_score(current_state.get('debate_score_online', current_state.get('debate_score', 0))),
                    'knowledge_score': _clamp_score(current_state.get('knowledge_score', 0)),
                    'accuracy_score': 1.0 if _is_exact_step_answer(current_state.get('agreed_answer') or '', answer_key.get(code, {})) else 0.0,
                    'reasoning': current_state.get('reasoning_online') or current_state.get('reasoning') or '',
                })
        for score in final_scores:
            combined = (_clamp_score(score.get('debate_score')) + _clamp_score(score.get('knowledge_score'))) / 2
            sb.table('swap_step_scores').upsert({
                'swap_session_id': session_id,
                'step_index': score['step_index'],
                'step_code': score['step_code'],
                'persuasion_score': combined,
                'convinced': True,
                'reasoning': score.get('reasoning') or '',
            }, on_conflict='swap_session_id,step_index').execute()
            sb.table('swap_step_states').upsert({
                'swap_session_id': session_id,
                'step_index': score['step_index'],
                'step_code': score['step_code'],
                'phase': SWAP_PHASE_CONFIRMED,
                'convinced': True,
                'debate_score': _clamp_score(score.get('debate_score')),
                'knowledge_score': _clamp_score(score.get('knowledge_score')),
                'reasoning': score.get('reasoning') or '',
                'knowledge_score_final': _clamp_score(score.get('knowledge_score')),
                'accuracy_score_final': _clamp_score(score.get('accuracy_score')),
                'reasoning_final': score.get('reasoning') or '',
                'updated_at': datetime.now(timezone.utc).isoformat(),
            }, on_conflict='swap_session_id,step_index').execute()
        final_debate = sum(_clamp_score(s.get('debate_score')) for s in final_scores) / len(STEP_CODES)
        final_knowledge = sum(_clamp_score(s.get('knowledge_score')) for s in final_scores) / len(STEP_CODES)
        final_accuracy = sum(_clamp_score(s.get('accuracy_score')) for s in final_scores) / len(STEP_CODES)
        final_score = _weighted_final_score(final_debate, final_knowledge, final_accuracy)
        sb.table('swap_sessions').update({
            'status': 'COMPLETED',
            'final_score': round(final_score, 4),
            'completed_at': datetime.now(timezone.utc).isoformat(),
        }).eq('id', session_id).execute()
        result['session_complete'] = True
    else:
        next_step = step_index + 1
        sb.table('swap_sessions').update({'current_step': next_step}).eq('id', session_id).execute()
        result['next_step'] = next_step
        next_message = (session.get('doctor_diagnosis') or {}).get(STEP_CODES[next_step], '')
        if next_message:
            sb.table('swap_messages').insert({
                'swap_session_id': session_id,
                'role': 'doctor',
                'step_index': next_step,
                'content': next_message,
                'metadata': {'source': 'initial_vlm'},
            }).execute()

    updated, updated_err = get_swap_session(session_id, user_id)
    if updated_err:
        return None, updated_err
    updated['last_result'] = result
    return updated, None


def submit_swap_message(session_id: str, user_id: str, message: str) -> tuple[dict | None, Response | None]:
    data, err = get_swap_session(session_id, user_id)
    if err:
        return None, err
    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_states', 'step_codes')}
    if session['status'] != 'IN_PROGRESS':
        return None, Response({'error': 'Swap session is already completed'}, status=status.HTTP_400_BAD_REQUEST)
    state = _step_state_map(data.get('step_states')).get(session['current_step']) or {}
    if state.get('phase') == SWAP_PHASE_AWAITING_CONFIRMATION and _is_confirmation_message(message):
        return _confirm_swap_step(data, message)

    describe_key = _answer_key_for_case(session['case_id']).get('DESCRIBE', {})
    try:
        result = _doctor_reply(session, data['case'], describe_key, data['messages'], message, data.get('step_states'))
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

    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_states', 'step_codes')}
    if session['status'] != 'IN_PROGRESS':
        yield _sse('error', {'error': 'Swap session is already completed'})
        return
    state = _step_state_map(data.get('step_states')).get(session['current_step']) or {}
    if state.get('phase') == SWAP_PHASE_AWAITING_CONFIRMATION and _is_confirmation_message(message):
        updated, store_err = _confirm_swap_step(data, message)
        if store_err:
            yield _sse('error', {'error': getattr(store_err, 'data', {'error': 'Store failed'}).get('error', 'Store failed')})
            return
        yield _sse('done', {'session': updated, 'last_result': updated.get('last_result', {})})
        return

    describe_key = _answer_key_for_case(session['case_id']).get('DESCRIBE', {})
    doctor_message = ''
    try:
        prompt = _doctor_text_prompt(session, data['case'], describe_key, data['messages'], message, data.get('step_states'))
        for delta in _stream_doctor_text(prompt):
            doctor_message += delta
            yield _sse('delta', {'delta': delta})

        result = _judge_doctor_text(session, data['messages'], message, doctor_message, data.get('step_states'))
        updated, store_err = _store_swap_exchange(data, message, result)
        if store_err:
            yield _sse('error', {'error': getattr(store_err, 'data', {'error': 'Store failed'}).get('error', 'Store failed')})
            return
        yield _sse('done', {'session': updated, 'last_result': result})
    except Exception as exc:
        logger.exception("swap stream failed: %s", exc)
        yield _sse('error', {'error': f'Doctor stream failed: {exc}', 'message': str(exc)})
