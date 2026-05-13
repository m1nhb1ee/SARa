import json
import logging
import os
import unicodedata
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


def _normalize_signal_text(text: str) -> str:
    normalized = unicodedata.normalize('NFKD', text or '')
    ascii_text = ''.join(ch for ch in normalized if not unicodedata.combining(ch))
    ascii_text = ascii_text.replace('đ', 'd').replace('Đ', 'D')
    return " ".join(ascii_text.lower().split())


def _has_reject_intent(text: str) -> bool:
    reject_signals = (
        'khong dong y',
        'khong chot',
        'khong tiep tuc',
        'khong sang buoc',
        'khong muon tiep tuc',
        'chua dung',
        'chua dong y',
        'chua chot',
        'sai',
        'sai roi',
        'can bo sung',
        'toi muon bo sung',
        'hay bo sung',
        'can sua',
        'hay sua',
    )
    return any(signal in text for signal in reject_signals)


def _wants_next_step(message: str) -> bool:
    text = _normalize_signal_text(message)
    if not text or _has_reject_intent(text):
        return False
    next_step_signals = (
        'tiep tuc',
        'sang buoc',
        'buoc tiep',
        'buoc ke tiep',
        'next step',
        'san sang',
        'di tiep',
        'chuyen sang',
        'chuyen buoc',
        'proceed',
    )
    return any(signal in text for signal in next_step_signals)


def _is_step_agreement_message(message: str) -> bool:
    text = _normalize_signal_text(message)
    if not text or _has_reject_intent(text):
        return False
    agreement_signals = (
        'dong y',
        'dung roi',
        'ban dung',
        'mo ta dung',
        'mo ta cua ban dung',
        'mo ta ban dau',
        'mo ta hien tai',
        'chinh xac',
        'nhat tri',
        'chot',
        'khong co gi bo sung',
        'khong thay gi them',
        'khong co them',
        'hop ly',
        'ok',
        'okay',
        'yes',
    )
    return any(signal in text for signal in agreement_signals)


def _is_confirmation_message(message: str) -> bool:
    text = _normalize_signal_text(message)
    if not text or _has_reject_intent(text):
        return False
    return _is_step_agreement_message(message) or _wants_next_step(message)


def _doctor_message_blocks_convinced(doctor_message: str) -> bool:
    text = _normalize_signal_text(doctor_message)
    if not text:
        return False
    rejection_signals = (
        'toi van chua',
        'van chua thay',
        'chua thay dau hieu',
        'chua thay ro',
        'chua bi thuyet phuc',
        'chua du thuyet phuc',
        'khong du thuyet phuc',
        'neu co bang chung',
        'can bang chung',
        'can them bang chung',
        'can ban chi ra',
        'hay chi ra',
        'hay neu chi tiet',
        'neu ban khang dinh',
    )
    return any(signal in text for signal in rejection_signals)


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


def _strict_online_component_scores(step_code: str, parsed: dict[str, Any], persuasion_score: float) -> tuple[float, float]:
    debate_score = _clamp_score(parsed.get('debate_score', persuasion_score))
    knowledge_score = _clamp_score(parsed.get('knowledge_score', persuasion_score))

    # Convinced is a progression gate, not a high-score guarantee.
    if step_code == 'DESCRIBE':
        if persuasion_score < 0.77:
            debate_score = min(debate_score, 0.70)
            knowledge_score = min(knowledge_score, 0.72)
    else:
        if persuasion_score < 0.80:
            debate_score = min(debate_score, 0.68)
            knowledge_score = min(knowledge_score, 0.70)
        debate_score = min(debate_score, persuasion_score + 0.05)
        knowledge_score = min(knowledge_score, persuasion_score + 0.05)

    return _clamp_score(debate_score), _clamp_score(knowledge_score)


def _strict_final_component_scores(score: dict[str, Any]) -> tuple[float, float, float]:
    fallback = score.get('persuasion_score', 0)
    debate_score = _clamp_score(score.get('debate_score', fallback))
    knowledge_score = _clamp_score(score.get('knowledge_score', fallback))
    accuracy_score = _clamp_score(score.get('accuracy_score', fallback))

    if accuracy_score < 0.5:
        debate_score = min(debate_score, 0.60)
        knowledge_score = min(knowledge_score, 0.55)
    elif accuracy_score < 0.75:
        debate_score = min(debate_score, 0.75)
        knowledge_score = min(knowledge_score, 0.72)

    return debate_score, knowledge_score, accuracy_score


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


