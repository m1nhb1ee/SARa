import logging

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from app.core.supabase_client import get_supabase
from .serializers import UploadInputSerializer
from .services import (
    analyze_medical_image,
    create_case_in_supabase,
    delete_uploaded_case,
    find_case_by_image_url,
    upload_image_to_storage,
)

logger = logging.getLogger(__name__)


class UserUploadedCaseViewSet(viewsets.ViewSet):
    """API quản lý cases do người dùng upload — Supabase Storage backend"""
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def list(self, request):
        """GET /api/v1/uploaded-cases/ — danh sách upload_sessions của user"""
        sb = get_supabase()
        user_id = request.user['id']
        try:
            result = sb.table('upload_sessions').select(
                'id, user_id, case_id, image_url, modality, created_at'
            ).eq('user_id', user_id).order('created_at', desc=True).execute()
        except Exception as e:
            logger.error(f"list upload_sessions error: {e}", exc_info=True)
            return Response({'error': 'Lỗi truy vấn database', 'message': str(e)},
                            status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        return Response({'count': len(result.data), 'results': result.data})

    def create(self, request):
        """
        POST /api/v1/uploaded-cases/
        Multipart: image (file), title (str), modality (XRAY|CT|MRI|DIFF)

        Flow: upload → Supabase Storage → HF analysis → create case + answer_keys
        """
        serializer = UploadInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        image_file = serializer.validated_data['image']
        modality = serializer.validated_data['modality']
        title = serializer.validated_data['title']
        user_id = request.user['id']

        logger.info(f"Upload request from user {user_id} — modality={modality}")

        try:
            image_bytes = image_file.read()

            image_url = upload_image_to_storage(image_bytes, image_file.name)
            logger.info(f"Stored image: {image_url}")

            findings = analyze_medical_image(image_bytes, modality)
            logger.info(f"HF analysis complete. Steps: {list(findings.get('answer_key', {}).keys())}")

            if not title or title == 'Untitled Case':
                title = findings.get('title', f'{modality} Case')

            result = create_case_in_supabase(user_id, image_url, modality, title, findings)
            logger.info(f"Case {result['case']['id']} created, upload_session {result['upload_session']['id']}")

            return Response(result, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Upload processing error: {e}", exc_info=True)
            return Response(
                {'error': 'Lỗi xử lý ảnh', 'message': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def retrieve(self, request, pk=None):
        """GET /api/v1/uploaded-cases/{id}/ — chi tiết upload_session + case"""
        sb = get_supabase()
        user_id = request.user['id']
        try:
            result = sb.table('upload_sessions').select(
                'id, user_id, case_id, image_url, modality, created_at'
            ).eq('id', pk).single().execute()
        except Exception:
            return Response({'error': 'Upload not found'}, status=status.HTTP_404_NOT_FOUND)

        upload = result.data
        if upload['user_id'] != user_id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        if upload.get('case_id'):
            try:
                case_result = sb.table('cases').select('id, title').eq('id', upload['case_id']).single().execute()
                case = case_result.data
            except Exception:
                case = None
        else:
            case = find_case_by_image_url(upload['image_url'])
        return Response({**upload, 'case': case})

    def destroy(self, request, pk=None):
        """DELETE /api/v1/uploaded-cases/{id}/ — xóa case do user upload"""
        user_id = request.user['id']
        try:
            result = delete_uploaded_case(pk, user_id)
            return Response(result, status=status.HTTP_200_OK)
        except ValueError:
            return Response({'error': 'Upload not found'}, status=status.HTTP_404_NOT_FOUND)
        except PermissionError:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            logger.error(f"Delete upload error: {e}", exc_info=True)
            return Response(
                {'error': 'Lỗi xóa case', 'message': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=['post'])
    def start_practice(self, request, pk=None):
        """POST /api/v1/uploaded-cases/{id}/start_practice/ — tạo session với case từ upload"""
        sb = get_supabase()
        user_id = request.user['id']

        try:
            result = sb.table('upload_sessions').select(
                'id, user_id, image_url'
            ).eq('id', pk).single().execute()
        except Exception:
            return Response({'error': 'Upload not found'}, status=status.HTTP_404_NOT_FOUND)

        upload = result.data
        if upload['user_id'] != user_id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        case = find_case_by_image_url(upload['image_url'])
        if not case:
            return Response(
                {'error': 'Case chưa được tạo cho upload này'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        session_result = sb.table('sessions').insert({
            'user_id': user_id,
            'case_id': case['id'],
            'current_step': 0,
            'status': 'IN_PROGRESS',
        }).execute()

        session = session_result.data[0]
        logger.info(f"Started session {session['id']} for user {user_id}")
        return Response(session, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'])
    def findings(self, request, pk=None):
        """GET /api/v1/uploaded-cases/{id}/findings/ — case data cho upload"""
        sb = get_supabase()
        user_id = request.user['id']

        try:
            result = sb.table('upload_sessions').select(
                'id, user_id, image_url, modality'
            ).eq('id', pk).single().execute()
        except Exception:
            return Response({'error': 'Upload not found'}, status=status.HTTP_404_NOT_FOUND)

        upload = result.data
        if upload['user_id'] != user_id:
            return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

        case = find_case_by_image_url(upload['image_url'])
        if not case:
            return Response(
                {'error': 'Case chưa được xử lý'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        answer_keys = sb.table('answer_keys').select(
            'step_code, expected_finding, clinical_explanation, key_points'
        ).eq('case_id', case['id']).order('step_order').execute()

        return Response({
            'upload_session_id': upload['id'],
            'image_url': upload['image_url'],
            'modality': upload['modality'],
            'case_id': case['id'],
            'case_title': case.get('title'),
            'answer_key_steps': [r['step_code'] for r in (answer_keys.data or [])],
            'answer_keys': answer_keys.data or [],
        })
