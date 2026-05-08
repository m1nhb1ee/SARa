"""
Upload services — Supabase Storage + HuggingFace image analysis.
Ported from huggingface_services.py; không còn dependency vào Django ORM.
"""
import os
import io
import uuid
import tempfile
import logging
from typing import Dict, Any, Optional

from app.config.model_config import (
    MEDGEMMA_GRADIO_SPACE_ID,
    OPENAI_IMAGE_ANALYSIS_MODEL,
    OPENAI_IMAGE_VALIDATION_MODEL,
    OPENAI_STEP_COMPLETION_MODEL,
)
from app.core.supabase_client import get_supabase
from app.prompt.gpt_prompt import build_gpt_four_step_analysis_prompt, build_gpt_final_steps_prompt
from app.prompt.medgemma_prompt import build_analysis_prompt

logger = logging.getLogger(__name__)

STEP_CODES = ['DESCRIBE', 'REASONING', 'DDx', 'CONCLUSION']
ANSWER_KEY_STEP_CODES = ['DESCRIBE', 'REASONING', 'DDx', 'CONCLUSION']


def _expected_step_codes(prompt_steps: int = 4) -> list[str]:
    if prompt_steps == 2:
        return ['DESCRIBE', 'REASONING']
    return ['DESCRIBE', 'REASONING', 'DDx', 'CONCLUSION']

STEP_TEMPLATES = {
    "DESCRIBE":   "Quan sát kỹ lưỡng các vùng của ảnh. Xác định vùng bất thường, mô tả chi tiết kích thước, hình dạng, vị trí, mật độ.",
    "REASONING": "Diễn giải ý nghĩa lâm sàng của các phát hiện và đề xuất chẩn đoán làm việc chính.",
    "DDx":       "Liệt kê chẩn đoán phân biệt cần loại trừ.",
    "CONCLUSION": "Kết luận chẩn đoán cuối cùng và khuyến cáo tiếp theo.",
}

MODALITY_MAP = {
    'XRAY': 'X-ray',
    'CT': 'CT',
    'MRI': 'MRI',
    'DIFF': 'Difference',
}


# ── Supabase Storage ───────────────────────────────────────────────────────────

def upload_image_to_storage(image_bytes: bytes, filename: str) -> str:
    """Upload ảnh lên Supabase Storage bucket 'case_images', trả về public URL."""
    sb = get_supabase()
    ext = os.path.splitext(filename)[1].lower() or '.jpg'
    content_type_map = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png'}
    content_type = content_type_map.get(ext, 'image/jpeg')
    unique_name = f"uploads/{uuid.uuid4()}{ext}"
    sb.storage.from_('case_images').upload(
        unique_name,
        image_bytes,
        file_options={'content-type': content_type, 'upsert': 'true'},
    )
    return sb.storage.from_('case_images').get_public_url(unique_name)


def create_case_in_supabase(
    user_id: str,
    images: list,
    modality: str,
    title: str,
    findings: dict,
    clinical_history: str = '',
) -> dict:
    """
    Ghi case + case_images + answer_keys + upload_session vào Supabase.
    images: [{'image_url': str, 'slice_index': int | None}, ...]
    Trả về {'upload_session': ..., 'case': ...}.
    """
    sb = get_supabase()

    user_exists = sb.table('users').select('id').eq('id', user_id).execute()
    if not user_exists.data:
        sb.table('users').insert({'id': user_id, 'email': f'{user_id}@auto.local', 'role': 'student'}).execute()

    case_result = sb.table('cases').insert({
        'uploaded_by': user_id,
        'source': 'uploaded',
        'title': title,
        'modality': MODALITY_MAP.get(modality, 'X-ray'),
        'difficulty': 'medium',
        'clinical_history': (clinical_history or '').strip(),
        'status': 'published',
    }).execute()
    case = case_result.data[0]

    sb.table('case_images').insert([
        {
            'case_id':    case['id'],
            'image_url':  img['image_url'],
            'slice_index': img.get('slice_index'),
            'volume_name': img.get('volume_name', 'Default'),
        }
        for img in images
    ]).execute()

    answer_key = findings.get('answer_key', {})
    rows = [
        {
            'case_id': case['id'],
            'step_order': i,
            'step_code': code,
            'expected_finding': str(answer_key.get(code, '')),
            'clinical_explanation': findings.get('description', ''),
            'key_points': [],
        }
        for i, code in enumerate(ANSWER_KEY_STEP_CODES)
        if code in answer_key
    ]
    if rows:
        sb.table('answer_keys').insert(rows).execute()

    upload_session = sb.table('upload_sessions').insert({
        'user_id': user_id,
        'case_id': case['id'],
        'modality': modality,
    }).execute().data[0]

    return {'upload_session': upload_session, 'case': case}


