"""
Hugging Face AI Services - Medical Image Analysis
Sử dụng MedGemma qua Gradio Space: ttnguyen6716/MedGemma-1.5-4B
(Cùng cơ chế với endpoint /api/v1/analyze-image/ đang hoạt động)

Yêu cầu:
  HF_TOKEN = hf_xxx...   (cùng biến với MockAIAgent.analyze_image)

KHÔNG dùng router.huggingface.co — dùng gradio_client giống ai_services.py
"""

import os
import io
import tempfile
import logging
from typing import Dict, Any, Optional
from PIL import Image

logger = logging.getLogger(__name__)

# Gradio Space ID — cùng với ai_services.py
GRADIO_SPACE_ID = "ttnguyen6716/MedGemma-1.5-4B"

STEP_TEMPLATES = {
    "OBSERVE":    "Quan sát kỹ lưỡng các vùng của ảnh. Xác định vùng bất thường.",
    "DESCRIBE":   "Mô tả chi tiết các đặc điểm: kích thước, hình dạng, vị trí, mật độ.",
    "INTERPRET":  "Diễn giải ý nghĩa lâm sàng của các phát hiện.",
    "HYPOTHESIS": "Đề xuất chẩn đoán dự phòng chính dựa trên hình ảnh.",
    "DDx":        "Liệt kê chẩn đoán phân biệt cần loại trừ.",
    "CONCLUSION": "Kết luận chẩn đoán cuối cùng và khuyến cáo tiếp theo.",
}


