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

from app.core.supabase_client import get_supabase
from app.prompt.medgemma_prompt import build_analysis_prompt

logger = logging.getLogger(__name__)

GRADIO_SPACE_ID = "ttnguyen6716/MedGemma-1.5-4B"

STEP_CODES = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']
ANSWER_KEY_STEP_CODES = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']

STEP_TEMPLATES = {
    "OBSERVE":    "Quan sát kỹ lưỡng các vùng của ảnh. Xác định vùng bất thường.",
    "DESCRIBE":   "Mô tả chi tiết các đặc điểm: kích thước, hình dạng, vị trí, mật độ.",
    "INTERPRET":  "Diễn giải ý nghĩa lâm sàng của các phát hiện.",
    "HYPOTHESIS": "Đề xuất chẩn đoán dự phòng chính dựa trên hình ảnh.",
    "DDx":        "Liệt kê chẩn đoán phân biệt cần loại trừ.",
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
        'clinical_history': findings.get('clinical_history', ''),
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


def _call_gradio(
    image_files: list, modality: str, region: str, token: str,
    total_slices: int | None = None,
    volume_names: list | None = None,
) -> str:
    from gradio_client import Client, handle_file

    question = build_analysis_prompt(modality, region, total_slices, volume_names)

    tmp_paths = []
    try:
        for image_file in image_files:
            tmp_path, _ = _to_temp_file(image_file)
            tmp_paths.append(tmp_path)

        gallery = [{"image": handle_file(p), "caption": None} for p in tmp_paths]
        logger.info(f"Gọi Gradio Space [{GRADIO_SPACE_ID}] — modality={modality}, region={region}, images={len(gallery)}")
        client = Client(GRADIO_SPACE_ID, token=token)
        result = client.predict(
            gallery=gallery,
            question=question,
            api_name="/analyze"
        )
        return str(result)
    finally:
        for tmp_path in tmp_paths:
            if tmp_path and os.path.isfile(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass


def _parse_findings(description: str, modality: str) -> Dict[str, Any]:
    import json
    import re

    fallback = {
        "OBSERVE":    "Observation details",
        "DESCRIBE":   "Description details",
        "INTERPRET":  "Interpretation details",
        "HYPOTHESIS": "Hypothesis details",
        "DDx":        _get_ddx(modality),
        "CONCLUSION": _get_conclusion(modality),
    }

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
            return _build_response(answer_key, text, modality)
    except Exception:
        pass

    try:
        patterns = {
            "OBSERVE":    r"(?:1\.|OBSERVE|Observation)[:\s]*([\s\S]+?)(?=\n\s*2\.|DESCRIBE|$)",
            "DESCRIBE":   r"(?:2\.|DESCRIBE|Description)[:\s]*([\s\S]+?)(?=\n\s*3\.|INTERPRET|$)",
            "INTERPRET":  r"(?:3\.|INTERPRET|Interpretation)[:\s]*([\s\S]+?)(?=\n\s*4\.|HYPOTHESIS|$)",
            "HYPOTHESIS": r"(?:4\.|HYPOTHESIS|Hypothesis)[:\s]*([\s\S]+?)(?=\n\s*5\.|DDx|$)",
            "DDx":        r"(?:5\.|DDx|Differential)[:\s]*([\s\S]+?)(?=\n\s*6\.|CONCLUSION|$)",
            "CONCLUSION": r"(?:6\.|CONCLUSION|Conclusion)[:\s]*([\s\S]+?)$",
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
            fallback.update(sections)
            return _build_response(fallback, text, modality)
    except Exception as e:
        logger.debug(f"[_parse_findings] regex parse error: {e}")

    logger.warning("[_parse_findings] all parse attempts failed — using fallback")
    return _build_response(fallback, text, modality)


def _build_response(answer_key: dict, raw: str, modality: str) -> Dict[str, Any]:
    summary = " ".join([
        answer_key.get("OBSERVE", "")[:80],
        answer_key.get("DESCRIBE", "")[:80],
    ])[:200]
    return {
        "title":            f"{modality} Case – MedGemma",
        "description":      summary,
        "clinical_history": f"AI (MedGemma) analyzed {modality}: {summary[:100]}",
        "raw_findings":     raw,
        "confidence":       0.82,
        "answer_key":       answer_key,
        "pipeline_rubric":  STEP_TEMPLATES.copy(),
    }


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


def _mock_analyze(modality: str) -> Dict[str, Any]:
    mock_keys = {
        "XRAY": {
            "OBSERVE":    "Phổi trái bình thường; phổi phải có mờ phím nhẹ ở thùy dưới.",
            "DESCRIBE":   "Đám mờ ~3–4 cm, bờ không rõ, vị trí thùy dưới phải.",
            "INTERPRET":  "Mật độ cao gợi ý infiltrate — viêm phổi hoặc phù.",
            "HYPOTHESIS": "Viêm phổi thùy dưới phổi phải.",
            "DDx":        "Lao phổi, ung thư phổi, edema phổi, hemothorax, viêm phổi.",
            "CONCLUSION": "Cần xét nghiệm máu CBC, cấy đờm, theo dõi lâm sàng 48–72h.",
        },
        "CT": {
            "OBSERVE":    "Não bình thường, không thấy máu tụ; cột sống bình thường.",
            "DESCRIBE":   "Các thất não bình thường, mô trắng không dị thường.",
            "INTERPRET":  "Không có bất thường bệnh lý rõ ràng.",
            "HYPOTHESIS": "Não bình thường.",
            "DDx":        "U não, máu tụ nội sọ, nhồi máu não, viêm màng não.",
            "CONCLUSION": "Tham khảo thần kinh học. Xem xét MRI bổ sung nếu cần.",
        },
        "MRI": {
            "OBSERVE":    "Tín hiệu T2 tăng ở vùng nghi ngờ.",
            "DESCRIBE":   "Tổn thương khu trú, bờ rõ, tín hiệu dị thường.",
            "INTERPRET":  "Gợi ý tổn thương mô mềm hoặc viêm.",
            "HYPOTHESIS": "Viêm hoặc u lành tính.",
            "DDx":        "Thoát vị đĩa đệm, u tủy, xơ cứng rải rác, viêm.",
            "CONCLUSION": "Tư vấn chỉnh hình / thần kinh. Theo dõi định kỳ.",
        },
        "DIFF": {
            "OBSERVE":    "Cấu trúc cơ quan bình thường; không thấy khối.",
            "DESCRIBE":   "Kích thước bình thường, echo đồng nhất.",
            "INTERPRET":  "Không có bất thường rõ.",
            "HYPOTHESIS": "Bình thường.",
            "DDx":        "U lành/ác tính, nang, viêm, xơ hóa.",
            "CONCLUSION": "Theo dõi siêu âm định kỳ. Sinh thiết nếu nghi ngờ ác tính.",
        },
    }
    return {
        "title":            f"{modality} Case – Mock",
        "description":      f"Mock analysis of {modality} image.",
        "clinical_history": f"Mock patient — {modality}",
        "raw_findings":     "Mock findings (Gradio call failed or HF_TOKEN not set)",
        "confidence":       0.65,
        "answer_key":       mock_keys.get(modality, mock_keys["XRAY"]),
        "pipeline_rubric":  STEP_TEMPLATES.copy(),
    }


def analyze_medical_image(
    image_files: list,
    modality: str = "XRAY",
    region: str = "unspecified",
    volume_names: list | None = None,
) -> Dict[str, Any]:
    """Entry point: phân tích ảnh y tế, trả về findings dict."""
    total_slices = len(image_files) if image_files else None
    logger.info(f"Bắt đầu phân tích — modality={modality}, region={region}, total_slices={total_slices}, volumes={list(dict.fromkeys(volume_names or []))}")
    token = _get_hf_token()
    if not token:
        return _mock_analyze(modality)
    try:
        raw = _call_gradio(image_files, modality, region, token, total_slices, volume_names)
        logger.info(f"Phân tích hoàn tất — modality={modality}, region={region}")
        return _parse_findings(raw, modality)
    except ImportError:
        logger.error("gradio_client chưa được cài. Chạy: pip install gradio-client")
        return _mock_analyze(modality)
    except Exception as e:
        logger.error(f"Gradio call thất bại: {e}", exc_info=True)
        return _mock_analyze(modality)