def find_case_by_image_url(image_url: str) -> dict | None:
    """Tìm case theo image_url qua bảng case_images."""
    sb = get_supabase()
    try:
        result = sb.table('case_images').select('case_id').eq('image_url', image_url).execute()
        if not result.data:
            return None
        case_id = result.data[0]['case_id']
        case_result = sb.table('cases').select('id, title').eq('id', case_id).single().execute()
        return case_result.data
    except Exception:
        return None


def _extract_storage_path(image_url: str) -> Optional[str]:
    """Trích xuất file path trong bucket từ Supabase Storage public URL."""
    marker = '/case_images/'
    idx = image_url.find(marker)
    if idx == -1:
        return None
    return image_url[idx + len(marker):]


def delete_uploaded_case(upload_session_id: str, user_id: str) -> dict:
    """
    Xóa toàn bộ dữ liệu của một upload do user tạo.
    Cascade: sessions → answer_keys → upload_session → case → Storage image.
    Chỉ cho phép nếu upload_session.user_id == user_id.
    """
    sb = get_supabase()

    # 1. Lấy upload_session và kiểm tra quyền sở hữu
    try:
        result = sb.table('upload_sessions').select(
            'id, user_id, case_id'
        ).eq('id', upload_session_id).single().execute()
    except Exception:
        raise ValueError('Upload session not found')

    upload: dict = result.data  # type: ignore[assignment]
    if upload['user_id'] != user_id:
        raise PermissionError('Bạn không có quyền xóa upload này')

    case_id: Optional[str] = upload.get('case_id')

    # 2. Lấy danh sách image_urls từ case_images trước khi xóa case
    image_urls: list[str] = []
    if case_id:
        try:
            imgs = sb.table('case_images').select('image_url').eq('case_id', case_id).execute()
            image_urls = [r['image_url'] for r in (imgs.data or [])]
        except Exception as e:
            logger.warning(f"Could not fetch case_images for case {case_id}: {e}")

    # 3. Xóa các practice sessions liên quan đến case
    if case_id:
        try:
            sb.table('sessions').delete().eq('case_id', case_id).execute()
            logger.info(f"Deleted sessions for case {case_id}")
        except Exception as e:
            logger.warning(f"Could not delete sessions for case {case_id}: {e}")

    # 4. Xóa answer_keys
    if case_id:
        try:
            sb.table('answer_keys').delete().eq('case_id', case_id).execute()
            logger.info(f"Deleted answer_keys for case {case_id}")
        except Exception as e:
            logger.warning(f"Could not delete answer_keys for case {case_id}: {e}")

    # 5. Xóa upload_session
    sb.table('upload_sessions').delete().eq('id', upload_session_id).execute()
    logger.info(f"Deleted upload_session {upload_session_id}")

    # 6. Xóa case (cascade xóa case_images)
    if case_id:
        try:
            sb.table('cases').delete().eq('id', case_id).execute()
            logger.info(f"Deleted case {case_id}")
        except Exception as e:
            logger.warning(f"Could not delete case {case_id}: {e}")

    # 7. Xóa ảnh khỏi Supabase Storage (best-effort)
    for url in image_urls:
        try:
            path = _extract_storage_path(url)
            if path:
                sb.storage.from_('case_images').remove([path])
                logger.info(f"Deleted storage file: {path}")
        except Exception as e:
            logger.warning(f"Could not delete storage image {url}: {e}")

    return {
        'deleted': True,
        'upload_session_id': upload_session_id,
        'case_id': case_id,
    }


