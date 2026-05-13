from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from app.auth.views import LoginView, LogoutView, MeView, RegisterView
from app.cases.views import CaseTagViewSet, CaseViewSet
from app.sessions.views import SessionViewSet, StudentPerformanceViewSet
from app.swap.services import (
    SWAP_PHASE_AWAITING_CONFIRMATION,
    SWAP_PHASE_DEBATING,
    _doctor_message_blocks_convinced,
    _doctor_text_prompt,
    _handle_direct_describe_agreement,
    _is_confirmation_message,
    _is_step_agreement_message,
    _wants_next_step,
    submit_swap_message,
)
from app.swap.views import SwapSessionViewSet
from app.uploads.views import UserUploadedCaseViewSet


class FakeUser(dict):
    def __init__(self, user_id='user-1', email='student@example.com', full_name='Student', role='student', is_premium=False):
        super().__init__(id=user_id, email=email, full_name=full_name, role=role, is_premium=is_premium)
        self.app_metadata = {'role': role}
        self.user_metadata = {'full_name': full_name}

    @property
    def is_authenticated(self):
        return True


class FakeAuth:
    def __init__(self, sign_up_result=None, sign_in_result=None):
        self.sign_up_result = sign_up_result
        self.sign_in_result = sign_in_result
        self.calls = []

    def sign_up(self, payload):
        self.calls.append(('sign_up', payload))
        return self._resolve(self.sign_up_result)

    def sign_in_with_password(self, payload):
        self.calls.append(('sign_in_with_password', payload))
        return self._resolve(self.sign_in_result)

    def _resolve(self, result):
        if isinstance(result, Exception):
            raise result
        if callable(result):
            return result()
        return result


class FakeTable:
    def __init__(self, supabase, name):
        self.supabase = supabase
        self.name = name
        self.operation = 'select'
        self.payload = None
        self.select_args = ()
        self.filters = []
        self.extra = {}

    def select(self, *args):
        self.operation = 'select'
        self.select_args = args
        return self

    def insert(self, payload):
        self.operation = 'insert'
        self.payload = payload
        return self

    def upsert(self, payload, on_conflict=None):
        self.operation = 'upsert'
        self.payload = payload
        self.extra['on_conflict'] = on_conflict
        return self

    def update(self, payload):
        self.operation = 'update'
        self.payload = payload
        return self

    def delete(self):
        self.operation = 'delete'
        return self

    def eq(self, key, value):
        self.filters.append(('eq', key, value))
        return self

    def in_(self, key, values):
        self.filters.append(('in', key, list(values)))
        return self

    def or_(self, expression):
        self.filters.append(('or', expression))
        return self

    def order(self, key, desc=False):
        self.filters.append(('order', key, desc))
        return self

    def limit(self, value):
        self.extra['limit'] = value
        return self

    def single(self):
        self.extra['single'] = True
        return self

    def execute(self):
        self.supabase.calls.append({
            'table': self.name,
            'operation': self.operation,
            'payload': self.payload,
            'select_args': self.select_args,
            'filters': list(self.filters),
            'extra': dict(self.extra),
        })
        queue = self.supabase.responses.get((self.name, self.operation), [])
        if queue:
            item = queue.pop(0)
        else:
            item = []
        if isinstance(item, Exception):
            raise item
        if callable(item):
            item = item(self)
        if hasattr(item, 'data'):
            return item
        return SimpleNamespace(data=item)


class FakeSupabase:
    def __init__(self, auth=None):
        self.auth = auth or FakeAuth()
        self.responses = {}
        self.calls = []

    def table(self, name):
        return FakeTable(self, name)

    def queue_response(self, table, operation, result):
        self.responses.setdefault((table, operation), []).append(result)


def make_session(session_id='session-1', user_id='user-1', case_id='case-1', status='IN_PROGRESS', current_step=0):
    return {
        'id': session_id,
        'user_id': user_id,
        'case_id': case_id,
        'status': status,
        'current_step': current_step,
        'case': {
            'id': case_id,
            'title': 'Sample case',
            'uploaded_by': user_id,
        },
    }

class AuthEndpointTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_register_requires_confirmation_when_supabase_session_missing(self):
        auth = FakeAuth(
            sign_up_result=SimpleNamespace(
                user=SimpleNamespace(
                    id='auth-user-1',
                    email='student@example.com',
                    app_metadata={},
                    user_metadata={'full_name': 'Student'},
                ),
                session=None,
            )
        )
        supabase = FakeSupabase(auth=auth)
        supabase.queue_response('users', 'upsert', [])

        request = self.factory.post('/api/v1/auth/register/', {
            'email': 'student@example.com',
            'password': 'secret123',
            'full_name': 'Student',
        }, format='json')

        with patch('app.auth.views.get_supabase', return_value=supabase):
            response = RegisterView.as_view()(request)

        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data['requires_confirmation'])
        self.assertIn('Vui lòng check email', response.data['message'])

    def test_register_success_returns_tokens(self):
        auth = FakeAuth(
            sign_up_result=SimpleNamespace(
                user=SimpleNamespace(
                    id='auth-user-2',
                    email='student@example.com',
                    app_metadata={},
                    user_metadata={'full_name': 'Student'},
                ),
                session=SimpleNamespace(access_token='access-123', refresh_token='refresh-456'),
            )
        )
        supabase = FakeSupabase(auth=auth)
        supabase.queue_response('users', 'upsert', [])

        request = self.factory.post('/api/v1/auth/register/', {
            'email': 'student@example.com',
            'password': 'secret123',
            'full_name': 'Student',
        }, format='json')

        with patch('app.auth.views.get_supabase', return_value=supabase):
            response = RegisterView.as_view()(request)

        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data['requires_confirmation'])
        self.assertEqual(response.data['access_token'], 'access-123')
        self.assertEqual(response.data['refresh_token'], 'refresh-456')

    def test_login_email_not_confirmed(self):
        auth = FakeAuth(sign_in_result=Exception('Email not confirmed'))
        supabase = FakeSupabase(auth=auth)

        request = self.factory.post('/api/v1/auth/login/', {
            'email': 'student@example.com',
            'password': 'secret123',
        }, format='json')

        with patch('app.auth.views.get_supabase', return_value=supabase):
            response = LoginView.as_view()(request)

        self.assertEqual(response.status_code, 401)
        self.assertTrue(response.data['requires_confirmation'])

    def test_login_success_returns_user_and_token(self):
        auth = FakeAuth(
            sign_in_result=SimpleNamespace(
                user=SimpleNamespace(
                    id='auth-user-3',
                    email='student@example.com',
                    app_metadata={},
                    user_metadata={'full_name': 'Student'},
                ),
                session=SimpleNamespace(access_token='access-789', refresh_token='refresh-999'),
            )
        )
        supabase = FakeSupabase(auth=auth)
        supabase.queue_response('users', 'upsert', [])
        supabase.queue_response('users', 'select', {'id': 'auth-user-3', 'email': 'student@example.com', 'is_premium': True})

        request = self.factory.post('/api/v1/auth/login/', {
            'email': 'student@example.com',
            'password': 'secret123',
        }, format='json')

        with patch('app.auth.views.get_supabase', return_value=supabase):
            response = LoginView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['access_token'], 'access-789')
        self.assertTrue(response.data['user']['is_premium'])

    def test_me_returns_profile(self):
        supabase = FakeSupabase()
        supabase.queue_response('users', 'select', {'id': 'user-1', 'email': 'student@example.com', 'is_premium': False})

        request = self.factory.get('/api/v1/auth/me/')
        force_authenticate(request, user=FakeUser())

        with patch('app.auth.views.get_supabase', return_value=supabase):
            response = MeView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['email'], 'student@example.com')

    def test_logout_returns_success(self):
        request = self.factory.post('/api/v1/auth/logout/', {}, format='json')
        force_authenticate(request, user=FakeUser())

        response = LogoutView.as_view()(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message'], 'Đăng xuất thành công')


class CaseEndpointTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_case_tags_list_uses_service_layer(self):
        request = self.factory.get('/api/v1/tags/')

        with patch('app.cases.views.list_disease_tags', return_value=[{'id': 'tag-1', 'name': 'Pulmonary'}]):
            response = CaseTagViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['name'], 'Pulmonary')

    def test_cases_list_uses_service_layer(self):
        request = self.factory.get('/api/v1/cases/?source=public')
        force_authenticate(request, user=FakeUser())

        with patch('app.cases.views.list_cases', return_value=[{'id': 'case-1', 'title': 'Sample case'}]):
            response = CaseViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['id'], 'case-1')

    def test_case_retrieve_rejects_invalid_uuid(self):
        request = self.factory.get('/api/v1/cases/not-a-uuid/')
        force_authenticate(request, user=FakeUser())

        response = CaseViewSet.as_view({'get': 'retrieve'})(request, pk='not-a-uuid')

        self.assertEqual(response.status_code, 400)

    def test_case_retrieve_forbids_other_users_uploaded_case(self):
        request = self.factory.get('/api/v1/cases/case-1/')
        force_authenticate(request, user=FakeUser(user_id='user-1'))

        case = {'id': 'case-1', 'uploaded_by': 'other-user', 'title': 'Private case'}
        with patch('app.cases.views.get_case', return_value=case):
            response = CaseViewSet.as_view({'get': 'retrieve'})(request, pk='case-1')

        self.assertEqual(response.status_code, 403)

    def test_case_retrieve_success(self):
        request = self.factory.get('/api/v1/cases/case-1/')
        force_authenticate(request, user=FakeUser(user_id='user-1'))

        case = {'id': 'case-1', 'uploaded_by': 'user-1', 'title': 'Private case'}
        with patch('app.cases.views.get_case', return_value=case):
            response = CaseViewSet.as_view({'get': 'retrieve'})(request, pk='case-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], 'case-1')


class SessionEndpointTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_session_list_returns_user_sessions(self):
        supabase = FakeSupabase()
        supabase.queue_response('sessions', 'select', [
            {'id': 'session-1', 'status': 'IN_PROGRESS'},
            {'id': 'session-2', 'status': 'COMPLETED'},
        ])

        request = self.factory.get('/api/v1/sessions/')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_supabase', return_value=supabase):
            response = SessionViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

    def test_session_create_inserts_new_session(self):
        supabase = FakeSupabase()
        supabase.queue_response('cases', 'select', {'id': 'case-1', 'title': 'Sample case'})
        supabase.queue_response('sessions', 'insert', {'id': 'session-1', 'case_id': 'case-1', 'current_step': 0})

        request = self.factory.post('/api/v1/sessions/', {'case_id': 'case-1'}, format='json')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_supabase', return_value=supabase):
            response = SessionViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['id'], 'session-1')
        self.assertEqual(response.data['current_step'], 0)

    def test_session_retrieve_includes_attempts(self):
        session = make_session()
        supabase = FakeSupabase()
        supabase.queue_response('cases', 'select', {'id': 'case-1', 'title': 'Sample case'})
        supabase.queue_response('step_attempts', 'select', [
            {'id': 'attempt-1', 'step_index': 0, 'answer': 'a1'},
            {'id': 'attempt-2', 'step_index': 1, 'answer': 'a2'},
        ])

        request = self.factory.get('/api/v1/sessions/session-1/')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_session', return_value=(session, None)), patch('app.sessions.views.get_supabase', return_value=supabase):
            response = SessionViewSet.as_view({'get': 'retrieve'})(request, pk='session-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['step_attempts']), 2)

    def test_submit_answer_keeps_chit_chat_attempt_and_evaluates(self):
        session = make_session()
        supabase = FakeSupabase()
        supabase.queue_response('answer_keys', 'select', {'id': 'key-1', 'step_code': 'HPI'})
        supabase.queue_response('step_attempts', 'select', [])
        supabase.queue_response('step_attempts', 'select', [])
        supabase.queue_response('step_attempts', 'insert', {'id': 'attempt-1', 'step_index': 0, 'answer': 'hello'})

        request = self.factory.post('/api/v1/sessions/session-1/submit_answer/', {
            'step_index': 0,
            'answer': 'hello',
        }, format='json')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_session', return_value=(session, None)), \
             patch('app.sessions.views.get_supabase', return_value=supabase), \
             patch('app.sessions.views.get_rubric_id', return_value='rubric-1'), \
             patch('app.sessions.views.classify_intent', return_value={'intent': 'chit-chat', 'response': 'small talk'}), \
             patch('app.sessions.views.evaluate_answer', return_value={'score': 0.4, 'passed': False, 'feedback': 'Needs work', 'errors': ['missing'], 'positive_feedback': []}), \
             patch('app.sessions.views.get_socratic_hint', return_value='Try again'):
            response = SessionViewSet.as_view({'post': 'submit_answer'})(request, pk='session-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['intent'], 'chit-chat')
        self.assertEqual(response.data['attempt']['id'], 'attempt-1')
        self.assertEqual(len([call for call in supabase.calls if call['table'] == 'step_attempts' and call['operation'] == 'insert']), 1)

    def test_submit_answer_short_circuits_question_intent(self):
        session = make_session()
        supabase = FakeSupabase()

        request = self.factory.post('/api/v1/sessions/session-1/submit_answer/', {
            'step_index': 0,
            'answer': 'what is the diagnosis?',
        }, format='json')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_session', return_value=(session, None)), \
             patch('app.sessions.views.get_supabase', return_value=supabase), \
             patch('app.sessions.views.classify_intent', return_value={'intent': 'question', 'response': 'Ask a question'}), \
             patch('app.sessions.views.evaluate_answer') as evaluate_answer:
            response = SessionViewSet.as_view({'post': 'submit_answer'})(request, pk='session-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['intent'], 'question')
        evaluate_answer.assert_not_called()

    def test_exit_session_marks_abandoned(self):
        session = make_session(status='IN_PROGRESS')
        supabase = FakeSupabase()
        supabase.queue_response('sessions', 'update', {'id': 'session-1', 'status': 'ABANDONED'})

        request = self.factory.post('/api/v1/sessions/session-1/exit_session/', {}, format='json')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_session', return_value=(session, None)), patch('app.sessions.views.get_supabase', return_value=supabase):
            response = SessionViewSet.as_view({'post': 'exit_session'})(request, pk='session-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'ABANDONED')

    def test_resume_reactivates_abandoned_session(self):
        session = make_session(status='ABANDONED')
        supabase = FakeSupabase()
        supabase.queue_response('sessions', 'update', {'id': 'session-1', 'status': 'IN_PROGRESS'})

        request = self.factory.post('/api/v1/sessions/session-1/resume/', {}, format='json')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_session', return_value=(session, None)), patch('app.sessions.views.get_supabase', return_value=supabase):
            response = SessionViewSet.as_view({'post': 'resume'})(request, pk='session-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'IN_PROGRESS')

    def test_step_answers_returns_templates_and_attempts(self):
        session = make_session()
        supabase = FakeSupabase()
        supabase.queue_response('cases', 'select', {'id': 'case-1', 'title': 'Sample case'})
        supabase.queue_response('answer_keys', 'select', [
            {'step_code': 'HPI', 'step_order': 1, 'expected_finding': 'x', 'clinical_explanation': 'y', 'key_points': ['a']},
        ])
        supabase.queue_response('step_attempts', 'select', [
            {'id': 'attempt-1', 'step_index': 0, 'answer': 'a'},
        ])

        request = self.factory.get('/api/v1/sessions/session-1/step_answers/')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_session', return_value=(session, None)), patch('app.sessions.views.get_supabase', return_value=supabase):
            response = SessionViewSet.as_view({'get': 'step_answers'})(request, pk='session-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['attempts'][0]['id'], 'attempt-1')
        self.assertEqual(response.data['step_templates'][0]['step_code'], 'HPI')

    def test_answer_key_requires_completed_session(self):
        session = make_session(status='IN_PROGRESS')
        request = self.factory.get('/api/v1/sessions/session-1/answer_key/')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_session', return_value=(session, None)):
            response = SessionViewSet.as_view({'get': 'answer_key'})(request, pk='session-1')

        self.assertEqual(response.status_code, 403)

    def test_answer_key_returns_key_material(self):
        session = make_session(status='COMPLETED')
        supabase = FakeSupabase()
        supabase.queue_response('answer_keys', 'select', [
            {'step_code': 'HPI', 'step_order': 1, 'expected_finding': 'x', 'clinical_explanation': 'y', 'key_points': ['a']},
        ])
        supabase.queue_response('step_attempts', 'select', [
            {'id': 'attempt-1', 'step_index': 0, 'answer': 'a'},
        ])

        request = self.factory.get('/api/v1/sessions/session-1/answer_key/')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_session', return_value=(session, None)), patch('app.sessions.views.get_supabase', return_value=supabase):
            response = SessionViewSet.as_view({'get': 'answer_key'})(request, pk='session-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['answer_keys'][0]['step_code'], 'HPI')

    def test_student_performance_stats(self):
        supabase = FakeSupabase()
        supabase.queue_response('sessions', 'select', [
            {'id': 'session-1', 'case_id': 'case-1', 'status': 'COMPLETED', 'score': 8},
            {'id': 'session-2', 'case_id': 'case-1', 'status': 'COMPLETED', 'score': 5},
        ])
        supabase.queue_response('step_attempts', 'select', [
            {'session_id': 'session-1', 'step_index': 0, 'passed': True},
            {'session_id': 'session-1', 'step_index': 1, 'passed': False},
        ])

        request = self.factory.get('/api/v1/performance/me/')
        force_authenticate(request, user=FakeUser())

        with patch('app.sessions.views.get_supabase', return_value=supabase):
            response = StudentPerformanceViewSet.as_view({'get': 'my_stats'})(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['total_sessions'], 2)
        self.assertIn('accuracy_by_step', response.data)


class UploadEndpointTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def test_uploaded_case_list(self):
        supabase = FakeSupabase()
        supabase.queue_response('upload_sessions', 'select', [
            {'id': 'upload-1', 'title': 'Case upload', 'cases': {'id': 'case-1', 'title': 'Case upload'}},
        ])

        request = self.factory.get('/api/v1/uploaded-cases/')
        force_authenticate(request, user=FakeUser())

        with patch('app.uploads.views.get_supabase', return_value=supabase):
            response = UserUploadedCaseViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['id'], 'upload-1')

    def test_uploaded_case_retrieve_forbidden_for_other_user(self):
        supabase = FakeSupabase()
        supabase.queue_response('upload_sessions', 'select', {'id': 'upload-1', 'user_id': 'other-user'})

        request = self.factory.get('/api/v1/uploaded-cases/upload-1/')
        force_authenticate(request, user=FakeUser(user_id='user-1'))

        with patch('app.uploads.views.get_supabase', return_value=supabase):
            response = UserUploadedCaseViewSet.as_view({'get': 'retrieve'})(request, pk='upload-1')

        self.assertEqual(response.status_code, 403)

    def test_start_practice_creates_session(self):
        supabase = FakeSupabase()
        supabase.queue_response('upload_sessions', 'select', {
            'id': 'upload-1',
            'user_id': 'user-1',
            'case_id': 'case-1',
            'title': 'Case upload',
        })
        supabase.queue_response('sessions', 'insert', {'id': 'session-1', 'status': 'IN_PROGRESS', 'case_id': 'case-1'})

        request = self.factory.post('/api/v1/uploaded-cases/upload-1/start_practice/', {}, format='json')
        force_authenticate(request, user=FakeUser())

        with patch('app.uploads.views.get_supabase', return_value=supabase):
            response = UserUploadedCaseViewSet.as_view({'post': 'start_practice'})(request, pk='upload-1')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['session_id'], 'session-1')

    def test_findings_returns_answer_key_summary(self):
        supabase = FakeSupabase()
        supabase.queue_response('upload_sessions', 'select', {
            'id': 'upload-1',
            'user_id': 'user-1',
            'case_id': 'case-1',
            'modality': 'xray',
        })
        supabase.queue_response('cases', 'select', {'id': 'case-1', 'title': 'Case upload'})
        supabase.queue_response('answer_keys', 'select', [
            {'step_code': 'HPI', 'step_order': 1, 'expected_finding': 'x', 'clinical_explanation': 'y', 'key_points': ['a']},
        ])

        request = self.factory.get('/api/v1/uploaded-cases/upload-1/findings/')
        force_authenticate(request, user=FakeUser())

        with patch('app.uploads.views.get_supabase', return_value=supabase):
            response = UserUploadedCaseViewSet.as_view({'get': 'findings'})(request, pk='upload-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['case_title'], 'Case upload')
        self.assertEqual(response.data['answer_key_steps'], ['HPI'])

    def test_create_uploaded_case_success(self):
        from django.core.files.uploadedfile import SimpleUploadedFile

        supabase = FakeSupabase()
        image = SimpleUploadedFile('scan.png', b'fake-image-bytes', content_type='image/png')
        request = self.factory.post('/api/v1/uploaded-cases/', {
            'title': 'Lung case',
            'modality': 'xray',
            'region': 'chest',
            'engine': 'medgemma',
            'images': image,
        }, format='multipart')
        force_authenticate(request, user=FakeUser())

        with patch('app.uploads.views.get_supabase', return_value=supabase), \
             patch('app.uploads.views.classify_and_validate_images', return_value={'valid': True, 'errors': []}), \
             patch('app.uploads.views.upload_image_to_storage', return_value={'url': 'https://example.com/scan.png'}), \
             patch('app.uploads.views.analyze_medical_image', return_value={'analysis': 'ok'}), \
             patch('app.uploads.views.create_case_in_supabase', return_value={'upload_session': {'id': 'upload-1'}, 'case': {'id': 'case-1'}}):
            response = UserUploadedCaseViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['case']['id'], 'case-1')


class SwapEndpointTests(SimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def make_swap_data(self, phase=SWAP_PHASE_DEBATING, pending_summary=None, current_step=0):
        return {
            'id': 'swap-1',
            'user_id': 'user-1',
            'case_id': 'case-1',
            'status': 'IN_PROGRESS',
            'current_step': current_step,
            'doctor_diagnosis': {
                'DESCRIBE': 'Hình ảnh cho thấy X-quang bàn chân phải. Không thấy gãy xương hoặc trật khớp rõ ràng.',
                'REASONING': 'Các cấu trúc xương bảo tồn nên ít nghĩ tổn thương cấp.',
            },
            'case': {'id': 'case-1', 'title': 'Foot X-ray'},
            'messages': [
                {
                    'role': 'doctor',
                    'step_index': 0,
                    'content': 'Hình ảnh cho thấy X-quang bàn chân phải. Không thấy gãy xương hoặc trật khớp rõ ràng.',
                }
            ],
            'scores': [],
            'step_states': [
                {
                    'swap_session_id': 'swap-1',
                    'step_index': 0,
                    'step_code': 'DESCRIBE',
                    'phase': phase,
                    'convinced': phase == SWAP_PHASE_AWAITING_CONFIRMATION,
                    'pending_summary': pending_summary,
                    'agreed_answer': None,
                    'debate_score': 0.72,
                    'knowledge_score': 0.72,
                    'reasoning': 'DESCRIBE consensus.',
                    'debate_score_online': 0.72,
                    'reasoning_online': 'DESCRIBE consensus.',
                }
            ],
            'step_codes': ['DESCRIBE', 'REASONING', 'DDx', 'CONCLUSION'],
        }

    def test_swap_session_list(self):
        request = self.factory.get('/api/v1/swap-sessions/')
        force_authenticate(request, user=FakeUser())

        with patch('app.swap.views.list_swap_sessions', return_value=[{'id': 'swap-1', 'title': 'Debate'}]):
            response = SwapSessionViewSet.as_view({'get': 'list'})(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data[0]['id'], 'swap-1')

    def test_swap_session_create(self):
        request = self.factory.post('/api/v1/swap-sessions/', {'topic': 'diagnosis'}, format='json')
        force_authenticate(request, user=FakeUser())

        with patch('app.swap.views.create_swap_session', return_value={'session': {'id': 'swap-1'}, 'error': None}):
            response = SwapSessionViewSet.as_view({'post': 'create'})(request)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['session']['id'], 'swap-1')

    def test_swap_session_retrieve(self):
        request = self.factory.get('/api/v1/swap-sessions/swap-1/')
        force_authenticate(request, user=FakeUser())

        with patch('app.swap.views.get_swap_session', return_value={'id': 'swap-1', 'title': 'Debate'}):
            response = SwapSessionViewSet.as_view({'get': 'retrieve'})(request, pk='swap-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['id'], 'swap-1')

    def test_swap_session_messages(self):
        request = self.factory.post('/api/v1/swap-sessions/swap-1/messages/', {'message': 'hello'}, format='json')
        force_authenticate(request, user=FakeUser())

        with patch('app.swap.views.submit_swap_message', return_value={'message': {'id': 'msg-1'}, 'error': None}):
            response = SwapSessionViewSet.as_view({'post': 'messages'})(request, pk='swap-1')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['message']['id'], 'msg-1')

    def test_swap_session_messages_stream(self):
        request = self.factory.post('/api/v1/swap-sessions/swap-1/messages_stream/', {'message': 'hello'}, format='json')
        force_authenticate(request, user=FakeUser())

        with patch('app.swap.views.stream_swap_message_events', return_value=iter(['data: hi\n\n'])):
            response = SwapSessionViewSet.as_view({'post': 'messages_stream'})(request, pk='swap-1')

        self.assertEqual(response.status_code, 200)
        self.assertIn('text/event-stream', response['Content-Type'])

    def test_doctor_rejection_text_blocks_convinced(self):
        message = (
            'Nếu bạn khẳng định có gián đoạn vỏ xương, tôi cần bạn chỉ ra rõ ràng. '
            'Trên X-quang, tôi vẫn chưa thấy dấu hiệu rõ ràng.'
        )

        self.assertTrue(_doctor_message_blocks_convinced(message))

    def test_doctor_acceptance_text_allows_convinced(self):
        message = 'Tôi đồng ý với lập luận của bạn và chấp nhận mô tả gãy cành tươi ở đoạn giữa.'

        self.assertFalse(_doctor_message_blocks_convinced(message))

    def test_confirmation_message_accepts_vietnamese_agreement_and_next_step(self):
        self.assertTrue(_is_confirmation_message('đồng ý'))
        self.assertTrue(_is_confirmation_message('tôi sẵn sàng, hãy sang bước tiếp'))
        self.assertTrue(_is_confirmation_message('mô tả đúng rồi, tiếp tục'))
        self.assertTrue(_is_step_agreement_message('tôi đồng ý với mô tả ban đầu'))
        self.assertTrue(_is_step_agreement_message('tôi không thấy gì, tôi thấy hình ảnh bình thường'))
        self.assertTrue(_wants_next_step('hãy sang bước kế tiếp'))

    def test_confirmation_message_does_not_reject_medical_negative_finding(self):
        self.assertFalse(_is_confirmation_message('không thấy gãy xương hoặc trật khớp rõ ràng'))

    def test_confirmation_message_rejects_clear_disagreement(self):
        self.assertFalse(_is_confirmation_message('không đồng ý'))
        self.assertFalse(_is_confirmation_message('chưa đúng, cần bổ sung'))

    def test_awaiting_confirmation_next_step_message_confirms_and_advances(self):
        supabase = FakeSupabase()
        initial = self.make_swap_data(
            phase=SWAP_PHASE_AWAITING_CONFIRMATION,
            pending_summary='X-quang bàn chân phải, không thấy gãy xương rõ.',
        )
        updated = {**initial, 'current_step': 1, 'last_result': {'confirmed': True, 'next_step': 1}}

        with patch('app.swap.services.get_swap_session', side_effect=[(initial, None), (updated, None)]), \
             patch('app.swap.services.get_supabase', return_value=supabase), \
             patch('app.swap.services._next_step_opening_message', return_value='Bây giờ sang bước REASONING.'):
            result, err = submit_swap_message('swap-1', 'user-1', 'tôi sẵn sàng, hãy sang bước tiếp')

        self.assertIsNone(err)
        self.assertEqual(result['last_result']['next_step'], 1)
        self.assertTrue(any(
            call['table'] == 'swap_sessions'
            and call['operation'] == 'update'
            and call['payload'] == {'current_step': 1}
            for call in supabase.calls
        ))

    def test_direct_describe_agreement_with_next_step_auto_confirms(self):
        supabase = FakeSupabase()
        initial = self.make_swap_data()
        updated = {**initial, 'current_step': 1, 'last_result': {'confirmed': True, 'next_step': 1}}

        with patch('app.swap.services.get_swap_session', side_effect=[(initial, None), (updated, None)]), \
             patch('app.swap.services.get_supabase', return_value=supabase), \
             patch('app.swap.services._next_step_opening_message', return_value='Bây giờ sang bước REASONING.'):
            result, err = submit_swap_message('swap-1', 'user-1', 'mô tả của bạn đúng rồi, hãy tiếp tục')

        self.assertIsNone(err)
        self.assertEqual(result['last_result']['next_step'], 1)
        self.assertTrue(any(
            call['table'] == 'swap_step_states'
            and call['operation'] == 'upsert'
            and call['payload']['phase'] == 'CONFIRMED'
            for call in supabase.calls
        ))

    def test_direct_describe_agreement_without_next_step_awaits_confirmation(self):
        supabase = FakeSupabase()
        initial = self.make_swap_data()
        updated = {**initial, 'last_result': {'awaiting_confirmation': True}}

        with patch('app.swap.services.get_swap_session', side_effect=[(initial, None), (updated, None)]), \
             patch('app.swap.services.get_supabase', return_value=supabase):
            result, err = submit_swap_message('swap-1', 'user-1', 'tôi đồng ý với mô tả ban đầu')

        self.assertIsNone(err)
        self.assertTrue(result['last_result']['awaiting_confirmation'])
        self.assertTrue(any(
            call['table'] == 'swap_step_states'
            and call['operation'] == 'upsert'
            and call['payload']['phase'] == SWAP_PHASE_AWAITING_CONFIRMATION
            for call in supabase.calls
        ))
        consensus_messages = [
            call['payload'][1]
            for call in supabase.calls
            if call['table'] == 'swap_messages' and call['operation'] == 'insert'
        ]
        self.assertEqual(consensus_messages[0]['metadata']['persuasion_score'], 0.72)
        self.assertFalse(any(
            call['table'] == 'swap_sessions' and call['operation'] == 'update'
            for call in supabase.calls
        ))

    def test_direct_describe_agreement_ignores_off_topic_message(self):
        result = _handle_direct_describe_agreement(self.make_swap_data(), 'tôi thấy con vịt')

        self.assertIsNone(result)

    def test_reasoning_step_does_not_read_database_answer_key(self):
        initial = self.make_swap_data(current_step=1)
        initial['step_states'].append({
            'swap_session_id': 'swap-1',
            'step_index': 1,
            'step_code': 'REASONING',
            'phase': SWAP_PHASE_DEBATING,
            'convinced': False,
            'pending_summary': None,
            'agreed_answer': None,
            'debate_score': None,
            'knowledge_score': None,
            'reasoning': '',
        })
        result_payload = {
            'doctor_message': 'Hãy lập luận dựa trên phần đã thống nhất và lập trường của Dr. Swap.',
            'convinced': False,
            'persuasion_score': 0.4,
            'debate_score': 0.4,
            'knowledge_score': 0.4,
            'reasoning_for_grader': '',
        }

        with patch('app.swap.services.get_swap_session', return_value=(initial, None)), \
             patch('app.swap.services._answer_key_for_case', side_effect=AssertionError('answer key leak')), \
             patch('app.swap.services._doctor_reply', return_value=result_payload), \
             patch('app.swap.services._store_swap_exchange', return_value=({'last_result': result_payload}, None)):
            result, err = submit_swap_message('swap-1', 'user-1', 'tôi cũng nghĩ vậy')

        self.assertIsNone(err)
        self.assertEqual(result['last_result']['doctor_message'], result_payload['doctor_message'])

    def test_reasoning_prompt_keeps_vlm_stance_tied_to_agreed_findings(self):
        data = self.make_swap_data(current_step=1)
        data['step_states'][0]['agreed_answer'] = 'X-quang bàn chân phải không thấy gãy xương hay trật khớp rõ ràng.'

        prompt = _doctor_text_prompt(
            data,
            data['case'],
            {},
            data['messages'],
            'tôi nghĩ hình ảnh bình thường',
            data['step_states'],
        )

        self.assertIn("Dr. Swap's initial opinion, not established fact", prompt)
        self.assertIn('do not assert new imaging findings', prompt)
        self.assertIn('Previous agreed answers', prompt)
