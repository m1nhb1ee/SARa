import uuid
from rest_framework import viewsets, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from app.core.pagination import StandardPagination
from .services import list_cases, get_case, list_disease_tags
from .serializers import CaseListSerializer, CaseDetailSerializer, CaseTagSerializer


class CaseTagViewSet(viewsets.ViewSet):
    """GET /api/v1/tags/ — danh sách disease profiles (public)"""
    permission_classes = [AllowAny]
    pagination_class = StandardPagination

    def list(self, request):
        tags = list_disease_tags()
        return Response({'tags': tags, 'count': len(tags)})


class CaseViewSet(viewsets.ViewSet):
    """GET /api/v1/cases/ — danh sách và detail cases (public)"""
    permission_classes = [AllowAny]

    def list(self, request):
        cases = list_cases(
            modality=request.query_params.get('modality'),
            difficulty=request.query_params.get('difficulty'),
            disease_tag=request.query_params.get('disease_tag'),
            status_filter=request.query_params.get('status'),
        )
        return Response({'cases': cases, 'count': len(cases)})

    def retrieve(self, request, pk=None):
        try:
            uuid.UUID(str(pk).strip())
        except ValueError:
            return Response(
                {'error': f'Invalid case id: {repr(pk)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        case = get_case(pk)
        if case is None:
            return Response({'error': f'Case {pk} not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(case)
