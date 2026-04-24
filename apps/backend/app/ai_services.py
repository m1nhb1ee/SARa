"""
AI Services - Mock và OpenAI Integration
"""
import random
import os
import json
import logging
from typing import Dict, List, Any
from datetime import datetime

logger = logging.getLogger(__name__)

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI package not installed - using MockAIAgent only")


class MockAIAgent:
    """Mock AI Agents cho phát triển"""
    
    @staticmethod
    def evaluate_answer(case, step_index: int, student_answer: str, cv_findings: Dict) -> Dict:
        """
        Đánh giá câu trả lời sinh viên cho một bước trong pipeline
        
        Returns:
            {
                'score': float (0-1),
                'errors': [str],
                'feedback': {
                    'type': 'error'|'hint'|'correct',
                    'content': str
                }
            }
        """
        
        # Mock: đánh giá dựa trên độ dài câu trả lời + random chút
        answer_length = len(student_answer.split())
        
        # Benchmark: câu trả lời tốt có 20-50 từ
        if answer_length < 10:
            score = random.uniform(0.2, 0.4)
            errors = ['Câu trả lời quá ngắn', 'Thiếu chi tiết']
        elif answer_length < 20:
            score = random.uniform(0.5, 0.65)
            errors = ['Có thể mô tả chi tiết hơn']
        elif answer_length > 80:
            score = random.uniform(0.4, 0.6)
            errors = ['Câu trả lời quá dài', 'Hãy tập trung vào điểm chính']
        else:
            # Câu trả lời hợp lý
            score = random.uniform(0.65, 0.95)
            errors = []
        
        # Xác suất 80% có errors trong lần đầu submit
        if random.random() < 0.8 and score < 0.8:
            if not errors:
                errors = [
                    'Thiếu một số chi tiết quan trọng',
                    'Cần xem xét kỹ hơn vùng này'
                ]
        
        step_names = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']
        step_name = step_names[step_index] if step_index < len(step_names) else 'UNKNOWN'
        
        feedback_templates = {
            'error': f'Bước {step_name}: Nhận xét của bạn chưa chính xác. {". ".join(errors) if errors else "Hãy xem xét kỹ hơn."}',
            'hint': f'Bước {step_name}: Hãy chú ý đến{random.choice([" các tổn thương.", " mô đối xứng.", " kích thước tổn thương."])}',
            'correct': f'Bước {step_name}: Tuyệt vời! Câu trả lời của bạn chính xác.'
        }
        
        if score >= 0.7:
            feedback_type = 'correct'
        elif score >= 0.5:
            feedback_type = 'hint'
        else:
            feedback_type = 'error'
        
        return {
            'score': min(1.0, score),
            'errors': errors,
            'feedback': {
                'type': feedback_type,
                'content': feedback_templates[feedback_type]
            }
        }
    
    @staticmethod
    def generate_socratic_hint(case, step_index: int, errors: List[str]) -> str:
        """
        Tạo gợi ý theo phương pháp Socratic (hỏi chung chung để hướng dẫn)
        """
        step_names = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']
        step_name = step_names[step_index] if step_index < len(step_names) else 'UNKNOWN'
        
        socratic_hints = {
            'OBSERVE': [
                'Bạn thấy gì ở các vùng phổi phải? Có bất thường gì về mật độ không?',
                'Hãy mô tả toàn bộ ảnh từ trên xuống. Có lấn chiếm ranh giới nào không?',
                'Chú ý đến các vùng ngoại vi. Có dấu phim không rõ nào không?',
            ],
            'DESCRIBE': [
                'Bờ của tổn thương như thế nào - rõ hay mờ? Tại sao điều đó quan trọng?',
                'Tổn thương có đối xứng không? Không?',
                'Đo kích thước tổn thương. Nó lớn bao nhiêu?',
            ],
            'INTERPRET': [
                'Sự thay đổi này điều gì có thể gây ra? Hãy liệt kê các khả năng.',
                'Loại mô này là gì - phổi, xương, hay các mô mềm khác?',
                'Sự thay đổi mật độ này có ý nghĩa gì về mặt y học?',
            ],
            'HYPOTHESIS': [
                'Khả năng chẩn đoán chính là gì dựa trên những gì bạn thấy?',
                'Bệnh nhân này có triệu chứng nào phù hợp với giả thuyết của bạn không?',
                'Tại sao đó là giả thuyết hàng đầu?',
            ],
            'DDx': [
                'Ngoài chẩn đoán chính, còn cái gì khác có thể gây ra hiện tượng này?',
                'Làm thế nào bạn có thể loại trừ chẩn đoán khác?',
                'Những đặc điểm nào giúp bạn phân biệt?',
            ],
            'CONCLUSION': [
                'Kết luận cuối cùng của bạn là gì?',
                'Bạn tự tin bao nhiêu với chẩn đoán này? Tại sao?',
                'Cần những xét nghiệm tiếp theo nào để xác nhận?',
            ]
        }
        
        hints = socratic_hints.get(step_name, socratic_hints['OBSERVE'])
        return random.choice(hints)
    
    @staticmethod
    def analyze_image(image_url: str) -> Dict:
        """
        Mock CV Agent - phân tích ảnh X-ray (thực tế sử dụng Claude Vision / GPT-4v)
        """
        # Mock findings - đa dạng hóa random
        findings = {
            'regions': [
                {'region': 'Phổi phải thùy trên', 'findings': []},
                {'region': 'Phổi phải thùy dưới', 'findings': ['Mờ phím nhẹ']},
                {'region': 'Phổi trái', 'findings': []},
                {'region': 'Tim', 'findings': ['Ở vị trí bình thường']},
                {'region': 'Xương sườn', 'findings': []},
            ],
            'anomalies': [
                {
                    'name': 'Infiltrate phổi',
                    'location': 'Phổi phải thùy dưới',
                    'density': 'Mờ phím',
                    'size': '~3cm',
                    'laterality': 'Phải'
                }
            ],
            'densities_detected': ['Normal', 'Opacities'],
            'confidence': random.uniform(0.75, 0.95)
        }
        return findings


