import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, ArrowRight, CheckCircle2, ClipboardList, Clock3, FileCheck2, Loader2, PlayCircle, SearchX, TimerReset, Trophy } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useExamCases } from '@/api/hooks';
import { SketchBorder } from '@/app/components/shared/SketchBorder';
import styles from '@/styles/ExamPage.module.css';

export function ExamPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useExamCases();
  const [startingCaseId, setStartingCaseId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const cases = data?.cases ?? [];
  const totalCases = cases.length;
  const guideItems = [
    { icon: ClipboardList, label: 'Pick a case', detail: 'Read the clinical note first' },
    { icon: TimerReset, label: '300s each', detail: 'Timed response per step' },
    { icon: Activity, label: '4 steps', detail: 'Describe, reason, DDx, conclude' },
  ];

  const startExam = async (caseId: string) => {
    setStartingCaseId(caseId);
    setStartError(null);
    const res = await apiClient.createExamSession(caseId);
    setStartingCaseId(null);
    if (res.error || !res.data?.id) {
      setStartError(res.error || 'Could not start exam session');
      return;
    }
    navigate(`/exam/session/${res.data.id}`);
  };

  const loadSessions = async () => {
    const res = await apiClient.listExamSessions();
    if (res.error) {
      console.warn('[ExamPage] listExamSessions failed:', res.error, 'status:', res.status);
      return;
    }
    const list = res.data?.sessions ?? [];
    console.log('[ExamPage] loaded sessions:', list.length, list);
    setSessions(list);
  };

  useEffect(() => { loadSessions(); }, []);

  const stateByCase = new Map<string, { best?: any; inProgress?: any }>();
  for (const session of sessions) {
    const entry = stateByCase.get(session.case_id) ?? {};
    if (session.status === 'COMPLETED') {
      if (!entry.best || (session.final_score ?? 0) > (entry.best.final_score ?? 0)) {
        entry.best = session;
      }
    } else if (session.status === 'IN_PROGRESS') {
      const current = entry.inProgress;
      if (!current || (session.started_at ?? '') > (current.started_at ?? '')) {
        entry.inProgress = session;
      }
    }
    stateByCase.set(session.case_id, entry);
  }
  const activeEntry = activeCaseId ? stateByCase.get(activeCaseId) : null;
  const activeBest = activeEntry?.best ?? null;
  const activeInProgress = activeEntry?.inProgress ?? null;
  const activeCase = activeCaseId ? cases.find((c: any) => c.id === activeCaseId) : null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.heroWrap}>
          <SketchBorder id="exam-hero" color="var(--ink-secondary)" opacity={0.65} zIndex={3} />
          <div className={styles.topbar}>
            <div className={styles.heroCopy}>
              <div className={styles.eyebrow}>Timed assessment dossier</div>
              <h1 className={styles.title}>Exam Cases</h1>
              <p className={styles.subtitle}>
                Choose one case, enter a locked diagnostic flow, and commit each answer under exam timing.
              </p>
            </div>
            <div className={styles.heroStats} aria-label="Exam format">
              <div className={styles.statPill}><FileCheck2 size={15} /> {totalCases} cases</div>
              <div className={styles.statPill}><Activity size={15} /> 4 steps</div>
              <div className={styles.statPill}><TimerReset size={15} /> 300s each</div>
            </div>
          </div>
        </div>

        <section className={styles.guidePanel} aria-label="Exam instructions">
          {guideItems.map(({ icon: Icon, label, detail }) => (
            <div key={label} className={styles.guideItem}>
              <div className={styles.guideIcon}><Icon size={16} /></div>
              <div>
                <div className={styles.guideLabel}>{label}</div>
                <div className={styles.guideDetail}>{detail}</div>
              </div>
            </div>
          ))}
        </section>

        {(error || startError) && (
          <div className={styles.error} role="alert">
            {error || startError}
          </div>
        )}

        {loading ? (
          <div className={styles.grid} aria-live="polite" aria-busy="true">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className={`${styles.cardWrap} ${styles.skeletonWrap}`}>
                <div className={styles.skeletonCard}>
                  <div className={styles.skeletonImage} />
                  <div className={styles.skeletonLineWide} />
                  <div className={styles.skeletonLine} />
                  <div className={styles.skeletonButton} />
                </div>
              </div>
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyInner}>
              <SearchX size={40} className={styles.emptyIcon} />
              <h2 className={styles.emptyTitle}>No exam cases yet</h2>
              <p className={styles.emptyText}>
                Exam mode only shows cases where is_exam is true.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {cases.map((caseItem: any, idx: number) => {
              const firstImage = caseItem.images?.[0]?.slices?.[0]?.image_url;
              const isStarting = startingCaseId === caseItem.id;
              const entry = stateByCase.get(caseItem.id);
              const best = entry?.best;
              const inProgress = entry?.inProgress;
              const isDone = !!best;
              const hasInProgress = !!inProgress;
              const hasAny = isDone || hasInProgress;
              const scorePct = best?.final_score != null ? Math.round(best.final_score * 100) : null;
              return (
                <div key={caseItem.id} className={styles.cardWrap}>
                  <SketchBorder id={`exam-card-${caseItem.id}`} color="var(--ink-secondary)" opacity={0.55} zIndex={3} />
                  <div className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.caseNumber}>Case #{String(idx + 1).padStart(3, '0')}</span>
                      <span className={styles.stamp}>Timed</span>
                    </div>
                    <div className={styles.thumb}>
                      <div className={styles.thumbInner}>
                        {firstImage ? (
                          <img src={firstImage} alt={caseItem.title} width={520} height={280} loading="lazy" />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
                            <ClipboardList size={36} color="var(--ink-secondary)" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.body}>
                      {isDone ? (
                        <div className={styles.doneBadge}>
                          <CheckCircle2 size={12} />
                          {scorePct != null ? `${scorePct}%` : 'Done'}
                        </div>
                      ) : hasInProgress ? (
                        <div className={styles.doneBadge} style={{ background: 'var(--accent-clay)', color: '#fff' }}>
                          <Clock3 size={12} />
                          In progress
                        </div>
                      ) : null}
                      <div className={styles.chips}>
                        <span className={`${styles.chip} ${styles.chipMod}`}>
                        {caseItem.modality || 'CASE'}
                        </span>
                        <span className={`${styles.chip} ${styles.chipDifficulty}`}>
                        {caseItem.difficulty || 'Exam'}
                        </span>
                      </div>
                      <h3 className={styles.cardTitle}>
                        {caseItem.title}
                      </h3>
                      <p className={styles.history}>
                        {caseItem.clinical_history || 'No clinical history provided.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => (hasAny ? setActiveCaseId(caseItem.id) : startExam(caseItem.id))}
                        disabled={isStarting}
                        className={styles.startBtn}
                        aria-busy={isStarting}
                      >
                        {isStarting ? <Loader2 size={16} className={styles.spin} /> : <PlayCircle size={16} />}
                        {isStarting ? 'Starting...' : isDone ? 'View Score' : hasInProgress ? 'Resume' : 'Start Exam'}
                        {!isStarting && <ArrowRight size={15} />}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {activeCase && (activeBest || activeInProgress) && (
        <div className={styles.modalOverlay} onClick={() => setActiveCaseId(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHead}>
              {activeBest ? <Trophy size={20} color="var(--accent-sage)" /> : <Clock3 size={20} color="var(--accent-clay)" />}
              <h3 className={styles.modalTitle}>{activeBest ? 'Exam Completed' : 'Exam In Progress'}</h3>
            </div>
            <p className={styles.modalCase}>{activeCase.title}</p>
            {activeBest ? (
              <p className={styles.modalScore}>Final Score: {Math.round((activeBest.final_score ?? 0) * 100)}%</p>
            ) : (
              <p className={styles.modalScore}>Bạn có 1 session đang dở. Tiếp tục hoặc bắt đầu lại?</p>
            )}
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalGhost} onClick={() => setActiveCaseId(null)}>Close</button>
              {activeBest && (
                <button type="button" className={styles.modalSecondary} onClick={() => navigate(`/exam/session/${activeBest.id}`)}>View Session</button>
              )}
              {activeInProgress && (
                <button type="button" className={styles.modalSecondary} onClick={() => navigate(`/exam/session/${activeInProgress.id}`)}>Resume</button>
              )}
              <button type="button" className={styles.modalPrimary} onClick={() => { const id = activeCaseId; setActiveCaseId(null); if (id) startExam(id); }}>{activeBest ? 'Retake' : 'Restart'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
