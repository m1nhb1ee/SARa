from django.test import TestCase, Client
from django.contrib.auth.models import User
from rest_framework.test import APIClient
from .models import Case, Session, CaseTag
import json


class CaseAPITestCase(TestCase):
    """Test Case API"""
    
    def setUp(self):
        self.client = APIClient()
        
        # Tạo tag
        self.tag = CaseTag.objects.create(name='Chest')
        
        # Tạo case
        self.case = Case.objects.create(
            title='Test Case',
            description='Test description',
            modality='XRAY',
            difficulty='BASIC',
            clinical_history='Test history',
            pipeline_rubric={},
            answer_key={},
            image_urls=['https://example.com/image.jpg']
        )
        self.case.tags.add(self.tag)
    
    def test_get_cases_list(self):
        """Test lấy danh sách cases"""
        response = self.client.get('/api/v1/cases/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
    
    def test_get_case_detail(self):
        """Test lấy chi tiết case"""
        response = self.client.get(f'/api/v1/cases/{self.case.id}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['title'], 'Test Case')
    
    def test_filter_by_difficulty(self):
        """Test filter theo difficulty"""
        response = self.client.get('/api/v1/cases/?difficulty=BASIC')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
    
    def test_filter_by_modality(self):
        """Test filter theo modality"""
        response = self.client.get('/api/v1/cases/?modality=XRAY')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)


class SessionAPITestCase(TestCase):
    """Test Session API"""
    
    def setUp(self):
        self.client = APIClient()
        
        # Tạo user
        self.user = User.objects.create_user(
            username='testuser',
            password='testpass123'
        )
        
        # Tạo case
        self.case = Case.objects.create(
            title='Test Case',
            description='Test description',
            modality='XRAY',
            difficulty='BASIC',
            clinical_history='Test history',
            pipeline_rubric={},
            answer_key={
                'OBSERVE': 'Test answer',
                'DESCRIBE': 'Test describe',
            },
            image_urls=['https://example.com/image.jpg']
        )
    
    def test_create_session_unauthenticated(self):
        """Test tạo session khi chưa login"""
        response = self.client.post('/api/v1/sessions/', {'case': self.case.id})
        self.assertEqual(response.status_code, 401)
    
    def test_create_session_authenticated(self):
        """Test tạo session sau khi login"""
        self.client.force_authenticate(user=self.user)
        response = self.client.post('/api/v1/sessions/', {'case': self.case.id})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['status'], 'IN_PROGRESS')
    
    def test_get_sessions_list(self):
        """Test lấy danh sách sessions"""
        self.client.force_authenticate(user=self.user)
        
        # Tạo session
        Session.objects.create(user=self.user, case=self.case)
        
        response = self.client.get('/api/v1/sessions/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
    
    def test_submit_answer(self):
        """Test submit câu trả lời"""
        self.client.force_authenticate(user=self.user)
        
        # Tạo session
        session = Session.objects.create(user=self.user, case=self.case)
        
        # Submit câu trả lời
        response = self.client.post(
            f'/api/v1/sessions/{session.id}/submit_answer/',
            {'student_answer': 'Tôi thấy một tổn thương ở phần dốc phổi phải'}
        )
        self.assertEqual(response.status_code, 200)
        self.assertIn('attempt', response.data)
        self.assertIn('passed', response.data)