# ── HuggingFace / Gradio ───────────────────────────────────────────────────────

def _get_hf_token() -> Optional[str]:
    token = os.getenv("HF_TOKEN", "").strip() or os.getenv("HF_API_KEY", "").strip()
    if not token:
        logger.warning("HF_TOKEN không được set — dùng mock mode")
        return None
    return token


def _to_temp_file(image_file) -> tuple:
    """Chuyển image_file (bytes, file-like, path) thành file tạm. Returns (path, suffix)."""
    suffix = ".jpg"

    if isinstance(image_file, (bytes, bytearray)):
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(image_file)
            return tmp.name, suffix

    if hasattr(image_file, 'chunks'):
        name = getattr(image_file, 'name', '') or ''
        suffix = os.path.splitext(name)[1] or '.jpg'
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            for chunk in image_file.chunks():
                tmp.write(chunk)
            return tmp.name, suffix

    if hasattr(image_file, 'read'):
        name = getattr(image_file, 'name', '') or ''
        suffix = os.path.splitext(name)[1] or '.jpg'
        if hasattr(image_file, 'seek'):
            image_file.seek(0)
        data = image_file.read()
        if hasattr(image_file, 'seek'):
            image_file.seek(0)
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(data)
            return tmp.name, suffix

    path = str(image_file)
    if os.path.isfile(path):
        return path, os.path.splitext(path)[1] or '.jpg'

    raise ValueError(f"Không đọc được ảnh từ kiểu: {type(image_file)}")


