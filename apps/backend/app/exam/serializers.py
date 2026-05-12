from rest_framework import serializers


class ExamSessionCreateSerializer(serializers.Serializer):
    case_id = serializers.UUIDField()


class ExamStepSubmitSerializer(serializers.Serializer):
    step_index = serializers.IntegerField(min_value=0, max_value=3)
    answer = serializers.CharField(allow_blank=True)
    time_spent_seconds = serializers.IntegerField(min_value=0, max_value=300, required=False)
