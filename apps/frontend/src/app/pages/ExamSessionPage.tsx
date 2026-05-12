import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CheckCircle2, Clock3, Loader2, Lock, LogOut, Send, Trophy, X, ZoomIn, ZoomOut } from 'lucide-react';
import { apiClient } from '@/api/client';
import { VolumeSliceViewer } from '@/app/components/shared/VolumeSliceViewer';
import { SketchBorder } from '@/app/components/shared/SketchBorder';
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
  const [selectedStep, setSelectedStep] = useState<number>(0);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

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

  const currentStep = Math.max(0, Math.min(STEPS.length - 1, selectedStep));
  const currentAttempt = attemptsByStep.get(currentStep);
  const isComplete = session?.status === 'COMPLETED';
  const secondsSpent = Math.min(STEP_SECONDS, (currentAttempt?.time_spent_seconds ?? 0) + elapsed);
  const secondsLeft = Math.max(0, STEP_SECONDS - secondsSpent);
  const timeLeftPct = Math.max(0, Math.min(100, (secondsLeft / STEP_SECONDS) * 100));
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
    const initialStep = normalized.status === 'COMPLETED' ? 0 : normalized.current_step ?? 0;
    setSelectedStep(initialStep);
    const stepAttempt = (normalized?.step_attempts ?? []).find((a: any) => a.step_index === initialStep);
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
    const nextStep = resolveNextStepIndex(res.data);
    setSession({ ...res.data, current_step: nextStep });
    setSelectedStep(nextStep);
    setStatusNote(`Step ${currentStep + 1} saved`);
    window.setTimeout(() => setStatusNote(null), 1500);
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
    const doneSession = { ...res.data, current_step: 0 };
    setSession(doneSession);
    setSelectedStep(0);
    setStatusNote('Exam completed');
    setShowResultModal(true);
  };

  useEffect(() => {
    if (!sessionId || busy || isComplete || currentLocked) return;
    if (secondsLeft === 0) {
      submitStep(true);
    }
  }, [sessionId, busy, isComplete, currentLocked, secondsLeft]);

  useEffect(() => {
    if (!showResultModal) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowResultModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showResultModal]);

  if (loading) {
    return (
      <div className={pageStyles.loadingPage} aria-live="polite" aria-busy="true">
        <Loader2 className={pageStyles.spin} size={24} />
        <span>Loading exam...</span>
      </div>
    );
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
          <div className={pageStyles.timerWrap}>
            <SketchBorder id="exam-session-timer" color="var(--ink-secondary)" opacity={0.6} zIndex={2} />
            <div className={`${pageStyles.timerRail} ${secondsLeft <= 30 ? pageStyles.timerRailDanger : ''}`}>
              <div className={pageStyles.timerHead}>
                <span className={pageStyles.timerText}><Clock3 size={15} /> {formatTime(secondsLeft)}</span>
                <span className={pageStyles.timerStep}>Step timer</span>
              </div>
              <div className={pageStyles.timerTrack} role="progressbar" aria-valuemin={0} aria-valuemax={STEP_SECONDS} aria-valuenow={secondsLeft} aria-label="Time remaining">
                <div className={pageStyles.timerFill} style={{ width: `${timeLeftPct}%` }} />
              </div>
            </div>
          </div>
        )}
        <div className={pageStyles.topbarRight}>
          <div className={pageStyles.statusRegion} aria-live="polite">
            {busy && <span className={pageStyles.statusBusy}><Loader2 className={pageStyles.spin} size={13} /> Processing...</span>}
            {statusNote && <span className={pageStyles.statusOk}>{statusNote}</span>}
          </div>
          {isComplete && <span className={pageStyles.score}><Trophy size={15} style={{ display: 'inline', marginRight: 5 }} />{scorePct}%</span>}
          <button type="button" onClick={() => navigate('/exam')} className={pageStyles.exitBtn}>
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
                  type="button"
                  key={step}
                  onClick={() => {
                    if (isComplete || idx <= resolveNextStepIndex(session)) {
                      setSelectedStep(idx);
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
              type="button"
              onClick={completeExam}
              disabled={!allSubmitted || busy}
              className={pageStyles.completeBtn}
            >
              {busy ? 'Completing...' : 'Complete Exam'}
            </button>
          )}
        </aside>

        <main className={pageStyles.mainCol}>
          <div className={pageStyles.viewerShell}>
            {busy && (
              <div className={pageStyles.busyScrim} aria-live="polite">
                <Loader2 className={pageStyles.spin} size={22} />
                <span>Scoring response...</span>
              </div>
            )}
            {caseData.images?.length ? (
              <VolumeSliceViewer images={caseData.images} zoom={zoom} imgClassName={styles.medicalImage} />
            ) : (
              <div style={{ color: 'var(--bg-page)' }}>No images available</div>
            )}
          </div>
          <div className={pageStyles.viewerTools}>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom(z => Math.min(3, z + 0.25))} className={pageStyles.toolBtn}><ZoomIn size={15} /></button>
            <button type="button" aria-label="Zoom out" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className={pageStyles.toolBtn}><ZoomOut size={15} /></button>
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
                type="button"
                onClick={submitStep}
                disabled={busy || currentLocked}
                className={pageStyles.submitBtn}
              >
                {busy ? <Loader2 className={pageStyles.spin} size={15} /> : <Send size={15} />} {busy ? 'Submitting...' : 'Submit Step'}
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
        </aside>
      </div>
      {showResultModal && (
        <div className={pageStyles.modalBackdrop} onClick={() => setShowResultModal(false)} role="presentation">
          <div className={pageStyles.modalCard} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="exam-result-title">
            <div className={pageStyles.modalHeader}>
              <div>
                <div className={pageStyles.modalKicker}>Final score</div>
                <h3 id="exam-result-title" className={pageStyles.modalTitle}>Exam Results</h3>
              </div>
              <div className={pageStyles.modalTotal}>{scorePct ?? 0}%</div>
              <button type="button" aria-label="Close results" className={pageStyles.modalIconBtn} onClick={() => setShowResultModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className={pageStyles.modalList}>
              {STEPS.map((step, idx) => {
                const attempt = attemptsByStep.get(idx);
                return (
                  <div key={step} className={pageStyles.modalItem}>
                    <div className={pageStyles.modalStep}>{idx + 1}. {step}</div>
                    <div className={pageStyles.modalScore}>{Math.round((attempt?.score ?? 0) * 100)}%</div>
                  </div>
                );
              })}
            </div>
            <button type="button" className={pageStyles.modalClose} onClick={() => setShowResultModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