def classify_and_validate_images(
    image_bytes_list: list,
    volume_names: list,
    declared_modality: str,
) -> dict:
    """
    Gọi GPT-4o Vision để:
    1. Kiểm tra ảnh có phải ảnh y tế không (không phải ảnh chụp thường, screenshot, v.v.)
    2. Kiểm tra các ảnh trong cùng 1 volume có cùng loại/sequence không

    Returns:
        {
            'valid': bool,
            'error_type': None | 'not_medical' | 'inconsistent_volume',
            'issues': [str],   # tiếng Việt, hiển thị thẳng cho user
            'classifications': [{'index': int, 'volume': str, 'is_medical': bool, 'type': str}]
        }

    Nếu không có OPENAI_API_KEY hoặc GPT-4o call thất bại: trả về valid=True (skip validation).
    """
    import base64
    import json
    from openai import OpenAI

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — bỏ qua bước kiểm tra ảnh y tế")
        return {'valid': True, 'error_type': None, 'issues': [], 'classifications': []}

    # Lấy tối đa 2 ảnh/volume, tổng không quá 6 ảnh để gọi GPT-4o nhanh
    volume_to_indices: dict = {}
    for i, vol in enumerate(volume_names):
        volume_to_indices.setdefault(vol, []).append(i)

    sample_indices: list[int] = []
    for indices in volume_to_indices.values():
        sample_indices.extend(indices[:2])
    sample_indices = sample_indices[:6]

    image_contents = []
    for idx in sample_indices:
        b64 = base64.b64encode(image_bytes_list[idx]).decode('utf-8')
        image_contents.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "low"},
        })

    volume_info = ', '.join(
        f'Image {idx} → volume="{volume_names[idx]}"' for idx in sample_indices
    )

    prompt = f"""Classify each image shown.

Context: a radiology education platform is validating user-uploaded files.
Declared scan type: {declared_modality}
Image index → volume group: {volume_info}

Task — for each image:
1. Identify the imaging technique shown (e.g. "X-ray", "CT axial", "MRI T2", "MRI T1", "Ultrasound", "Pathology slide").
   If the image is NOT a medical/radiological scan (e.g. a regular photo, screenshot, diagram), set is_medical=false.
2. Note which volume group it belongs to (given above).

After classifying all images, check: within each volume group, do all images show the same imaging technique and sequence?

Return ONLY valid JSON, no markdown:
{{
  "images": [
    {{"index": 0, "volume": "Default", "is_medical": true, "type": "MRI T2 axial brain"}},
    {{"index": 1, "volume": "Default", "is_medical": true, "type": "MRI T2 axial brain"}}
  ],
  "issues": []
}}

Populate "issues" (in Vietnamese) only when:
- An image is not a medical scan: "Ảnh số {{n}} (volume: '{{vol}}') không phải ảnh y tế. Vui lòng chỉ upload ảnh chẩn đoán hình ảnh."
- A volume group contains images of different types: "Volume '{{vol}}' chứa ảnh không nhất quán: {{types found}}. Vui lòng upload cùng 1 loại ảnh trong 1 volume."
"""

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=OPENAI_IMAGE_VALIDATION_MODEL,
            messages=[{
                "role": "user",
                "content": [{"type": "text", "text": prompt}, *image_contents],
            }],
            max_tokens=5000,
        )
        raw = (response.choices[0].message.content or '').strip()
        logger.info(f"[image-validation] GPT-4o response: {raw}")

        # GPT-4o content-policy refusal → skip validation gracefully
        _lower = raw.lower()
        if (
            raw.startswith("I'm sorry") or
            "i can't assist" in _lower or
            "i cannot assist" in _lower or
            "unable to assist" in _lower or
            raw.find('{') < 0
        ):
            logger.warning(f"[image-validation] GPT-4o từ chối phân tích — bỏ qua validation: {raw[:80]}")
            return {'valid': True, 'error_type': None, 'issues': [], 'classifications': []}

        j_start = raw.find('{')
        j_end = raw.rfind('}') + 1
        parsed = json.loads(raw[j_start:j_end])

        classifications = parsed.get('images', [])
        issues = [s.strip() for s in parsed.get('issues', []) if s.strip()]

        has_non_medical = any(not c.get('is_medical', True) for c in classifications)
        error_type = None
        if has_non_medical:
            error_type = 'not_medical'
        elif issues:
            error_type = 'inconsistent_volume'

        return {
            'valid': len(issues) == 0,
            'error_type': error_type,
            'issues': issues,
            'classifications': classifications,
        }

    except Exception as e:
        logger.warning(f"[image-validation] GPT-4o call thất bại: {e} — bỏ qua validation")
        return {'valid': True, 'error_type': None, 'issues': [], 'classifications': []}


def _call_gradio(image_files: list, prompt: str, token: str) -> str:
    from gradio_client import Client, handle_file

    tmp_paths = []
    try:
        for image_file in image_files:
            tmp_path, _ = _to_temp_file(image_file)
            tmp_paths.append(tmp_path)

        gallery = [{"image": handle_file(p), "caption": None} for p in tmp_paths]
        logger.info(f"Gọi Gradio Space [{MEDGEMMA_GRADIO_SPACE_ID}] — images={len(gallery)}")
        client = Client(MEDGEMMA_GRADIO_SPACE_ID, token=token, httpx_kwargs={"timeout": 300})
        job = client.submit(gallery=gallery, question=prompt, api_name="/analyze")
        result = job.result(timeout=300)
        logger.debug(f"[VLM answer]\n{result}")
        return str(result)
    finally:
        for tmp_path in tmp_paths:
            if tmp_path and os.path.isfile(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass


def _call_gpt_vision(image_files: list, prompt: str) -> str:
    import base64
    from openai import OpenAI

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is required when engine='gpt'")

    image_contents = []
    for image_file in image_files:
        if not isinstance(image_file, (bytes, bytearray)):
            with open(str(image_file), 'rb') as f:
                image_bytes = f.read()
        else:
            image_bytes = image_file

        b64 = base64.b64encode(image_bytes).decode('utf-8')
        image_contents.append({
            "type": "image_url",
            "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "high"},
        })

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=OPENAI_IMAGE_ANALYSIS_MODEL,
        messages=[{
            "role": "user",
            "content": [{"type": "text", "text": prompt}, *image_contents],
        }],
        max_completion_tokens=5000,
    )
    return (response.choices[0].message.content or '').strip()