class HuggingFaceImageAnalyzer:

    STEP_TEMPLATES = STEP_TEMPLATES

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def get_hf_token() -> Optional[str]:
        # Ưu tiên HF_TOKEN (cùng với ai_services.py), fallback HF_API_KEY
        token = os.getenv("HF_TOKEN", "").strip() or os.getenv("HF_API_KEY", "").strip()
        if not token:
            logger.warning("HF_TOKEN không được set — dùng mock mode")
            return None
        return token

    @staticmethod
    def _to_temp_file(image_file) -> tuple:
        """
        Chuyển image_file (Django FieldFile / UploadedFile / bytes / PIL / path)
        thành file tạm trên disk. Trả về (tmp_path, suffix).
        Caller chịu trách nhiệm xoá file sau khi dùng.
        """
        suffix = ".jpg"

        # PIL Image
        if isinstance(image_file, Image.Image):
            buf = io.BytesIO()
            image_file.save(buf, format="JPEG")
            data = buf.getvalue()
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(data)
                return tmp.name, suffix

        # bytes / bytearray
        if isinstance(image_file, (bytes, bytearray)):
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(image_file)
                return tmp.name, suffix

        # Django FieldFile (upload.original_image)
        if hasattr(image_file, "open") and hasattr(image_file, "storage"):
            name = getattr(image_file, "name", "") or ""
            suffix = os.path.splitext(name)[1] or ".jpg"
            with image_file.open("rb") as f:
                data = f.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(data)
                return tmp.name, suffix

        # Django UploadedFile / file-like với chunks()
        if hasattr(image_file, "chunks"):
            name = getattr(image_file, "name", "") or ""
            suffix = os.path.splitext(name)[1] or ".jpg"
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                for chunk in image_file.chunks():
                    tmp.write(chunk)
                return tmp.name, suffix

        # file-like thông thường
        if hasattr(image_file, "read"):
            name = getattr(image_file, "name", "") or ""
            suffix = os.path.splitext(name)[1] or ".jpg"
            if hasattr(image_file, "seek"):
                image_file.seek(0)
            data = image_file.read()
            if hasattr(image_file, "seek"):
                image_file.seek(0)
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(data)
                return tmp.name, suffix

        # File path string
        path = str(image_file)
        if os.path.isfile(path):
            return path, os.path.splitext(path)[1] or ".jpg"

        raise ValueError(f"Không đọc được ảnh từ kiểu: {type(image_file)}")

    # ── Core: gọi Gradio Space ────────────────────────────────────────────────

    @classmethod
    def _call_gradio(cls, image_file, modality: str, token: str) -> str:
        """
        Gọi Gradio Space ttnguyen6716/MedGemma-1.5-4B.
        Trả về chuỗi kết quả thô từ model.
        """
        from gradio_client import Client, handle_file  # import lazy — không lỗi nếu chưa cài

        question = f"""IMPORTANT: Return ONLY valid JSON, nothing else. No markdown, no explanations before or after.

Analyze this {modality} medical image and return response in this EXACT JSON structure:
{{
  "OBSERVE": "Xác định vùng bất thường - observable anatomical structures, abnormal regions with locations, sizes, and densities",
  "DESCRIBE": "Mô tả chi tiết đặc điểm tổn thương - detailed characteristics: morphology, margins, density/signal intensity, distribution",
  "INTERPRET": "Diễn giải ý nghĩa lâm sàng - clinical significance, pathological processes, differential considerations",
  "HYPOTHESIS": "Đề xuất chẩn đoán dự phòng - primary diagnostic hypothesis with reasoning",
  "DDx": "Liệt kê chẩn đoán khác cần loại trừ - alternative diagnoses and distinguishing features",
  "CONCLUSION": "Kết luận chẩn đoán cuối - final diagnostic impression and recommended next steps"
}}

Rules:
- ONLY output JSON, no other text
- Each field must have detailed, clinically relevant content
- Use both Vietnamese and English for clarity
- Be concise but comprehensive"""

        tmp_path = None
        try:
            tmp_path, _ = cls._to_temp_file(image_file)
            logger.info(f"Gọi Gradio Space [{GRADIO_SPACE_ID}] — tmp={tmp_path}")

            client = Client(GRADIO_SPACE_ID, token=token)
            result = client.predict(
                image=handle_file(tmp_path),
                question=question,
                api_name="/analyze",
            )
            logger.info(f"Gradio OK: {str(result)[:120]}...")
            return str(result)

        finally:
            # Chỉ xoá nếu là file tạm do chúng ta tạo (không phải path gốc)
            if tmp_path and tmp_path != str(image_file) and os.path.isfile(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

    # ── Public entry-point ────────────────────────────────────────────────────

    @classmethod
    def analyze_medical_image(cls, image_file, modality: str = "XRAY") -> Dict[str, Any]:
        logger.info(f"Bắt đầu phân tích — modality={modality}")
        token = cls.get_hf_token()

        if not token:
            return cls._mock_analyze(modality)

        try:
            raw = cls._call_gradio(image_file, modality, token)
            return cls._parse_findings(raw, modality)
        except ImportError:
            logger.error("gradio_client chưa được cài. Chạy: pip install gradio-client")
            return cls._mock_analyze(modality)
        except Exception as e:
            logger.error(f"Gradio call thất bại: {e}", exc_info=True)
            logger.info("Fallback → mock analysis")
            return cls._mock_analyze(modality)

    # ── Parse & Mock ──────────────────────────────────────────────────────────

    @classmethod
    def _parse_findings(cls, description: str, modality: str) -> Dict[str, Any]:
        """
        Parse JSON response from Hugging Face model.
        If JSON parsing fails, try to extract structured sections from markdown.
        """
        import json
        import re
        
        answer_key = {
            "OBSERVE":    "Observation details",
            "DESCRIBE":   "Description details", 
            "INTERPRET":  "Interpretation details",
            "HYPOTHESIS": "Hypothesis details",
            "DDx":        cls._get_ddx(modality),
            "CONCLUSION": cls._get_conclusion(modality),
        }
        
        response_text = description.strip() if description else ""
        
        # Try 1: Parse as JSON
        try:
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                parsed = json.loads(json_str)
                
                # Extract the 6 steps from parsed JSON
                answer_key = {
                    "OBSERVE":    str(parsed.get("OBSERVE", answer_key["OBSERVE"])).strip(),
                    "DESCRIBE":   str(parsed.get("DESCRIBE", answer_key["DESCRIBE"])).strip(),
                    "INTERPRET":  str(parsed.get("INTERPRET", answer_key["INTERPRET"])).strip(),
                    "HYPOTHESIS": str(parsed.get("HYPOTHESIS", answer_key["HYPOTHESIS"])).strip(),
                    "DDx":        str(parsed.get("DDx", answer_key["DDx"])).strip(),
                    "CONCLUSION": str(parsed.get("CONCLUSION", answer_key["CONCLUSION"])).strip(),
                }
                
                logger.info(f"Successfully parsed JSON response for {modality}")
                return cls._build_response(answer_key, response_text, modality)
        
        except json.JSONDecodeError:
            logger.warning("JSON parse error, trying markdown extraction")
        except Exception as e:
            logger.warning(f"Error parsing JSON: {e}")
        
        # Try 2: Extract from markdown-style sections (1. OBSERVE, 2. DESCRIBE, etc.)
        try:
            sections = {}
            
            # Pattern: "1. OBSERVE:" or "**OBSERVE**:" or similar
            patterns = {
                "OBSERVE": r"(?:1\.|OBSERVE|Observation)[:\s]*([^2\n]+?)(?=2\.|DESCRIBE|$)",
                "DESCRIBE": r"(?:2\.|DESCRIBE|Description)[:\s]*([^3\n]+?)(?=3\.|INTERPRET|$)",
                "INTERPRET": r"(?:3\.|INTERPRET|Interpretation)[:\s]*([^4\n]+?)(?=4\.|HYPOTHESIS|$)",
                "HYPOTHESIS": r"(?:4\.|HYPOTHESIS|Hypothesis)[:\s]*([^5\n]+?)(?=5\.|DDx|$)",
                "DDx": r"(?:5\.|DDx|Differential)[:\s]*([^6\n]+?)(?=6\.|CONCLUSION|$)",
                "CONCLUSION": r"(?:6\.|CONCLUSION|Conclusion)[:\s]*(.+?)$",
            }
            
            for step, pattern in patterns.items():
                match = re.search(pattern, response_text, re.IGNORECASE | re.DOTALL)
                if match:
                    content = match.group(1).strip()
                    # Clean up markdown formatting
                    content = re.sub(r'\*\*(.+?)\*\*', r'\1', content)  # Remove **bold**
                    content = re.sub(r'- ', '', content)  # Remove bullet points
                    content = content.replace('\n', ' ').strip()
                    sections[step] = content[:500]  # Limit to 500 chars
            
            if sections:
                answer_key.update(sections)
                logger.info(f"Extracted {len(sections)} sections from markdown for {modality}")
                return cls._build_response(answer_key, response_text, modality)
        
        except Exception as e:
            logger.warning(f"Error parsing markdown: {e}")
        
        # Fallback: Return response with best-effort parsing
        logger.warning("Using fallback parsing")
        return cls._build_response(answer_key, response_text, modality)
    
    @classmethod
    def _build_response(cls, answer_key: Dict[str, str], raw_response: str, modality: str) -> Dict[str, Any]:
        """Build the final response dictionary"""
        summary_parts = [
            answer_key.get("OBSERVE", "")[:80],
            answer_key.get("DESCRIBE", "")[:80],
        ]
        summary = " ".join([p for p in summary_parts if p])[:200]
        
        return {
            "title":            f"{modality} Case – MedGemma",
            "description":      summary,
            "clinical_history": f"AI (MedGemma) analyzed {modality}: {summary[:100]}",
            "raw_findings":     raw_response,
            "confidence":       0.82,
            "answer_key":       answer_key,
            "pipeline_rubric":  STEP_TEMPLATES.copy(),
        }

    @staticmethod
    def _get_ddx(modality: str) -> str:
        return {
            "XRAY":       "Lao phổi, ung thư phổi, edema phổi, hemothorax, viêm phổi.",
            "CT":         "U não, máu tụ nội sọ, nhồi máu não, viêm màng não.",
            "MRI":        "Thoát vị đĩa đệm, u tủy, xơ cứng rải rác, viêm.",
            "ULTRASOUND": "U lành/ác tính, nang, viêm, xơ hóa.",
        }.get(modality, "Cần tư vấn chuyên khoa.")

    @staticmethod
    def _get_conclusion(modality: str) -> str:
        return {
            "XRAY":       "Cần xét nghiệm máu CBC, cấy đờm, theo dõi lâm sàng 48–72h.",
            "CT":         "Tham khảo thần kinh học. Xem xét MRI bổ sung nếu cần.",
            "MRI":        "Tư vấn chỉnh hình / thần kinh. Theo dõi định kỳ.",
            "ULTRASOUND": "Theo dõi siêu âm định kỳ. Sinh thiết nếu nghi ngờ ác tính.",
        }.get(modality, "Cần tư vấn bác sĩ chuyên khoa.")

    @classmethod
    def _mock_analyze(cls, modality: str) -> Dict[str, Any]:
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
            "ULTRASOUND": {
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

    # ── Django view helper ────────────────────────────────────────────────────

    @classmethod
    def create_case_from_upload(cls, user_upload) -> Dict[str, Any]:
        logger.info(f"Creating case from upload {user_upload.id}")
        findings: Dict[str, Any] = user_upload.ai_findings or {}
        case_data = {
            "title":            findings.get("title", f"User Upload Case {user_upload.id}"),
            "description":      findings.get("description", "User uploaded case"),
            "modality":         getattr(user_upload, "modality", None) or "XRAY",
            "difficulty":       "INTERMEDIATE",
            "clinical_history": findings.get("clinical_history", "Medical image analysis"),
            "pipeline_rubric":  findings.get("pipeline_rubric", STEP_TEMPLATES.copy()),
            "answer_key":       findings.get("answer_key", {}),
            "image_urls":       [user_upload.image_url] if getattr(user_upload, "image_url", None) else [],
        }
        logger.info(f"Case data ready. answer_key steps: {list(case_data['answer_key'].keys())}")
        return case_data

    # ── Gradio helper (upload từ Gradio UI) ──────────────────────────────────

    @classmethod
    def from_gradio_upload(cls, gradio_file, modality: str = "XRAY") -> Dict[str, Any]:
        if isinstance(gradio_file, dict):
            local_path = gradio_file.get("path") or gradio_file.get("name")
        elif isinstance(gradio_file, str):
            local_path = gradio_file
        else:
            return cls.analyze_medical_image(gradio_file, modality)
        if not local_path or not os.path.isfile(local_path):
            logger.error(f"Không tìm thấy file: {local_path}")
            return cls._mock_analyze(modality)
        return cls.analyze_medical_image(local_path, modality)