class MockSocraticAgent:
    """Agent dẫn dắt sinh viên qua pipeline bằng câu hỏi"""
    
    @staticmethod
    def get_step_question(step_index: int, case_title: str) -> str:
        """Lấy câu hỏi Socratic cho mỗi bước"""
        questions = {
            0: f'Quan sát ảnh {case_title} này. Bạn thấy gì ở trên ảnh? Có gì khác lạ về mật độ không?',
            1: 'Hãy mô tả chi tiết những gì bạn thấy. Kích thước, hình dạng, vị trí là như thế nào?',
            2: 'Những điểm khác lạ này có thể do nguyên nhân nào gây ra?',
            3: 'Giả thuyết chẩn đoán chính của bạn là gì?',
            4: 'Ngoài giả thuyết chính, còn những chẩn đoán khác cần loại trừ không?',
            5: 'Kết luận cuối cùng của bạn là gì? Bạn tự tin bao nhiêu?',
        }
        return questions.get(step_index, 'Câu hỏi không xác định')


class OpenAIAgent:
    """OpenAI Integration - Gọi GPT-4o để chấm điểm bài trả lời"""
    
    @staticmethod
    def _get_client():
        """Lấy OpenAI client, raise exception nếu API key không có"""
        if not OPENAI_AVAILABLE:
            raise ImportError("OpenAI package not installed. Run: pip install openai")
        
        api_key = os.getenv('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("OPENAI_API_KEY not found in environment variables")
        
        return OpenAI(api_key=api_key)
    
    @staticmethod
    def evaluate_answer(case, step_index: int, student_answer: str, cv_findings: Dict) -> Dict:
        """
        Dùng GPT-4o để đánh giá câu trả lời sinh viên
        
        Returns:
            {
                'score': float (0-1),
                'errors': [str],
                'feedback': {
                    'type': 'error'|'hint'|'correct',
                    'content': str
                },
                'reasoning': str (giải thích chi tiết từ OpenAI)
            }
        """
        try:
            client = OpenAIAgent._get_client()
        except (ImportError, ValueError) as e:
            logger.error(f"OpenAI error: {e} - falling back to Mock")
            return MockAIAgent.evaluate_answer(case, step_index, student_answer, cv_findings)
        
        step_names = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']
        step_name = step_names[step_index] if step_index < len(step_names) else 'UNKNOWN'
        
        # case is a plain dict from Supabase
        raw_answer_key = case.get('answer_key', {}) if isinstance(case, dict) else getattr(case, 'answer_key', {})
        if isinstance(raw_answer_key, str):
            import json as _json
            try:
                raw_answer_key = _json.loads(raw_answer_key)
            except Exception:
                raw_answer_key = {}
        answer_key = raw_answer_key.get(step_name, "Không có đáp án chuẩn")
        clinical_history = case.get('clinical_history', '') if isinstance(case, dict) else getattr(case, 'clinical_history', '')
        case_title = case.get('title', '') if isinstance(case, dict) else getattr(case, 'title', '')
        
        # Prompt để OpenAI đánh giá - STRICT: CHỈ ĐÁNH GIÁ, KHÔNG LEAK ĐÁP ÁN
        system_prompt = """Bạn là một giáo viên chẩn đoán hình ảnh y tế chuyên nghiệp.
Nhiệm vụ của bạn là đánh giá câu trả lời của sinh viên cho MỘT BƯỚC CỤ THỂ trong pipeline chẩn đoán.

Pipeline chẩn đoán (6 bước):
1. OBSERVE (Quan sát) - Xác định vùng bất thường
2. DESCRIBE (Mô tả) - Mô tả chi tiết đặc điểm tổn thương
3. INTERPRET (Diễn giải) - Diễn giải ý nghĩa lâm sàng
4. HYPOTHESIS (Giả thuyết) - Đề xuất chẩn đoán dự phòng
5. DDx (Phân biệt) - Liệt kê chẩn đoán khác cần loại trừ
6. CONCLUSION (Kết luận) - Kết luận chẩn đoán cuối

⚠️ NGUYÊN TẮC KHÔNG LẠI:
- CHỈ đánh giá bước hiện tại, không đề cập bước khác
- KHÔNG TIẾT LỘ đáp án chính xác
- Chỉ chỉ ra LỖI THIẾU hoặc SAIS MỖ, không cho biết đáp án đúng
- Chỉ cung cấp GỢI Ý BXC DỤNG để sinh viên tự suy luận

Trả lời JSON format (KHÔNG MARKDOWN):
{
    "score": <0.0-100.0>,
    "is_correct": <true/false>,
    "errors": [<chỉ ra lỗi, KHÔNG cho biết đáp án>],
    "feedback_type": "<'correct'/'hint'/'error'>",
    "feedback_content": "<phản hồi tiếng Việt - GỢI Ý CHỈ HƯỚNG>",
    "reasoning": "<giải thích tại sao"
}"""
        
        # Tiêu chí đánh giá cho từng bước
        step_criteria = {
            "OBSERVE": "Sinh viên đã xác định được các vùng bất thường trên hình ảnh? Có chỉ ra vị trí cụ thể?",
            "DESCRIBE": "Sinh viên đã mô tả chi tiết về kích thước, hình dạng, vị trí, mật độ của tổn thương? Mô tả có rõ ràng không?",
            "INTERPRET": "Sinh viên đã giải thích ý nghĩa lâm sàng của các phát hiện? Có liên kết với bệnh lý không?",
            "HYPOTHESIS": "Sinh viên đã đề xuất chẩn đoán dự phòng? Giả thuyết có hợp lý với các phát hiện không?",
            "DDx": "Sinh viên đã liệt kê các chẩn đoán cần loại trừ? Có giải thích tại sao không phải là những chẩn đoán này?",
            "CONCLUSION": "Sinh viên đã đưa ra kết luận chẩn đoán cuối? Kết luận có dựa trên cơ sở chắc chắn không?"
        }
        
        user_prompt = f"""Case: {case_title}
Lịch sử lâm sàng: {clinical_history}

=== BƯỚC HIỆN TẠI: {step_name.upper()} (Bước {step_index + 1}/6) ===

Tiêu chí đánh giá cho bước {step_name}:
{step_criteria.get(step_name, "Đánh giá câu trả lời này")}

---

Câu trả lời của sinh viên:
"{student_answer}"

---

YÊU CẦU ĐÁNH GIÁ:
1. So sánh câu trả lời với tiêu chí đánh giá của bước {step_name}
2. Tính điểm 0.0-100.0 dựa trên mức độ hoàn thành tiêu chí: score<60(chưa đủ), 60-75(khá), 75-85(tốt), ≥85(xuất sắc)
3. Chỉ ra những LỖI THIẾU cần cải thiện (KHÔNG TIẾT LỘ ĐÁP ÁN)
4. Cung cấp GỢI Ý HƯỚNG DẪN để sinh viên tự suy luận và cải thiện
5. TUYỆT ĐỐI KHÔNG cung cấp thông tin "đáp án chính xác là..."

Trả lời JSON (không markdown, chỉ pure JSON):"""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=500,
                timeout=30
            )
            
            response_text = response.choices[0].message.content.strip()
            logger.info(f"OpenAI response: {response_text[:200]}")
            
            # Remove markdown code blocks if present
            if response_text.startswith("```json"):
                response_text = response_text[7:]  # Remove ```json
            if response_text.startswith("```"):
                response_text = response_text[3:]  # Remove ```
            if response_text.endswith("```"):
                response_text = response_text[:-3]  # Remove trailing ```
            
            response_text = response_text.strip()
            
            # Parse JSON response
            eval_result = json.loads(response_text)
            
            # Convert score to 0-1 range if it's in 0-100 range
            score = float(eval_result.get('score', 0.5))
            if score > 1:
                score = score / 100.0  # Convert from 0-100 to 0-1
            
            return {
                'score': score,
                'errors': eval_result.get('errors', []),
                'feedback': {
                    'type': eval_result.get('feedback_type', 'hint'),
                    'content': eval_result.get('feedback_content', 'Cần xem xét kỹ hơn.')
                },
                'reasoning': eval_result.get('reasoning', ''),
                'is_correct': eval_result.get('is_correct', False)
            }
        
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            # Fallback nếu parse JSON fail
            return {
                'score': 0.5,
                'errors': ['Lỗi parse phản hồi từ AI'],
                'feedback': {
                    'type': 'hint',
                    'content': 'Hãy xem xét kỹ hơn và thử lại.'
                },
                'reasoning': 'Không thể xử lý phản hồi từ AI'
            }
        except Exception as e:
            logger.error(f"OpenAI API error: {str(e)}")
            # Fallback về Mock nếu API fail
            logger.info("Falling back to MockAIAgent")
            return MockAIAgent.evaluate_answer(case, step_index, student_answer, cv_findings)
    
    @staticmethod
    def generate_socratic_hint(case, step_index: int, errors: List[str]) -> str:
        """
        Tạo gợi ý Socratic bằng GPT-4o
        """
        _case_title = case.get('title', '') if isinstance(case, dict) else getattr(case, 'title', '')
        try:
            client = OpenAIAgent._get_client()
        except (ImportError, ValueError) as e:
            logger.error(f"OpenAI error: {e} - falling back to Mock")
            return MockSocraticAgent.get_step_question(step_index, _case_title)

        step_names = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION']
        step_name = step_names[step_index] if step_index < len(step_names) else 'UNKNOWN'

        prompt = f"""Case: {_case_title}
Bước hiện tại: {step_name}
Lỗi của sinh viên: {', '.join(errors) if errors else 'không có lỗi cụ thể'}

Hãy đưa ra 1 câu hỏi Socratic (hỏi chung chung, gợi ý) để giúp sinh viên tự khám phá ra lỗi/cách cải thiện của mình.
Câu hỏi phải bằng tiếng Việt, ngắn gọn, chuyên sâu y học.
***ĐẶC BIỆT LƯU Ý TUYỆT ĐỐI KHÔNG ĐƯỢC TIẾT LỘ BẤT KÌ THÔNG TIN NÀO VỀ ĐÁP ÁN VÀ THÔNG TIN VỀ CÁC BƯỚC SAU MÀ CHỈ HỎI ĐỂ HỌ TỰ NHẬN RA, KHÔNG VÍ DỤ, KHÔNG ĐƯA RA TÊN BỆNH HAY TÊN ẢNH HAY KẾT QUẢ CHUẨN ĐOÁN VÀO CÂU GỢI Ý.***
Câu hỏi phải hướng đến việc khám phá và tự học của sinh viên."""
        
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=150,
                timeout=30
            )
            hint = response.choices[0].message.content.strip()
            return hint
        except Exception as e:
            logger.error(f"OpenAI hint error: {e}")
            return MockSocraticAgent.get_step_question(step_index, _case_title)
