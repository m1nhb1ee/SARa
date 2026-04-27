import os
from rest_framework import serializers

ALLOWED_EXTENSIONS = ('jpg', 'jpeg', 'png', 'bmp', 'gif')


class UploadInputSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, default='Untitled Case')
    modality = serializers.ChoiceField(
        choices=['XRAY', 'CT', 'MRI', 'DIFF'],
        default='XRAY',
        required=False,
    )


class UploadSessionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    image_url = serializers.URLField()
    modality = serializers.CharField()
    created_at = serializers.DateTimeField()


class UploadResultSerializer(serializers.Serializer):
    upload_session = UploadSessionSerializer()
    case = serializers.DictField()
