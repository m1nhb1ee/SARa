import os
from rest_framework import serializers

ALLOWED_EXTENSIONS = ('jpg', 'jpeg', 'png', 'bmp', 'gif')


class UploadInputSerializer(serializers.Serializer):
    image = serializers.ImageField(required=True)
    title = serializers.CharField(required=False, default='Untitled Case')
    modality = serializers.ChoiceField(
        choices=['XRAY', 'CT', 'MRI', 'DIFF'],
        default='XRAY',
        required=False,
    )

    def validate_image(self, value):
        ext = os.path.splitext(getattr(value, 'name', ''))[1].lstrip('.').lower()
        if ext and ext not in ALLOWED_EXTENSIONS:
            raise serializers.ValidationError(
                f"Định dạng {ext} không được hỗ trợ. Chấp nhận: {ALLOWED_EXTENSIONS}"
            )
        return value


class UploadSessionSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    user_id = serializers.UUIDField()
    image_url = serializers.URLField()
    modality = serializers.CharField()
    created_at = serializers.DateTimeField()


class UploadResultSerializer(serializers.Serializer):
    upload_session = UploadSessionSerializer()
    case = serializers.DictField()
