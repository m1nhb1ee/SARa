"""
Management command để tạo mock data cho development
Sử dụng: python manage.py create_mock_data
"""
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from radiology.models import CaseTag, Case, Session, StepAttempt
import json


class Command(BaseCommand):
    help = 'Tạo dữ liệu mock cho phát triển'
    
    def handle(self, *args, **options):
        self.stdout.write('Bắt đầu tạo mock data...')
        
        # 1. Tạo tags
        self.stdout.write('Tạo tags...')
        tags_data = [
            {'name': 'Chest', 'description': 'Phim ngực'},
            {'name': 'Neuro', 'description': 'Phim não'},
            {'name': 'MSK', 'description': 'Cơ xương khớp'},
            {'name': 'Abdomen', 'description': 'Phim bụng'},
        ]
        tags = {}
        for tag_data in tags_data:
            tag, created = CaseTag.objects.get_or_create(
                name=tag_data['name'],
                defaults={'description': tag_data['description']}
            )
            tags[tag.name] = tag
            status = 'tạo' if created else 'đã tồn tại'
            self.stdout.write(f"  - {tag.name}: {status}")
        
        # 2. Tạo cases
        self.stdout.write('Tạo cases...')
        cases_data = [
            {
                'title': 'Viêm phổi điển hình',
                'description': 'X-ray ngực cho thấy infiltrate phổi trên nền viêm phổi',
                'modality': 'XRAY',
                'difficulty': 'BASIC',
                'clinical_history': 'Bệnh nhân 45 tuổi, nam, ho sốt 3 ngày',
                'tags': ['Chest'],
                'image_urls': [
                    'https://via.placeholder.com/400x400?text=Chest+XRay+1',
                    'https://via.placeholder.com/400x400?text=Chest+XRay+2'
                ],
                'pipeline_rubric': {
                    'OBSERVE': 'Xác định vùng bất thường',
                    'DESCRIBE': 'Mô tả chi tiết tổn thương',
                    'INTERPRET': 'Diễn giải ý nghĩa lâm sàng',
                    'HYPOTHESIS': 'Đưa ra giả thuyết chẩn đoán',
                    'DDx': 'Liệt kê chẩn đoán phân biệt',
                    'CONCLUSION': 'Kết luận cuối cùng'
                },
                'answer_key': {
                    'OBSERVE': 'Thấy infiltrate phồi dưới phải',
                    'DESCRIBE': 'Infiltrate mờ phím, kích thước ~5cm, vị trí phần đốc phủi phải',
                    'INTERPRET': 'Mật độ cao có thể do phổi bị tổn thương do viêm',
                    'HYPOTHESIS': 'Viêm phổi',
                    'DDx': ['Lao', 'Ung thư phổi', 'Edema phổi'],
                    'CONCLUSION': 'Viêm phổi phải',
                    'explanation': 'Dựa vào triệu trứng lâm sàng và hình ảnh X-ray, chẩn đoán viêm phổi là chính xác nhất.'
                }
            },
            {
                'title': 'Gãy xương sườn',
                'description': 'X-ray ngực cho thấy gãy xương sườn',
                'modality': 'XRAY',
                'difficulty': 'INTERMEDIATE',
                'clinical_history': 'Bệnh nhân 55 tuổi, nam, chấn thương ngực sau tai nạn giao thông',
                'tags': ['Chest', 'MSK'],
                'image_urls': [
                    'https://via.placeholder.com/400x400?text=Rib+Fracture'
                ],
                'pipeline_rubric': {},
                'answer_key': {
                    'OBSERVE': 'Gãy xương sườn trái',
                    'DESCRIBE': 'Gãy hoàn toàn, xương bị dịch chuyển',
                    'INTERPRET': 'Chấn thương xương',
                    'HYPOTHESIS': 'Gãy xương sườn',
                    'DDx': ['Chấn thương lồng ngực', 'Hemothorax'],
                    'CONCLUSION': 'Gãy xương sườn trái',
                    'explanation': 'Hình ảnh rõ ràng cho thấy đó là gãy xương sườn.'
                }
            },
            {
                'title': 'U não',
                'description': 'MRI não cho thấy u não',
                'modality': 'MRI',
                'difficulty': 'ADVANCED',
                'clinical_history': 'Bệnh nhân 35 tuổi, nữ, đau đầu kéo dài',
                'tags': ['Neuro'],
                'image_urls': [
                    'https://via.placeholder.com/400x400?text=Brain+Tumor+MRI'
                ],
                'pipeline_rubric': {},
                'answer_key': {
                    'OBSERVE': 'Khối không đồng nhất tại thùy trán phải',
                    'DESCRIBE': 'Khối kích thước ~3cm, có viền định rõ, xung quanh có phù não',
                    'INTERPRET': 'Khối u có tín hiệu T2 cao',
                    'HYPOTHESIS': 'U não',
                    'DDx': ['Glioma', 'Adenoma tuyến yên'],
                    'CONCLUSION': 'U não phần mô xương',
                    'explanation': 'MRI cho thấy khối u trong não có nhu cầu can thiệp.'
                }
            },
            {
                'title': 'Tràn dịch màng phổi',
                'description': 'X-ray ngực cho thấy tràn dịch màng phổi',
                'modality': 'XRAY',
                'difficulty': 'INTERMEDIATE',
                'clinical_history': 'Bệnh nhân 60 tuổi, nữ, khó thở mới phát',
                'tags': ['Chest'],
                'image_urls': [
                    'https://via.placeholder.com/400x400?text=Pleural+Effusion'
                ],
                'pipeline_rubric': {},
                'answer_key': {
                    'OBSERVE': 'Tràn dịch phía dưới phế quản hai bên',
                    'DESCRIBE': 'Tràn dịch màng phổi, rõ ràng ở góc cơ tối',
                    'INTERPRET': 'Tăng độ mật độ dương tính',
                    'HYPOTHESIS': 'Tràn dịch màng phổi',
                    'DDx': ['Tràn máu', 'Phù phổi'],
                    'CONCLUSION': 'Tràn dịch màng phổi hai bên',
                    'explanation': 'Tình trạng này cần xác định nguyên nhân.'
                }
            },
        ]
        
        cases = {}
        for case_data in cases_data:
            tags_list = case_data.pop('tags', [])
            case, created = Case.objects.get_or_create(
                title=case_data['title'],
                defaults=case_data
            )
            for tag_name in tags_list:
                if tag_name in tags:
                    case.tags.add(tags[tag_name])
            cases[case.title] = case
            status = 'tạo' if created else 'đã tồn tại'
            self.stdout.write(f"  - {case.title}: {status}")
        
        # 3. Tạo test users
        self.stdout.write('Tạo test users...')
        users_data = [
            {'username': 'student1', 'password': 'testpass123', 'email': 'student1@test.com'},
            {'username': 'student2', 'password': 'testpass123', 'email': 'student2@test.com'},
            {'username': 'admin', 'password': 'adminpass123', 'email': 'admin@test.com', 'is_staff': True, 'is_superuser': True},
        ]
        
        users = {}
        for user_data in users_data:
            password = user_data.pop('password')
            username = user_data['username']
            user, created = User.objects.get_or_create(
                username=username,
                defaults=user_data
            )
            if created:
                user.set_password(password)
                user.save()
            users[username] = user
            status = 'tạo' if created else 'đã tồn tại'
            self.stdout.write(f"  - {username}: {status}")
        
        # 4. Tạo sample sessions
        self.stdout.write('Tạo sample sessions...')
        student1 = users['student1']
        case1 = cases['Viêm phổi điển hình']
        
        session, created = Session.objects.get_or_create(
            user=student1,
            case=case1,
            defaults={
                'status': 'IN_PROGRESS',
                'current_step': 2,
                'cv_findings': {
                    'regions': [
                        {'region': 'Phổi phải thùy dưới', 'findings': ['Infiltrate']}
                    ],
                    'anomalies': [
                        {
                            'name': 'Infiltrate phổi',
                            'location': 'Phổi phải thùy dưới',
                            'density': 'Mờ phím',
                            'size': '~5cm'
                        }
                    ]
                }
            }
        )
        status = 'tạo' if created else 'đã tồn tại'
        self.stdout.write(f"  - Session cho {student1.username}: {status}")
        
        # 5. Tạo sample step attempts
        if session and created:
            StepAttempt.objects.create(
                session=session,
                step_index=0,
                student_answer='Thấy mờ phím ở phổi phải',
                score=0.8,
                errors=[],
                feedback={'type': 'correct', 'content': 'Đúng!'},
                latency_ms=1500
            )
            StepAttempt.objects.create(
                session=session,
                step_index=1,
                student_answer='Tổn thương kích thước lớn',
                score=0.65,
                errors=['Cần chỉ rõ kích thước'],
                feedback={'type': 'hint', 'content': 'Hãy đo chi tiết hơn'},
                latency_ms=2100
            )
            self.stdout.write('  - Tạo step attempts: OK')
        
        self.stdout.write(self.style.SUCCESS('✓ Hoàn thành tạo mock data!'))
        self.stdout.write('\n📋 Thông tin đăng nhập:')
        self.stdout.write('  - Admin: username=admin, password=adminpass123')
        self.stdout.write('  - Student 1: username=student1, password=testpass123')
        self.stdout.write('  - Student 2: username=student2, password=testpass123')
