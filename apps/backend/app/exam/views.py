from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import ExamSessionCreateSerializer, ExamStepSubmitSerializer
from .services import (
    complete_exam_session,
    create_exam_session,
    get_exam_review,
    get_exam_session,
    list_exam_cases,
    submit_exam_step,
)


class ExamCaseViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        cases = list_exam_cases(request.user['id'])
        return Response({'cases': cases, 'count': len(cases)})


class ExamSessionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def create(self, request):
        serializer = ExamSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data, err = create_exam_session(str(serializer.validated_data['case_id']), request.user['id'])
        if err:
            return err
        return Response(data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        data, err = get_exam_session(pk, request.user['id'])
        if err:
            return err
        return Response(data)

    @action(detail=True, methods=['post'])
    def submit_step(self, request, pk=None):
        serializer = ExamStepSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data, err = submit_exam_step(
            pk,
            request.user['id'],
            serializer.validated_data['step_index'],
            serializer.validated_data['answer'],
            serializer.validated_data.get('time_spent_seconds'),
        )
        if err:
            return err
        return Response(data)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        data, err = complete_exam_session(pk, request.user['id'])
        if err:
            return err
        return Response(data)

    @action(detail=True, methods=['get'])
    def review(self, request, pk=None):
        data, err = get_exam_review(pk, request.user['id'])
        if err:
            return err
        return Response(data)
