import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CheckCircle2, Clock3, FileText, Lock, LogOut, Send, Trophy, ZoomIn, ZoomOut } from 'lucide-react';
import { apiClient } from '@/api/client';
import { VolumeSliceViewer } from '@/app/components/shared/VolumeSliceViewer';
import { STEPS } from '@/constants/training';
import styles from '@/styles/DiagnosisSession.module.css';
import pageStyles from '@/styles/ExamSessionPage.module.css';

const STEP_SECONDS = 300;

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function ExamSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [answer, setAnswer] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<any>(null);

  const resolveNextStepIndex = (sessionData: any) => {
    const attempts = sessionData?.step_attempts ?? [];
    let idx = 0;
    while (idx < STEPS.length) {
      const attempt = attempts.find((item: any) => item.step_index === idx);
      const done = !!attempt?.submitted_at || !!attempt?.locked;
      if (!done) break;
      idx += 1;
    }
    return Math.min(idx, STEPS.length - 1);
  };

  const attemptsByStep = useMemo(() => {
    const byStep = new Map<number, any>();
    for (const attempt of session?.step_attempts ?? []) byStep.set(attempt.step_index, attempt);
    return byStep;
  }, [session]);

  const currentStep = session?.status === 'COMPLETED'
    ? (session?.current_step ?? 0)
    : Math.max(session?.current_step ?? 0, resolveNextStepIndex(session));
  const currentAttempt = attemptsByStep.get(currentStep);
  const isComplete = session?.status === 'COMPLETED';
  const secondsSpent = Math.min(STEP_SECONDS, (currentAttempt?.time_spent_seconds ?? 0) + elapsed);
  const secondsLeft = Math.max(0, STEP_SECONDS - secondsSpent);
  const currentLocked = isComplete || currentAttempt?.locked || secondsLeft <= 0;
  const allSubmitted = STEPS.every((_, idx) => {
    const attempt = attemptsByStep.get(idx);
    return attempt?.submitted_at || attempt?.locked;
  });

  const loadSession = async () => {
    if (!sessionId) return;
    setLoading(true);
    const res = await apiClient.getExamSession(sessionId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    const normalized = { ...res.data, current_step: resolveNextStepIndex(res.data) };
    setSession(normalized);
    const stepAttempt = (normalized?.step_attempts ?? []).find((a: any) => a.step_index === (normalized?.current_step ?? 0));
    setAnswer(stepAttempt?.answer ?? '');
    setElapsed(0);
  };

  useEffect(() => { loadSession(); }, [sessionId]);

  useEffect(() => {
    if (!session || isComplete || currentLocked) return;
    const timer = window.setInterval(() => setElapsed((value) => Math.min(STEP_SECONDS, value + 1)), 1000);
    return () => window.clearInterval(timer);
  }, [session?.id, currentStep, isComplete, currentLocked]);

  useEffect(() => {
    const attempt = attemptsByStep.get(currentStep);
    setAnswer(attempt?.answer ?? '');
    setElapsed(0);
  }, [currentStep, attemptsByStep]);

  const submitStep = async (force = false) => {
    if (!sessionId || currentLocked || busy) return;
    if (!force && !answer.trim()) return;
    setBusy(true);
    setError(null);
    const res = await apiClient.submitExamStep(sessionId, currentStep, answer, secondsSpent);
    setBusy(false);
    if (res.error) {
      if (secondsLeft > 0) setError(res.error);
      await loadSession();
      return;
    }
    setSession({ ...res.data, current_step: resolveNextStepIndex(res.data) });
  };

  const completeExam = async () => {
    if (!sessionId || busy) return;
    setBusy(true);
    setError(null);
    const res = await apiClient.completeExamSession(sessionId);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setSession({ ...res.data, current_step: resolveNextStepIndex(res.data) });
  };

  useEffect(() => {
    if (!sessionId || busy || isComplete || currentLocked) return;
    if (secondsLeft === 0) {
      submitStep(true);
    }
  }, [sessionId, busy, isComplete, currentLocked, secondsLeft]);

  const loadReview = async () => {
    if (!sessionId) return;
    const res = await apiClient.getExamReview(sessionId);
    if (res.error) {
      setError(res.error);
      return;
    }
    setReview(res.data);
  };

  if (loading) {
    return <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center' }}>Loading exam...</div>;
  }

  if (!session) {
    return <div style={{ minHeight: '100%', display: 'grid', placeItems: 'center', color: 'var(--accent-clay)' }}>{error || 'Exam not found'}</div>;
  }

  const caseData = session.case ?? {};
  const scorePct = session.final_score != null ? Math.round(session.final_score * 100) : null;

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.topbar}>
        <div className={pageStyles.titleWrap}>
          <h1 className={pageStyles.title}>{caseData.title}</h1>
          <span className={`${pageStyles.chip} ${pageStyles.chipFilled}`}>{caseData.modality}</span>
          <span className={pageStyles.chip}>Exam</span>
        </div>
        {!isComplete && (
          <div className={`${pageStyles.timer} ${secondsLeft <= 30 ? pageStyles.timerDanger : ''}`}>
            <Clock3 size={15} /> {formatTime(secondsLeft)}
          </div>
        )}
        <div className={pageStyles.topbarRight}>
          {isComplete && <span className={pageStyles.score}><Trophy size={15} style={{ display: 'inline', marginRight: 5 }} />{scorePct}%</span>}
          <button onClick={() => navigate('/exam')} className={pageStyles.exitBtn}>
            <LogOut size={14} /> Exit
          </button>
        </div>
      </div>

      <div className={pageStyles.layout}>
        <aside className={pageStyles.sidebar}>
          <h2 className={pageStyles.sectionTitle}>Step Timeline</h2>
          <div className={pageStyles.stepRail}>
            {STEPS.map((step, idx) => {
              const attempt = attemptsByStep.get(idx);
              const locked = isComplete || attempt?.locked;
              const submitted = !!attempt?.submitted_at;
              const active = idx === currentStep && !isComplete;
              return (
                <button
                  key={step}
                  onClick={() => {
                    if (isComplete || idx <= resolveNextStepIndex(session)) {
                      setSession({ ...session, current_step: idx });
                    }
                  }}
                  className={`${pageStyles.stepBtn} ${active ? pageStyles.stepBtnActive : ''}`}
                >
                  <span className={`${pageStyles.stepDot} ${submitted || locked ? pageStyles.stepDotDone : ''} ${active ? pageStyles.stepDotActive : ''}`} />
                  <div className={pageStyles.stepHead}>
                    <span className={pageStyles.stepName}>{idx + 1}. {step}</span>
                    {locked ? <Lock size={14} /> : submitted ? <CheckCircle2 size={14} color="var(--accent-sage)" /> : <Clock3 size={14} />}
                  </div>
                  <div className={pageStyles.stepMeta}>
                    {locked ? 'Locked' : submitted ? 'Submitted, editable' : 'Not submitted'}
                  </div>
                  {isComplete && attempt?.score != null && (
                    <div className={pageStyles.reviewScore}>
                      {Math.round(attempt.score * 100)}%
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {!isComplete && (
            <button
              onClick={completeExam}
              disabled={!allSubmitted || busy}
              className={pageStyles.completeBtn}
            >
              Complete Exam
            </button>
          )}
        </aside>

        <main className={pageStyles.mainCol}>
          <div className={pageStyles.viewerShell}>
            {caseData.images?.length ? (
              <VolumeSliceViewer images={caseData.images} zoom={zoom} imgClassName={styles.medicalImage} />
            ) : (
              <div style={{ color: 'var(--bg-page)' }}>No images available</div>
            )}
          </div>
          <div className={pageStyles.viewerTools}>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className={pageStyles.toolBtn}><ZoomIn size={15} /></button>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className={pageStyles.toolBtn}><ZoomOut size={15} /></button>
          </div>

          <section className={pageStyles.answerCard}>
            <div className={pageStyles.stepIndex}>
              Step {currentStep + 1} / {STEPS.length}
            </div>
            <h2 className={pageStyles.stepTitle}>{STEPS[currentStep]}</h2>
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={currentLocked}
              placeholder="Write your answer for this step..."
              className={pageStyles.answerInput}
            />
            {error && <div className={pageStyles.error}>{error}</div>}
            {!isComplete && (
              <button
                onClick={submitStep}
                disabled={busy || currentLocked}
                className={pageStyles.submitBtn}
              >
                <Send size={15} /> Submit Step
              </button>
            )}
          </section>
        </main>

        <aside className={pageStyles.infoCol}>
          <h2 className={pageStyles.sectionTitle}>Case Brief</h2>
          <div className={pageStyles.infoGrid}>
            <div><strong className={pageStyles.infoLabel}>History</strong><br />{caseData.clinical_history || 'No clinical history provided.'}</div>
            <div><strong className={pageStyles.infoLabel}>Disease tag</strong><br />{caseData.disease_tag || '-'}</div>
            <div><strong className={pageStyles.infoLabel}>Difficulty</strong><br />{caseData.difficulty || '-'}</div>
          </div>

          {isComplete && (
            <div>
              <button onClick={loadReview} className={pageStyles.reviewBtn}>
                <FileText size={15} /> Review Answers
              </button>
              {review && (
                <div className={pageStyles.reviewList}>
                  {STEPS.map((step, idx) => {
                    const attempt = attemptsByStep.get(idx);
                    const key = review.answer_key?.[step];
                    return (
                      <div key={step} className={pageStyles.reviewItem}>
                        <div className={pageStyles.reviewStep}>{step}</div>
                        <div className={pageStyles.reviewText}>Your answer: {attempt?.answer || '-'}</div>
                        <div className={pageStyles.reviewScore}>Score: {Math.round((attempt?.score ?? 0) * 100)}%</div>
                        <div className={pageStyles.reviewKey}>Key: {key?.expected_finding || '-'}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