def _parse_findings(description: str, modality: str, prompt_steps: int = 4, source: str = "MedGemma") -> Dict[str, Any]:
    import json
    import re

    all_fallback = {
        "DESCRIBE":   "Observation details",
        "REASONING": "Reasoning details",
        "DDx":       _get_ddx(modality),
        "CONCLUSION": _get_conclusion(modality),
    }
    expected_steps = _expected_step_codes(prompt_steps)
    fallback = {code: all_fallback[code] for code in expected_steps}

    text = (description or '').strip()
    logger.debug(f"[_parse_findings] raw VLM output:\n{text}")

    try:
        j_start = text.find('{')
        j_end = text.rfind('}') + 1
        if j_start >= 0 and j_end > j_start:
            parsed = json.loads(text[j_start:j_end])
            answer_key = {
                k: str(parsed.get(k, fallback[k])).strip()
                for k in fallback
            }
            return _build_response(answer_key, text, modality, expected_steps, source)
    except Exception:
        pass

    try:
        patterns = {
            "DESCRIBE":   r"(?:1\.|DESCRIBE|Describe)[:\s]*([\s\S]+?)(?=\n\s*2\.|REASONING|$)",
            "REASONING": r"(?:2\.|REASONING|Reasoning)[:\s]*([\s\S]+?)(?=\n\s*3\.|DDx|$)",
            "DDx":       r"(?:3\.|DDx|Differential)[:\s]*([\s\S]+?)(?=\n\s*4\.|CONCLUSION|$)",
            "CONCLUSION": r"(?:4\.|CONCLUSION|Conclusion)[:\s]*([\s\S]+?)$",
        }
        sections = {}
        for step, pattern in patterns.items():
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                content = re.sub(r'\*\*(.+?)\*\*', r'\1', m.group(1).strip())
                content = re.sub(r'- ', '', content).replace('\n', ' ').strip()
                sections[step] = content[:500]
        logger.debug(f"[_parse_findings] regex matched sections: {list(sections.keys())}")
        if sections:
            fallback.update({code: sections[code] for code in expected_steps if code in sections})
            return _build_response(fallback, text, modality, expected_steps, source)
    except Exception as e:
        logger.debug(f"[_parse_findings] regex parse error: {e}")

    logger.warning("[_parse_findings] all parse attempts failed — using fallback")
    return _build_response(fallback, text, modality, expected_steps, source)


def _build_response(answer_key: dict, raw: str, modality: str, step_codes: list[str], source: str) -> Dict[str, Any]:
    summary = " ".join([
        answer_key.get("DESCRIBE", "")[:80],
        answer_key.get("REASONING", "")[:80],
    ])[:200]
    return {
        "title":            f"{modality} Case – MedGemma",
        "description":      summary,
        "clinical_history": f"AI (MedGemma) analyzed {modality}: {summary[:100]}",
        "raw_findings":     raw,
        "confidence":       0.82,
        "answer_key":       answer_key,
        "pipeline_rubric":  {code: STEP_TEMPLATES[code] for code in step_codes},
    }


