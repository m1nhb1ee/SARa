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
import { AlertCircle, CheckCircle2, Lightbulb, TrendingUp } from 'lucide-react';

const STEPS = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION'];

const STEP_DESCRIPTIONS = {
  OBSERVE: 'Quan sát ảnh. Bạn thấy gì ở trên ảnh? Có gì khác lạ?',
  DESCRIBE: 'Mô tả chi tiết những gì bạn thấy. Kích thước, hình dạng, vị trí?',
  INTERPRET: 'Diễn giải ý nghĩa. Những điểm này có thể do nguyên nhân nào?',
  HYPOTHESIS: 'Giả thuyết chẩn đoán. Đâu là chẩn đoán chính?',
  DDx: 'Chẩn đoán phân biệt. Còn những chẩn đoán khác nào?',
  CONCLUSION: 'Kết luận. Chẩn đoán cuối cùng của bạn là gì?',
};

interface FeedbackResult {
  attempt: {
    id: number;
    step_index: number;
    step_name: string;
    student_answer: string;
    score: number;
    errors: string[];
    feedback: {
      type: 'error' | 'hint' | 'correct';
      content: string;
    };
    latency_ms: number;
  };
  passed: boolean;
  next_step?: number;
  hint?: string;
  message: string;
  session_complete?: boolean;
}

export function DiagnosisTrainingPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const { data: caseData, loading: caseLoading } = useCaseDetail(caseId ?? null);
  const { createSession } = useCreateSession();
  const { data: sessionData, loading: sessionLoading, refetch: refetchSession } = useSessionDetail(sessionId);
  const { submitAnswer } = useSubmitAnswer();
  const { data: answerKeyData, fetch: fetchAnswerKey } = useGetAnswerKey(sessionId);

  // Create session on mount
  useEffect(() => {
    if (!caseId || sessionId) return;

    const create = async () => {
      const session = await createSession(caseId);
      if (session) {
        setSessionId(session.id);
      }
    };

    create();
  }, [caseId, sessionId, createSession]);

  const handleSubmitAnswer = async () => {
    if (!sessionId || !studentAnswer.trim()) return;

    setSubmitting(true);
    const result = await submitAnswer(sessionId, studentAnswer) as FeedbackResult | null;

    if (result) {
      setFeedback(result);
      setShowFeedback(true);
      setStudentAnswer('');
      
      // If passed, refetch session to ensure backend state is updated
      if (result.attempt.score >= 0.7) {
        setTimeout(() => {
          refetchSession();
        }, 300);
      }
    }

    setSubmitting(false);
  };

  const handleContinue = () => {
    // CRITICAL: Use next_step from API response, NOT refetch timing
    if (!feedback) return;
    
    // Check if score too low
    if (feedback.attempt.score < 0.7) {
      console.log(`⚠️ Score ${(feedback.attempt.score * 100).toFixed(1)}% < 70%, staying on step ${feedback.attempt.step_index}`);
      setShowFeedback(false);
      setFeedback(null);
      return;
    }
    
    // Validate next_step from API
    let nextStep = feedback.next_step;
    if (nextStep === undefined) {
      // Fallback: calculate from current attempt
      nextStep = feedback.attempt.step_index + 1;
      console.log(`⚡ Calculated nextStep: ${nextStep} (from step ${feedback.attempt.step_index})`);
    } else {
      console.log(`✅ Using next_step from API: ${nextStep}`);
    }
    
    // Close feedback modal
    setShowFeedback(false);
    setFeedback(null);
    
    // Clear answer for next step
    setStudentAnswer('');
    
    console.log(`📍 Step progression: ${feedback.attempt.step_index} → ${nextStep}`);
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
      {(() => {
        const volumes: { volume_name: string; slices: { image_url: string; slice_index: number }[] }[] = caseData?.images ?? [];
        const allSlices = volumes.flatMap(v => v.slices);
        const displayUrls: string[] = allSlices.length > 0
          ? allSlices.map(s => s.image_url)
          : (caseData?.image_urls ?? []);
        if (displayUrls.length === 0) return null;
        return (
          <div className="space-y-2">
            <h2 className="font-semibold">Hình ảnh y tế</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayUrls.map((url: string, idx: number) => (
                <img
                  key={idx}
                  src={url}
                  alt={`Hình ${idx + 1}`}
                  className="w-full rounded-lg border bg-neutral-100 object-cover max-h-96"
                />
              ))}
            </div>
          </div>
        );
      })()}

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

      {/* Feedback Display */}
      {showFeedback && feedback && (
        <Card className={`p-6 space-y-4 border-2 ${feedback.passed ? 'bg-green-50 border-green-500' : 'bg-amber-50 border-amber-500'}`}>
          <div className="flex items-start gap-4">
            {feedback.passed ? (
              <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
            ) : (
              <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-1" />
            )}
            <div className="space-y-3 flex-1">
              <div>
                <h3 className={`font-bold text-lg ${feedback.passed ? 'text-green-900' : 'text-amber-900'}`}>
                  {feedback.passed ? '✓ Câu trả lời chính xác!' : '⚠ Câu trả lời chưa chính xác'}
                </h3>
                <p className={feedback.passed ? 'text-green-800' : 'text-amber-800'}>
                  Điểm: {(feedback.attempt.score * 100).toFixed(0)}%
                </p>
              </div>

              <div className={`p-4 rounded ${feedback.passed ? 'bg-green-100' : 'bg-amber-100'}`}>
                <p className={feedback.passed ? 'text-green-900' : 'text-amber-900'}>
                  {typeof feedback.attempt.feedback === 'string' ? feedback.attempt.feedback : feedback.attempt.feedback?.content}
                </p>
              </div>

              {feedback.attempt.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-neutral-700">Các lỗi được phát hiện:</p>
                  <ul className="text-sm space-y-1">
                    {feedback.attempt.errors.map((error, idx) => (
                      <li key={idx} className="text-neutral-700 flex items-start gap-2">
                        <span className="text-red-600 font-bold">•</span>
                        <span>{error}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {feedback.hint && (
                <div className="bg-blue-50 p-4 rounded border border-blue-200 flex gap-3">
                  <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Gợi ý từ AI:</p>
                    <p className="text-sm text-blue-800 mt-1">{feedback.hint}</p>
                  </div>
                </div>
              )}

              <p className="text-xs text-neutral-500">Thời gian xử lý: {feedback.attempt.latency_ms}ms</p>

              {feedback.session_complete ? (
                <div className="pt-2 border-t border-green-200">
                  <p className="text-sm font-semibold text-green-900">🎉 Chúc mừng! Bạn đã hoàn thành case này!</p>
                </div>
              ) : null}
            </div>
          </div>

          <Button onClick={handleContinue} className="w-full">
            {feedback.session_complete ? 'Xem đáp án' : `Tiếp tục - Bước ${feedback.next_step! + 1}`}
          </Button>
        </Card>
      )}

      {/* Training Area */}
      {!isCompleted && !showFeedback && (
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
            {submitting ? 'Đang xử lý bởi AI...' : 'Nộp câu trả lời'}
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
                      <strong>Ghi chú:</strong> {typeof answerKeyData.details[idx].feedback === 'string' ? answerKeyData.details[idx].feedback : answerKeyData.details[idx].feedback?.content}
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
