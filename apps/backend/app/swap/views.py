from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import StreamingHttpResponse

from .serializers import SwapMessageSerializer, SwapSessionCreateSerializer
from .services import (
    create_swap_session,
    get_swap_session,
    list_swap_sessions,
    stream_swap_message_events,
    submit_swap_message,
)


class SwapSessionViewSet(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        sessions = list_swap_sessions(request.user['id'])
        return Response({'count': len(sessions), 'results': sessions, 'sessions': sessions})

    def create(self, request):
        serializer = SwapSessionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data, err = create_swap_session(
            str(serializer.validated_data['case_id']),
            request.user['id'],
        )
        if err:
            return err
        return Response(data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        data, err = get_swap_session(pk, request.user['id'])
        if err:
            return err
        return Response(data)

    @action(detail=True, methods=['post'])
    def messages(self, request, pk=None):
        serializer = SwapMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data, err = submit_swap_message(
            pk,
            request.user['id'],
            serializer.validated_data['message'],
        )
        if err:
            return err
        return Response(data)

    @action(detail=True, methods=['post'], url_path='messages_stream')
    def messages_stream(self, request, pk=None):
        serializer = SwapMessageSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = StreamingHttpResponse(
            stream_swap_message_events(
                pk,
                request.user['id'],
                serializer.validated_data['message'],
            ),
            content_type='text/event-stream',
        )
        response['Cache-Control'] = 'no-cache'
        response['X-Accel-Buffering'] = 'no'
        return response