def _complete_final_steps_with_llm(findings: Dict[str, Any], modality: str, region: str) -> Dict[str, Any]:
    """
    Generate DDx and CONCLUSION from the VLM's DESCRIBE/REASONING output.
    If the LLM is unavailable, keep the VLM result and fill conservative defaults.
    """
    import json

    answer_key = findings.get('answer_key') or {}
    describe = str(answer_key.get('DESCRIBE', '')).strip()
    reasoning = str(answer_key.get('REASONING', '')).strip()

    fallback = {
        'DDx': _get_ddx(modality),
        'CONCLUSION': _get_conclusion(modality),
    }

    api_key = os.environ.get('OPENAI_API_KEY')
    if not api_key:
        logger.warning("OPENAI_API_KEY not set — using default DDx/CONCLUSION completion")
        completed = fallback
    else:
        raw_vlm = str(findings.get('raw_findings', '') or f"DESCRIBE: {describe}\nREASONING: {reasoning}").strip()
        prompt = build_gpt_final_steps_prompt(modality, region, raw_vlm)

        try:
            from openai import OpenAI

            client = OpenAI(api_key=api_key)
            response = client.chat.completions.create(
                model=OPENAI_STEP_COMPLETION_MODEL,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=800,
            )
            raw = (response.choices[0].message.content or '').strip()
            logger.debug(f"[LLM completion answer]\n{raw}")
            j_start = raw.find('{')
            j_end = raw.rfind('}') + 1
            parsed = json.loads(raw[j_start:j_end])
            completed = {
                'DDx': str(parsed.get('DDx') or fallback['DDx']).strip(),
                'CONCLUSION': str(parsed.get('CONCLUSION') or fallback['CONCLUSION']).strip(),
            }
            findings['llm_completion_raw'] = raw
            logger.info("LLM completion generated DDx and CONCLUSION")
        except Exception as e:
            logger.warning(f"LLM completion failed: {e} — using default DDx/CONCLUSION")
            completed = fallback

    findings['answer_key'] = {
        'DESCRIBE': describe or 'Observation details',
        'REASONING': reasoning or 'Reasoning details',
        **completed,
    }
    findings['pipeline_rubric'] = {code: STEP_TEMPLATES[code] for code in STEP_CODES}
    summary = " ".join([
        findings['answer_key'].get('DESCRIBE', '')[:80],
        findings['answer_key'].get('REASONING', '')[:80],
    ])[:200]
    findings['description'] = summary
    findings['clinical_history'] = f"AI (MedGemma + LLM) analyzed {modality}: {summary[:100]}"
    return findings


def _get_ddx(modality: str) -> str:
    return {
        "XRAY": "Lao phổi, ung thư phổi, edema phổi, hemothorax, viêm phổi.",
        "CT":   "U não, máu tụ nội sọ, nhồi máu não, viêm màng não.",
        "MRI":  "Thoát vị đĩa đệm, u tủy, xơ cứng rải rác, viêm.",
        "DIFF": "U lành/ác tính, nang, viêm, xơ hóa.",
    }.get(modality, "Cần tư vấn chuyên khoa.")


def _get_conclusion(modality: str) -> str:
    return {
        "XRAY": "Cần xét nghiệm máu CBC, cấy đờm, theo dõi lâm sàng 48–72h.",
        "CT":   "Tham khảo thần kinh học. Xem xét MRI bổ sung nếu cần.",
        "MRI":  "Tư vấn chỉnh hình / thần kinh. Theo dõi định kỳ.",
        "DIFF": "Theo dõi định kỳ. Sinh thiết nếu nghi ngờ ác tính.",
    }.get(modality, "Cần tư vấn bác sĩ chuyên khoa.")


