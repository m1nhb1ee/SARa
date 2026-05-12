from rest_framework import serializers


class SwapSessionCreateSerializer(serializers.Serializer):
    case_id = serializers.UUIDField()


class SwapMessageSerializer(serializers.Serializer):
    message = serializers.CharField()
