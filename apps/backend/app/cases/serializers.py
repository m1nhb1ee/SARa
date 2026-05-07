from rest_framework import serializers


class CaseTagSerializer(serializers.Serializer):
    disease_tag = serializers.CharField()
    expected_findings = serializers.JSONField(default=dict)
    common_errors = serializers.JSONField(default=list)
    ddx_list = serializers.JSONField(default=list)
    clinical_notes = serializers.CharField(allow_null=True, allow_blank=True, required=False)


class CaseListSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    title = serializers.CharField()
    modality = serializers.CharField()
    difficulty = serializers.CharField()
    clinical_history = serializers.CharField()
    disease_tag = serializers.CharField(allow_null=True, required=False)
    status = serializers.CharField()
    is_valid = serializers.BooleanField(required=False)
    images = serializers.ListField(child=serializers.DictField(), default=list)
    tags = serializers.ListField(child=serializers.CharField(), default=list)
    created_at = serializers.DateTimeField()


class CaseDetailSerializer(CaseListSerializer):
    pass
