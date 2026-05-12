import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CheckCircle2, Clock3, FileText, Lock, LogOut, Send, Trophy, ZoomIn, ZoomOut } from 'lucide-react';
import { apiClient } from '@/api/client';
import { VolumeSliceViewer } from '@/app/components/shared/VolumeSliceViewer';
import { STEPS } from '@/constants/training';
import styles from '@/styles/DiagnosisSession.module.css';

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

  const attemptsByStep = useMemo(() => {
    const byStep = new Map<number, any>();
    for (const attempt of session?.step_attempts ?? []) byStep.set(attempt.step_index, attempt);
    return byStep;
  }, [session]);

  const currentStep = session?.current_step ?? 0;
  const currentAttempt = attemptsByStep.get(currentStep);
  const isComplete = session?.status === 'COMPLETED';
  const secondsSpent = Math.min(STEP_SECONDS, (currentAttempt?.time_spent_seconds ?? 0) + elapsed);
  const secondsLeft = Math.max(0, STEP_SECONDS - secondsSpent);
  const currentLocked = isComplete || currentAttempt?.locked || secondsLeft <= 0;
  const allSubmitted = STEPS.every((_, idx) => {
    const attempt = attemptsByStep.get(idx);
    return attempt?.submitted_at && (attempt?.answer ?? '').trim();
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
    setSession(res.data);
    const stepAttempt = (res.data?.step_attempts ?? []).find((a: any) => a.step_index === (res.data?.current_step ?? 0));
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

  const submitStep = async () => {
    if (!sessionId || currentLocked || busy) return;
    setBusy(true);
    setError(null);
    const res = await apiClient.submitExamStep(sessionId, currentStep, answer, secondsSpent);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      await loadSession();
      return;
    }
    setSession(res.data);
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
    setSession(res.data);
  };

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
    <div style={{ minHeight: '100%', background: 'var(--bg-page)', display: 'grid', gridTemplateRows: 'auto 1fr' }}>
      <div style={{ height: 58, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', background: 'var(--bg-surface-alt)' }}>
        <strong style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)', fontSize: 20 }}>{caseData.title}</strong>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bg-page)', background: 'var(--accent-ink)', padding: '4px 8px' }}>{caseData.modality}</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary)', border: '1px solid var(--border)', padding: '3px 8px' }}>Exam</span>
        <div style={{ flex: 1 }} />
        {isComplete && <span style={{ color: 'var(--accent-sage)', fontFamily: 'var(--font-mono)' }}><Trophy size={15} style={{ display: 'inline', marginRight: 5 }} />{scorePct}%</span>}
        <button onClick={() => navigate('/exam')} style={{ border: '1px solid var(--border)', background: 'transparent', padding: '8px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
          <LogOut size={14} /> Exit
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(420px, 1fr) 320px', minHeight: 0 }}>
        <aside style={{ borderRight: '1px solid var(--border)', padding: 18, background: 'var(--bg-surface-alt)', overflow: 'auto' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)', marginBottom: 12 }}>Step History</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {STEPS.map((step, idx) => {
              const attempt = attemptsByStep.get(idx);
              const locked = isComplete || attempt?.locked;
              const submitted = !!attempt?.submitted_at;
              const active = idx === currentStep && !isComplete;
              return (
                <button
                  key={step}
                  onClick={() => {
                    if (isComplete || idx <= currentStep) {
                      setSession({ ...session, current_step: idx });
                    }
                  }}
                  style={{
                    textAlign: 'left',
                    border: active ? '2px solid var(--accent-clay)' : '1px solid var(--border)',
                    background: active ? 'rgba(192,57,43,0.06)' : 'var(--bg-page)',
                    padding: 12,
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)' }}>{idx + 1}. {step}</span>
                    {locked ? <Lock size={14} /> : submitted ? <CheckCircle2 size={14} color="var(--accent-sage)" /> : <Clock3 size={14} />}
                  </div>
                  <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary)' }}>
                    {locked ? 'Locked' : submitted ? 'Submitted, editable' : 'Not submitted'}
                  </div>
                  {isComplete && attempt?.score != null && (
                    <div style={{ marginTop: 6, color: 'var(--accent-sage)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
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
              style={{
                width: '100%',
                marginTop: 18,
                padding: '11px 12px',
                border: '1px solid var(--accent-sage)',
                background: allSubmitted ? 'var(--accent-sage)' : 'transparent',
                color: allSubmitted ? 'var(--bg-page)' : 'var(--ink-secondary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Complete Exam
            </button>
          )}
        </aside>

        <main style={{ position: 'relative', padding: 22, minHeight: 0, overflow: 'auto' }}>
          {!isComplete && (
            <div style={{
              position: 'absolute',
              top: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2,
              border: '1px solid var(--border)',
              background: secondsLeft <= 30 ? 'var(--accent-clay)' : 'var(--bg-surface-alt)',
              color: secondsLeft <= 30 ? 'var(--bg-page)' : 'var(--ink)',
              padding: '8px 14px',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <Clock3 size={16} /> {formatTime(secondsLeft)}
            </div>
          )}
          <div style={{ height: '58vh', minHeight: 380, border: '1px solid var(--border)', background: '#101010', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
            {caseData.images?.length ? (
              <VolumeSliceViewer images={caseData.images} zoom={zoom} imgClassName={styles.medicalImage} />
            ) : (
              <div style={{ color: 'var(--bg-page)' }}>No images available</div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 10 }}>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} style={{ border: '1px solid var(--border)', padding: 8 }}><ZoomIn size={15} /></button>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} style={{ border: '1px solid var(--border)', padding: 8 }}><ZoomOut size={15} /></button>
          </div>

          <section style={{ marginTop: 18, border: '1px solid var(--border)', background: 'var(--bg-surface-alt)', padding: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-secondary)', marginBottom: 8 }}>
              Step {currentStep + 1} / {STEPS.length}
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)', margin: '0 0 10px' }}>{STEPS[currentStep]}</h2>
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={currentLocked}
              placeholder="Write your answer for this step..."
              style={{
                width: '100%',
                minHeight: 150,
                resize: 'vertical',
                border: '1px solid var(--border)',
                background: currentLocked ? 'rgba(0,0,0,0.04)' : 'var(--bg-page)',
                color: 'var(--ink)',
                padding: 12,
                fontFamily: 'var(--font-mono)',
                lineHeight: 1.5,
              }}
            />
            {error && <div style={{ marginTop: 10, color: 'var(--accent-clay)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{error}</div>}
            {!isComplete && (
              <button
                onClick={submitStep}
                disabled={busy || currentLocked || !answer.trim()}
                style={{ marginTop: 12, border: '1px solid var(--accent-clay)', background: 'var(--accent-clay)', color: 'var(--bg-page)', padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-mono)' }}
              >
                <Send size={15} /> Submit Step
              </button>
            )}
          </section>
        </main>

        <aside style={{ borderLeft: '1px solid var(--border)', padding: 18, background: 'var(--bg-surface-alt)', overflow: 'auto' }}>
          <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)', marginBottom: 12 }}>Case Info</h2>
          <div style={{ display: 'grid', gap: 12, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-secondary)' }}>
            <div><strong style={{ color: 'var(--ink)' }}>History</strong><br />{caseData.clinical_history || 'No clinical history provided.'}</div>
            <div><strong style={{ color: 'var(--ink)' }}>Disease tag</strong><br />{caseData.disease_tag || '-'}</div>
            <div><strong style={{ color: 'var(--ink)' }}>Difficulty</strong><br />{caseData.difficulty || '-'}</div>
          </div>

          {isComplete && (
            <div style={{ marginTop: 22 }}>
              <button onClick={loadReview} style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--accent-ink)', background: 'var(--accent-ink)', color: 'var(--bg-page)', fontFamily: 'var(--font-mono)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <FileText size={15} /> Review Answers
              </button>
              {review && (
                <div style={{ marginTop: 14, display: 'grid', gap: 12 }}>
                  {STEPS.map((step, idx) => {
                    const attempt = attemptsByStep.get(idx);
                    const key = review.answer_key?.[step];
                    return (
                      <div key={step} style={{ border: '1px solid var(--border)', background: 'var(--bg-page)', padding: 12 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink)', marginBottom: 6 }}>{step}</div>
                        <div style={{ fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.45 }}>Your answer: {attempt?.answer || '-'}</div>
                        <div style={{ fontSize: 12, color: 'var(--accent-sage)', marginTop: 6 }}>Score: {Math.round((attempt?.score ?? 0) * 100)}%</div>
                        <div style={{ fontSize: 12, color: 'var(--ink)', marginTop: 6 }}>Key: {key?.expected_finding || '-'}</div>
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
