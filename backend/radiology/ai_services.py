"""
Mock AI Services - Thay thế cho Claude/GPT-4 API trong development
Cấu trúc tương tự như sản phẩm thực
"""
import random
from typing import Dict, List, Any


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