def _strip_describe_diagnostic_leak(text: str, step_code: str) -> str:
    if step_code != 'DESCRIBE':
        return (text or '').strip()
    raw = (text or '').strip()
    if not raw:
        return raw

    leak_terms = (
        'chẩn đoán',
        'kết luận',
        'viêm xương tủy',
        'osteomyelitis',
        'sarcoma',
        'u xương',
        'ác tính',
        'lành tính',
        'ddx',
        'differential',
    )
    normalized = raw.lower()
    if not any(term in normalized for term in leak_terms):
        return raw

    sentences = [s.strip() for s in raw.replace('\n', ' ').split('.') if s.strip()]
    kept: list[str] = []
    for sentence in sentences:
        lowered = sentence.lower()
        if any(term in lowered for term in leak_terms):
            continue
        kept.append(sentence)

    if kept:
        return ". ".join(kept).strip() + "."
    return "Mình đang ở bước DESCRIBE nên chỉ tập trung mô tả dấu hiệu hình ảnh, chưa kết luận chẩn đoán."


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


def _next_step_opening_message(
    session: dict,
    states: list[dict] | None,
    next_step: int,
    just_agreed_answer: str,
) -> str:
    next_code = STEP_CODES[next_step]
    doctor_diagnosis = session.get('doctor_diagnosis') or {}
    vlm_stance = str(doctor_diagnosis.get(next_code) or '').strip()
    previous_agreed = _previous_agreed_answers(states or [], next_step)
    if just_agreed_answer:
        current_code = STEP_CODES[next_step - 1]
        previous_agreed = [
            *[item for item in previous_agreed if item.get('step_code') != current_code],
            {'step_code': current_code, 'agreed_answer': just_agreed_answer},
        ]

    prompt = f"""
Write the doctor's opening message for the next step in a Vietnamese radiology teaching debate.

Rules:
- The agreed answers are authoritative clinical context.
- The VLM/current stance is only a secondary hint. Use it only if it fits the agreed observations.
- If the VLM/current stance conflicts with the agreed observations, revise it so the next-step reasoning follows the agreed observations.
- Do not mention VLM, model, answer key, or hidden reference.
- Discuss ONLY the next step: {next_code}.
- Keep the stubborn senior radiologist persona, but do not reopen already agreed observations.
- Respond in Vietnamese as the doctor only. Do not return JSON.

Previous agreed observations/answers:
{json.dumps(previous_agreed, ensure_ascii=False)}

Secondary VLM/current stance for {next_code}:
{vlm_stance}
"""
    try:
        response = _get_openai_client().chat.completions.create(
            model='gpt-4o',
            messages=[{'role': 'user', 'content': prompt}],
            temperature=0.35,
            max_tokens=350,
            timeout=45,
        )
        message = (response.choices[0].message.content or '').strip()
        if message:
            return message
    except Exception as exc:
        logger.warning("swap: failed to generate next-step opening from agreed answer: %s", exc)

    if just_agreed_answer and vlm_stance:
        return f"Dựa trên phần đã thống nhất: {just_agreed_answer}\n\nỞ bước {next_code}, quan điểm ban đầu của tôi là: {vlm_stance}"
    if just_agreed_answer:
        return f"Dựa trên phần đã thống nhất: {just_agreed_answer}\n\nBây giờ chuyển sang bước {next_code}. Hãy trình bày lập luận của bạn."
    return vlm_stance


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
    describe_reference = json.dumps({
        'expected_finding': describe_key.get('expected_finding', ''),
        'clinical_explanation': describe_key.get('clinical_explanation', ''),
        'key_points': describe_key.get('key_points', []),
    }, ensure_ascii=False) if step_code == 'DESCRIBE' else '{}'
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
- You can be convinced only by strong imaging reasoning based on case context and transcript.
- Do not mention that you are an AI or a roleplay system.

