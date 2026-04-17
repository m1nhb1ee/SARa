/**
 * DiagnosisTrainingPage - Luyện tập chẩn đoán từng bước  
 * 6 bước: OBSERVE → DESCRIBE → INTERPRET → HYPOTHESIS → DDx → CONCLUSION
 */

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useCaseDetail, useCreateSession, useSessionDetail, useSubmitAnswer, useGetAnswerKey } from '@/api/hooks';
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';
import { Textarea } from '@/app/components/ui/textarea';

const STEPS = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION'];

const STEP_DESCRIPTIONS = {
  OBSERVE: 'Quan sát ảnh. Bạn thấy gì ở trên ảnh? Có gì khác lạ?',
  DESCRIBE: 'Mô tả chi tiết những gì bạn thấy. Kích thước, hình dạng, vị trí?',
  INTERPRET: 'Diễn giải ý nghĩa. Những điểm này có thể do nguyên nhân nào?',
  HYPOTHESIS: 'Giả thuyết chẩn đoán. Đâu là chẩn đoán chính?',
  DDx: 'Chẩn đoán phân biệt. Còn những chẩn đoán khác nào?',
  CONCLUSION: 'Kết luận. Chẩn đoán cuối cùng của bạn là gì?',
};

export function DiagnosisTrainingPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: caseData, loading: caseLoading } = useCaseDetail(caseId ? parseInt(caseId) : null);
  const { createSession } = useCreateSession();
  const { data: sessionData, loading: sessionLoading } = useSessionDetail(sessionId);
  const { submitAnswer } = useSubmitAnswer();
  const { data: answerKeyData, fetch: fetchAnswerKey } = useGetAnswerKey(sessionId);

  // Create session on mount
  useEffect(() => {
    if (!caseId || sessionId) return;

    const create = async () => {
      const session = await createSession(parseInt(caseId));
      if (session) {
        setSessionId(session.id);
      }
    };

    create();
  }, [caseId, sessionId, createSession]);

  const handleSubmitAnswer = async () => {
    if (!sessionId || !studentAnswer.trim()) return;

    setSubmitting(true);
    const result = await submitAnswer(sessionId, studentAnswer);

    if (result) {
      setStudentAnswer('');

      // Refetch session to get updated state
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }

    setSubmitting(false);
  };

  const currentStep = sessionData?.current_step || 0;
  const currentStepName = STEPS[currentStep];
  const isCompleted = sessionData?.status === 'COMPLETED';

  if (caseLoading || sessionLoading) {
    return <div className="text-center py-12">Đang tải...</div>;
  }

  if (!caseData) {
    return <div className="text-center py-12 text-red-500">Không tìm thấy case</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{caseData.title}</h1>
        <p className="text-neutral-600">{caseData.clinical_history}</p>
      </div>

      {/* Images */}
      {caseData.image_urls && caseData.image_urls.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Hình ảnh y tế</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {caseData.image_urls.map((url: string, idx: number) => (
              <img
                key={idx}
                src={url}
                alt={`Image ${idx + 1}`}
                className="w-full rounded-lg border bg-neutral-100 object-cover max-h-96"
              />
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium">Tiến độ: {currentStep + 1} / 6</span>
          {sessionData?.total_score !== undefined && <span className="text-sm">Điểm: {(sessionData.total_score * 100).toFixed(1)}%</span>}
        </div>
        <div className="w-full bg-neutral-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${((currentStep + 1) / 6) * 100}%` }}
          />
        </div>
        <div className="flex gap-1 justify-between text-xs">
          {STEPS.map((step, idx) => (
            <div
              key={step}
              className={`flex-1 text-center py-1 rounded ${idx === currentStep ? 'bg-blue-600 text-white font-medium' : idx < currentStep ? 'bg-green-100 text-green-700' : 'bg-neutral-100'}`}
            >
              {idx + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Training Area */}
      {!isCompleted && (
        <Card className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">Bước {currentStep + 1}: {currentStepName}</h2>
            <p className="text-neutral-600">{STEP_DESCRIPTIONS[currentStepName as keyof typeof STEP_DESCRIPTIONS]}</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Câu trả lời của bạn</label>
            <Textarea
              value={studentAnswer}
              onChange={(e) => setStudentAnswer(e.target.value)}
              placeholder="Nhập câu trả lời chi tiết..."
              className="min-h-40"
            />
            <p className="text-xs text-neutral-500">{studentAnswer.length} ký tự</p>
          </div>

          <Button
            onClick={handleSubmitAnswer}
            disabled={submitting || studentAnswer.trim().length < 10}
            className="w-full"
            size="lg"
          >
            {submitting ? 'Đang xử lý...' : 'Nộp câu trả lời'}
          </Button>
        </Card>
      )}

      {/* Answer Key */}
      {isCompleted && (
        <Card className="p-6 space-y-4 bg-green-50 border-green-200">
          <h2 className="text-xl font-semibold text-green-900">✓ Hoàn thành case này!</h2>
          <p className="text-green-800">Điểm của bạn: {(sessionData.total_score * 100).toFixed(1)}%</p>

          <Button onClick={fetchAnswerKey} className="w-full">
            Xem đáp án và giải thích
          </Button>

          {answerKeyData && (
            <div className="space-y-4 mt-4 pt-4 border-t border-green-200">
              {STEPS.map((step, idx) => (
                <div key={step} className="space-y-2">
                  <h3 className="font-semibold text-green-900">
                    {step} - Điểm: {(answerKeyData.details[idx]?.score * 100 || 0).toFixed(0)}%
                  </h3>
                  <p className="text-sm text-green-800">
                    <strong>Đáp án chuẩn:</strong> {answerKeyData.answer_key[step]}
                  </p>
                  {answerKeyData.details[idx]?.feedback && (
                    <p className="text-sm text-green-700">
                      <strong>Ghi chú:</strong> {answerKeyData.details[idx].feedback.content}
                    </p>
                  )}
                </div>
              ))}

              <div className="pt-4 border-t border-green-200">
                <p className="text-sm text-green-800">
                  <strong>Giải thích tổng quát:</strong> {answerKeyData.explanation}
                </p>
              </div>
            </div>
          )}

          <Button onClick={() => (window.location.href = '/cases')} variant="outline" className="w-full">
            Quay lại thư viện
          </Button>
        </Card>
      )}
    </div>
  );
}
