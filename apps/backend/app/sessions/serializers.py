from rest_framework import serializers


class StepAnswerSubmitSerializer(serializers.Serializer):
    student_answer = serializers.CharField(required=True)

    def validate_student_answer(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError("Vui lòng cung cấp câu trả lời chi tiết hơn")
        return value


class SessionStepAnswersSerializer(serializers.Serializer):
    session_id = serializers.CharField()
    case_id = serializers.CharField()
    case_title = serializers.CharField(allow_null=True)
    case_modality = serializers.CharField(allow_null=True)
    current_step = serializers.IntegerField()
    status = serializers.CharField()
    answers = serializers.DictField()
    step_templates = serializers.DictField()