Conversation rules:
- Discuss ONLY the current step: {step_code}.
- Do not reveal future steps.
- Current mode: {step_mode}
- If current step is DESCRIBE: discuss imaging findings only. Do not mention diagnosis, differential diagnosis, etiology, or treatment.
- DESCRIBE is observation, not a debate. If the user's latest answer correctly identifies even one concrete observation that matches the DESCRIBE reference, acknowledge it as correct and concede that observation. Do not demand the full answer before conceding.
- For DESCRIBE, if the user is partly correct, say what part is correct and briefly ask for the missing visible detail if needed. Do not reject the whole answer just because it is incomplete.
- For DESCRIBE, push back only when the user's observation is absent from or contradicts the DESCRIBE reference.
- For DESCRIBE, if the user agrees with your existing description, repeats it as correct, or says there is nothing else to add, treat that as consensus when it does not contradict the DESCRIBE reference. Do not keep asking for more details after clear agreement.
- If current step is DESCRIBE and user asks for diagnosis, politely defer to later steps.
- Use only previous agreed answers as context.
- The conversation block below contains only the current step. Do not re-open or re-label earlier steps.
- You are already debating {step_code}; do not say "let's move into {step_code}" or "continue with {step_code}".
- For REASONING, DDx, CONCLUSION: do not claim there is a hidden official answer at runtime.
- Be harder to convince than a normal tutor. If the user's argument is weak, vague, unsupported, or only repeats keywords, push back confidently.
- For REASONING, DDx, CONCLUSION: concede only when the user gives a coherent medical argument with specific evidence, correct terminology, and a clear link from findings to conclusion.
- If the user's answer is partly correct but lacks reasoning or specialist detail, acknowledge the useful part but do not concede yet.
- If the user's argument touches the main expected finding(s) and good reasoning — concede with mild reluctance and move the discussion forward. Do not demand textbook-perfect wording.
- Respond in Vietnamese.

Case:
Title: {case.get('title', '')}
Modality: {case.get('modality', '')}
Clinical history: {case.get('clinical_history', '')}

Your current stance for this step:
{doctor_step}

DESCRIBE reference for internal validation only. Do not quote or reveal it:
{describe_reference}

Previous agreed answers:
{json.dumps(previous_agreed, ensure_ascii=False)}

Current-step conversation:
{_current_step_visible_history(messages, step_index, user_message)}

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