def _mock_analyze(modality: str, prompt_steps: int = 4) -> Dict[str, Any]:
    mock_keys = {
        "XRAY": {
            "DESCRIBE":   "Phổi trái bình thường; phổi phải có đám mờ ~3–4 cm, bờ không rõ, vị trí thùy dưới phải.",
            "REASONING": "Mật độ cao gợi ý infiltrate — viêm phổi hoặc phù. Chẩn đoán làm việc: viêm phổi thùy dưới phổi phải.",
            "DDx":       "Lao phổi, ung thư phổi, edema phổi, hemothorax, viêm phổi.",
            "CONCLUSION": "Cần xét nghiệm máu CBC, cấy đờm, theo dõi lâm sàng 48–72h.",
        },
        "CT": {
            "DESCRIBE":   "Não bình thường, không thấy máu tụ; các thất não và mô trắng không dị thường; cột sống bình thường.",
            "REASONING": "Không có bất thường bệnh lý rõ ràng. Chẩn đoán làm việc: não bình thường.",
            "DDx":       "U não, máu tụ nội sọ, nhồi máu não, viêm màng não.",
            "CONCLUSION": "Tham khảo thần kinh học. Xem xét MRI bổ sung nếu cần.",
        },
        "MRI": {
            "DESCRIBE":   "Tín hiệu T2 tăng ở vùng nghi ngờ; tổn thương khu trú, bờ rõ, tín hiệu dị thường.",
            "REASONING": "Gợi ý tổn thương mô mềm hoặc viêm. Chẩn đoán làm việc: viêm hoặc u lành tính.",
            "DDx":       "Thoát vị đĩa đệm, u tủy, xơ cứng rải rác, viêm.",
            "CONCLUSION": "Tư vấn chỉnh hình / thần kinh. Theo dõi định kỳ.",
        },
        "DIFF": {
            "DESCRIBE":   "Cấu trúc cơ quan bình thường; kích thước bình thường, echo đồng nhất; không thấy khối.",
            "REASONING": "Không có bất thường rõ. Chẩn đoán làm việc: bình thường.",
            "DDx":       "U lành/ác tính, nang, viêm, xơ hóa.",
            "CONCLUSION": "Theo dõi siêu âm định kỳ. Sinh thiết nếu nghi ngờ ác tính.",
        },
    }
    step_codes = _expected_step_codes(prompt_steps)
    answer_key = mock_keys.get(modality, mock_keys["XRAY"])
    return {
        "title":            f"{modality} Case – Mock",
        "description":      f"Mock analysis of {modality} image.",
        "clinical_history": f"Mock patient — {modality}",
        "raw_findings":     "Mock findings (Gradio call failed or HF_TOKEN not set)",
        "confidence":       0.65,
        "answer_key":       {code: answer_key[code] for code in step_codes},
        "pipeline_rubric":  {code: STEP_TEMPLATES[code] for code in step_codes},
    }


def analyze_medical_image(
    image_files: list,
    modality: str = "XRAY",
    region: str = "unspecified",
    volume_names: list | None = None,
    prompt_steps: int = 4,
    complete_final_steps_with_llm: bool = False,
    engine: str = "vlm",
) -> Dict[str, Any]:
    """Entry point: phân tích ảnh y tế, trả về findings dict."""
    total_slices = len(image_files) if image_files else None
    if engine == "gpt":
        prompt = build_gpt_four_step_analysis_prompt(modality, region, total_slices, volume_names)
        raw = _call_gpt_vision(image_files, prompt)
        logger.debug(f"[GPT vision answer]\n{raw}")
        return _parse_findings(raw, modality, 4, source="GPT")

    prompt = build_analysis_prompt(modality, region, total_slices, volume_names, steps=prompt_steps)
    logger.info(f"Bắt đầu phân tích — modality={modality}, region={region}, total_slices={total_slices}, prompt_steps={prompt_steps}, volumes={list(dict.fromkeys(volume_names or []))}")
    token = _get_hf_token()
    if not token:
        findings = _mock_analyze(modality, prompt_steps)
        if complete_final_steps_with_llm:
            return _complete_final_steps_with_llm(findings, modality, region)
        return findings
    try:
        logger.debug(f"[MedGemma prompt]\n{prompt}")
        raw = _call_gradio(image_files, prompt, token)
        logger.info(f"Phân tích hoàn tất — modality={modality}, region={region}")
        findings = _parse_findings(raw, modality, prompt_steps)
        if complete_final_steps_with_llm:
            return _complete_final_steps_with_llm(findings, modality, region)
        return findings
    except ImportError:
        logger.error("gradio_client chưa được cài. Chạy: pip install gradio-client")
        findings = _mock_analyze(modality, prompt_steps)
        if complete_final_steps_with_llm:
            return _complete_final_steps_with_llm(findings, modality, region)
        return findings
    except Exception as e:
        logger.error(f"Gradio call thất bại: {e}", exc_info=True)
        findings = _mock_analyze(modality, prompt_steps)
        if complete_final_steps_with_llm:
            return _complete_final_steps_with_llm(findings, modality, region)
        return findings