Note: Set "convinced": true ONLY IF persuasion_score reaches the current step threshold. If below threshold, set "convinced": false.
Note: For DESCRIBE, semantic overlap on core visible findings is enough to concede; do not force hidden-key style strictness.
Note: Leave "pending_summary" empty. The system will build the user-visible agreed answer from the visible conversation only.
CAUTION: DO NOT REAVEAL THE KEY ANSWER OF DESCRIBE reference for observation validation. IF THE USER ASKS FOR DIAGNOSIS IN DESCRIBE, ONLY ANSWER BASE ON YOUR OPINION, Your current stance NOT THE KEY ANSWER.
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
    doctor_message = _strip_describe_diagnostic_leak(
        str(parsed.get('doctor_message') or '').strip() or 'Tôi chưa bị thuyết phục.',
        step_code,
    )
    result = _judge_doctor_text(session, messages, user_message, doctor_message, describe_key, states)
    result['doctor_message'] = doctor_message
    return result


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
    describe_reference = json.dumps({
        'expected_finding': describe_key.get('expected_finding', ''),
        'clinical_explanation': describe_key.get('clinical_explanation', ''),
        'key_points': describe_key.get('key_points', []),
    }, ensure_ascii=False) if step_code == 'DESCRIBE' else '{}'
    step_mode = (
        'Observation validation. Assess student observation accuracy without revealing expected findings.'
        if step_code == 'DESCRIBE'
        else 'Diagnostic debate. Challenge student reasoning and require strong evidence.'
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
- If current step is DESCRIBE: discuss imaging findings only. Do not mention diagnosis, differential diagnosis, etiology, or treatment.
- DESCRIBE is observation, not a debate. If the user's latest answer correctly identifies even one concrete observation that matches the DESCRIBE reference, acknowledge it as correct and concede that observation. Do not demand the full answer before conceding.
- For DESCRIBE, if the user is partly correct, say what part is correct and briefly ask for the missing visible detail if needed. Do not reject the whole answer just because it is incomplete.
- For DESCRIBE, push back only when the user's observation is absent from or contradicts the DESCRIBE reference.
- For DESCRIBE, if the user agrees with your existing description, repeats it as correct, or says there is nothing else to add, treat that as consensus when it does not contradict the DESCRIBE reference. Do not keep asking for more details after clear agreement.
- If current step is DESCRIBE and user asks for diagnosis, politely defer to later steps.
- Use only previous agreed answers as context.
- The conversation block below contains only the current step. Do not re-open or re-label earlier steps.
- You are already debating {step_code}; do not say "let's move into {step_code}" or "continue with {step_code}".
- For REASONING, DDx, CONCLUSION: do not claim there is a hidden official answer at runtime.
- Be harder to convince than a normal tutor. If the user's argument is weak, vague, unsupported, or only repeats keywords, push back confidently.
- For REASONING, DDx, CONCLUSION: concede only when the user gives a coherent medical argument with specific evidence, correct terminology, and a clear link from findings to conclusion.
- If the user's answer is partly correct but lacks reasoning or specialist detail, acknowledge the useful part but do not concede yet.
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

Your current stance for this step:
{doctor_step}

DESCRIBE reference for internal validation only. Do not quote or reveal it:
{describe_reference}

Previous agreed answers:
{json.dumps(previous_agreed, ensure_ascii=False)}

Current-step conversation:
{_current_step_visible_history(messages, step_index, user_message)}
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
    describe_key: dict[str, Any] | None = None,
    states: list[dict] | None = None,
) -> dict[str, Any]:
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    describe_convinced_threshold = 0.62
    default_convinced_threshold = 0.72
    previous_agreed = _previous_agreed_answers(states or [], step_index)
    doctor_diagnosis = session.get('doctor_diagnosis') or {}
    doctor_step_seed = doctor_diagnosis.get(step_code, '')
    describe_target = describe_key or {}
    prompt = f"""
You are the online self-judge for a medical roleplay debate.

Decide whether the user's latest argument should convince the doctor for the current step.
Use only visible conversation context. Return ONLY valid JSON.

Score strictly. Do not inflate scores because the tone is confident.
Scoring rubric (0.0-1.0):
- 0.0-0.3: irrelevant, wrong, empty, or unsafe reasoning.
- 0.4-0.5: mentions a relevant keyword/finding but is vague, unsupported, or has important errors.
- 0.6-0.69: partly correct with some logic, but incomplete or missing specialist detail.
- 0.70-0.79: mostly correct with specific evidence and reasonable logic, but not fully rigorous.
- 0.80-0.89: strong medical argument with clear rebuttal, imaging evidence, and correct terminology.
- 0.90-1.0: excellent, precise, complete, specialist-level reasoning.

Score dimensions:
- persuasion_score: whether the latest answer is enough to let the conversation progress now. This is not the final grade.
- debate_score: quality of rebuttal, specificity, handling of the doctor's objection, and argument structure.
- knowledge_score: medical/radiology correctness, terminology, and match to ground truth.

Caps:
- If the user gives only a conclusion without evidence, cap debate_score at 0.55.
- If terminology is wrong or anatomy/location is imprecise, cap knowledge_score at 0.65.
- If the answer is partly correct but misses a major required element, cap debate_score/knowledge_score strictly even if persuasion_score passes the convinced threshold.
- For REASONING, DDx, CONCLUSION, a merely plausible answer without explicit link to agreed findings cannot exceed 0.69.
Set "convinced": true only when the doctor's streamed reply explicitly accepts, concedes, or revises toward the user's position.
If the doctor still asks for proof, says they still do not see the finding, or requests more specific evidence, set "convinced": false even when persuasion_score is high.

Special rule for DESCRIBE:
- DESCRIBE is observation, not diagnostic debate.
- If the user correctly identifies even one concrete observation matching the DESCRIBE answer key, set convinced=true and persuasion_score >= 0.62.
- Do not require the user to list every expected finding, use perfect wording, or prove the observation as a debate argument.
- If the user is partly correct, grade the matched observation as enough to concede for DESCRIBE, but keep debate_score/knowledge_score modest unless the description is precise, localized, and uses correct imaging terms.
- For DESCRIBE, one correct but incomplete observation should usually score around 0.70-0.76, not 0.90.
- Keep convinced=false only when the latest user answer is off-topic, too vague to map to a visible finding, or contradicts the DESCRIBE answer key.

Current step: {step_code}
Doctor's initial stance for this step:
{doctor_step_seed}
DESCRIBE answer key for overlap check only:
{json.dumps({
    'expected_finding': describe_target.get('expected_finding', ''),
    'clinical_explanation': describe_target.get('clinical_explanation', ''),
    'key_points': describe_target.get('key_points', []),
}, ensure_ascii=False) if step_code == 'DESCRIBE' else '{}'}
Previous agreed answers:
{json.dumps(previous_agreed, ensure_ascii=False)}

Current-step conversation:
{_current_step_visible_history(messages, step_index, user_message)}

Doctor's streamed reply:
{doctor_message}

Return ONLY valid JSON:
{{
  "convinced": false,
  "persuasion_score": 0.0,
  "debate_score": 0.0,
  "knowledge_score": 0.0,
  "agreement_with_doctor": false,
  "user_challenges_doctor": false,
  "answer_key_overlap": 0.0,
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
    answer_key_overlap = _clamp_score(parsed.get('answer_key_overlap', 0))
    convinced_threshold = describe_convinced_threshold if step_code == 'DESCRIBE' else default_convinced_threshold
    convinced = bool(parsed.get('convinced', False)) and persuasion_score >= convinced_threshold
    if step_code == 'DESCRIBE':
        agreement_with_doctor = bool(parsed.get('agreement_with_doctor', False))
        user_challenges_doctor = bool(parsed.get('user_challenges_doctor', False))
        if agreement_with_doctor and persuasion_score >= describe_convinced_threshold:
            convinced = True
        elif user_challenges_doctor:
            convinced = bool(parsed.get('convinced', False)) and persuasion_score >= describe_convinced_threshold and answer_key_overlap >= 0.20
        elif not convinced and answer_key_overlap >= 0.20 and persuasion_score >= describe_convinced_threshold:
            convinced = True
    if _doctor_message_blocks_convinced(doctor_message):
        convinced = False
    debate_score, knowledge_score = _strict_online_component_scores(step_code, parsed, persuasion_score)
    return {
        'doctor_message': doctor_message,
        'convinced': convinced,
        'persuasion_score': persuasion_score,
        'debate_score': debate_score,
        'knowledge_score': knowledge_score,
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
Score strictly from 0.0-1.0. Penalize vague, lucky, or unsupported answers even if the final conclusion is correct.
Being marked convinced during the chat is only evidence that the flow progressed; it must not inflate the final score.
- debate_score: quality of debate, rebuttal, evidence use, argument structure, and whether the user addressed Dr. Swap's objections.
- knowledge_score: medical/radiology correctness, anatomy, terminology, causal reasoning, and match to ground truth.
- accuracy_score: step-level exactness score against the expected answer.
Strict grading scale:
- 0.0-0.3: wrong, irrelevant, unsafe, or empty.
- 0.4-0.5: mentions something relevant but is vague, unsupported, or materially incomplete.
- 0.6-0.69: partly correct with basic reasoning but missing major elements or specialist precision.
- 0.70-0.79: mostly correct and defensible, with some specific evidence, but still incomplete.
- 0.80-0.89: strong, well-supported, medically precise answer.
- 0.90-1.0: exceptional, complete, specialist-level answer with excellent rebuttal.
Caps:
- Conclusion without supporting imaging evidence: debate_score <= 0.55.
- Correct diagnosis but weak explanation: knowledge_score <= 0.70.
- Missing anatomy/location/modality-specific detail: knowledge_score <= 0.75.
- Does not address the doctor's objection: debate_score <= 0.65.
- DESCRIBE: one correct observation but incomplete description should usually be 0.70-0.76, not 0.90.
- A conceded answer that was only barely sufficient should usually remain below 0.75 for debate_score and knowledge_score.
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
            'debate_score': _strict_final_component_scores(by_code.get(code, {}))[0],
            'knowledge_score': _strict_final_component_scores(by_code.get(code, {}))[1],
            'accuracy_score': _strict_final_component_scores(by_code.get(code, {}))[2],
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


def _latest_doctor_step_message(messages: list[dict], step_index: int) -> str:
    for message in reversed(messages or []):
        if message.get('role') == 'doctor' and message.get('step_index') == step_index:
            return str(message.get('content') or '').strip()
    return ''


def _describe_agreement_summary(data: dict, message: str) -> str:
    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_states', 'step_codes')}
    step_index = session['current_step']
    summary = _latest_doctor_step_message(data.get('messages') or [], step_index) or message
    return _sanitize_consensus_summary(summary)


def _direct_describe_agreement_state(state: dict) -> dict[str, Any]:
    debate_score = state.get('debate_score')
    knowledge_score = state.get('knowledge_score')
    if debate_score is None:
        debate_score = state.get('debate_score_online', 0.72)
    if knowledge_score is None:
        knowledge_score = 0.72
    return {
        **state,
        'debate_score': debate_score,
        'knowledge_score': knowledge_score,
        'reasoning': state.get('reasoning') or 'User agreed with the current DESCRIBE consensus.',
        'debate_score_online': state.get('debate_score_online', debate_score),
        'reasoning_online': state.get('reasoning_online') or 'Direct DESCRIBE agreement.',
    }


def _store_swap_exchange(data: dict, message: str, result: dict[str, Any]) -> tuple[dict | None, Response | None]:
    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_states', 'step_codes')}
    answer_key = _answer_key_for_case(session['case_id'])
    sb = get_supabase()
    session_id = session['id']
    user_id = session['user_id']
    step_index = session['current_step']
    step_code = STEP_CODES[step_index]
    combined_score = _combined_score(result)

    # Advance only when the judge concedes and the visible doctor text is not still rejecting.
    advance = bool(result.get('convinced')) and not _doctor_message_blocks_convinced(result.get('doctor_message') or '')
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
        base_doctor_message = result['doctor_message']
        result['doctor_message'] = (
            f"{result['doctor_message']}\n\n"
            f"Phần thống nhất cho bước {step_code}: {pending_summary}\n"
            "Bạn có đồng ý với kết luận này để chuyển sang bước tiếp theo không?"
        )
        if step_index >= len(STEP_CODES) - 1:
            result['doctor_message'] = (
                f"{base_doctor_message}\n\n"
                f"Phần thống nhất cho bước {step_code}: {pending_summary}\n"
                "Bạn có đồng ý chốt kết luận này để hoàn thành case không?"
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
            next_message = _next_step_opening_message(
                session,
                data.get('step_states'),
                next_step,
                result.get('pending_summary') or '',
            )
            if next_message:
                try:
                    sb.table('swap_messages').insert({
                        'swap_session_id': session_id,
                        'role': 'doctor',
                        'step_index': next_step,
                        'content': next_message,
                        'metadata': {'source': 'agreed_context_plus_vlm'},
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
        next_message = _next_step_opening_message(
            session,
            data.get('step_states'),
            next_step,
            agreed_answer,
        )
        if next_message:
            sb.table('swap_messages').insert({
                'swap_session_id': session_id,
                'role': 'doctor',
                'step_index': next_step,
                'content': next_message,
                'metadata': {'source': 'agreed_context_plus_vlm'},
            }).execute()

    updated, updated_err = get_swap_session(session_id, user_id)
    if updated_err:
        return None, updated_err
    updated['last_result'] = result
    return updated, None


def _with_pending_step_summary(data: dict, step_index: int, summary: str, state: dict) -> dict:
    updated_data = {**data}
    states = [dict(item) for item in (data.get('step_states') or []) if item.get('step_index') != step_index]
    pending_state = _direct_describe_agreement_state(state)
    pending_state.update({
        'swap_session_id': data['id'],
        'step_index': step_index,
        'step_code': STEP_CODES[step_index],
        'phase': SWAP_PHASE_AWAITING_CONFIRMATION,
        'convinced': True,
        'pending_summary': summary,
        'agreed_answer': None,
    })
    states.append(pending_state)
    updated_data['step_states'] = states
    return updated_data


def _handle_direct_describe_agreement(data: dict, message: str) -> tuple[dict | None, Response | None] | None:
    session = {k: v for k, v in data.items() if k not in ('case', 'messages', 'scores', 'step_states', 'step_codes')}
    step_index = session['current_step']
    if STEP_CODES[step_index] != 'DESCRIBE' or not _is_step_agreement_message(message):
        return None

    state = _step_state_map(data.get('step_states')).get(step_index) or {}
    agreed_answer = _describe_agreement_summary(data, message)
    if not agreed_answer:
        return None

    pending_data = _with_pending_step_summary(data, step_index, agreed_answer, state)
    if _wants_next_step(message):
        return _confirm_swap_step(pending_data, message)

    sb = get_supabase()
    session_id = session['id']
    user_id = session['user_id']
    step_code = STEP_CODES[step_index]
    direct_state = _direct_describe_agreement_state(state)
    doctor_message = (
        f"Phần thống nhất cho bước {step_code}: {agreed_answer}\n"
        "Bạn có đồng ý với kết luận này để chuyển sang bước tiếp theo không?"
    )
    sb.table('swap_messages').insert([
        {
            'swap_session_id': session_id,
            'role': 'user',
            'step_index': step_index,
            'content': message,
            'metadata': {'direct_agreement': True},
        },
        {
            'swap_session_id': session_id,
            'role': 'doctor',
            'step_index': step_index,
            'content': doctor_message,
            'metadata': {
                'convinced': True,
                'pending_summary': agreed_answer,
                'direct_agreement': True,
            },
        },
    ]).execute()
    sb.table('swap_step_states').upsert({
        'swap_session_id': session_id,
        'step_index': step_index,
        'step_code': step_code,
        'phase': SWAP_PHASE_AWAITING_CONFIRMATION,
        'convinced': True,
        'pending_summary': agreed_answer,
        'agreed_answer': None,
        'debate_score': direct_state.get('debate_score'),
        'knowledge_score': direct_state.get('knowledge_score'),
        'reasoning': direct_state.get('reasoning') or '',
        'debate_score_online': direct_state.get('debate_score_online'),
        'reasoning_online': direct_state.get('reasoning_online') or '',
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }, on_conflict='swap_session_id,step_index').execute()

    updated, updated_err = get_swap_session(session_id, user_id)
    if updated_err:
        return None, updated_err
    updated['last_result'] = {
        'convinced': True,
        'awaiting_confirmation': True,
        'pending_summary': agreed_answer,
        'doctor_message': doctor_message,
        'persuasion_score': _combined_score(direct_state),
        'debate_score': direct_state.get('debate_score'),
        'knowledge_score': direct_state.get('knowledge_score'),
        'reasoning_for_grader': direct_state.get('reasoning') or '',
    }
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
    direct_agreement = _handle_direct_describe_agreement(data, message)
    if direct_agreement is not None:
        return direct_agreement

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
    direct_agreement = _handle_direct_describe_agreement(data, message)
    if direct_agreement is not None:
        updated, store_err = direct_agreement
        if store_err:
            yield _sse('error', {'error': getattr(store_err, 'data', {'error': 'Store failed'}).get('error', 'Store failed')})
            return
        yield _sse('done', {'session': updated, 'last_result': updated.get('last_result', {})})
        return

    describe_key = _answer_key_for_case(session['case_id']).get('DESCRIBE', {})
    step_code = STEP_CODES[session['current_step']]
    doctor_message = ''
    try:
        prompt = _doctor_text_prompt(session, data['case'], describe_key, data['messages'], message, data.get('step_states'))
        for delta in _stream_doctor_text(prompt):
            doctor_message += delta
            if step_code != 'DESCRIBE':
                yield _sse('delta', {'delta': delta})

        doctor_message = _strip_describe_diagnostic_leak(doctor_message, step_code)
        if step_code == 'DESCRIBE' and doctor_message:
            yield _sse('delta', {'delta': doctor_message})
        result = _judge_doctor_text(session, data['messages'], message, doctor_message, describe_key, data.get('step_states'))
        updated, store_err = _store_swap_exchange(data, message, result)
        if store_err:
            yield _sse('error', {'error': getattr(store_err, 'data', {'error': 'Store failed'}).get('error', 'Store failed')})
            return
        yield _sse('done', {'session': updated, 'last_result': result})
    except Exception as exc:
        logger.exception("swap stream failed: %s", exc)
        yield _sse('error', {'error': f'Doctor stream failed: {exc}', 'message': str(exc)})
