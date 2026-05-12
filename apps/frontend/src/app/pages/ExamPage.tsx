import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Activity, ArrowRight, ClipboardList, FileCheck2, Loader2, PlayCircle, SearchX, TimerReset } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useExamCases } from '@/api/hooks';
import { SketchBorder } from '@/app/components/shared/SketchBorder';
import styles from '@/styles/ExamPage.module.css';

export function ExamPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useExamCases();
  const [startingCaseId, setStartingCaseId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const cases = data?.cases ?? [];
  const totalCases = cases.length;

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

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.heroWrap}>
          <SketchBorder id="exam-hero" color="var(--ink-secondary)" opacity={0.65} zIndex={3} />
          <div className={styles.topbar}>
            <div>
              <div className={styles.eyebrow}>Timed assessment</div>
              <h1 className={styles.title}>Exam Cases</h1>
              <p className={styles.subtitle}>Focused diagnostic drills with locked timing and step-by-step scoring.</p>
            </div>
            <div className={styles.heroStats} aria-label="Exam format">
              <div className={styles.statPill}><FileCheck2 size={15} /> {totalCases} cases</div>
              <div className={styles.statPill}><Activity size={15} /> 4 steps</div>
              <div className={styles.statPill}><TimerReset size={15} /> 300s each</div>
            </div>
          </div>
        </div>

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
            <div style={{ textAlign: 'center', maxWidth: 420 }}>
              <SearchX size={40} style={{ margin: '0 auto 12px', color: 'var(--ink-secondary)' }} />
              <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)', marginBottom: 8 }}>No exam cases yet</h2>
              <p style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                Exam mode only shows cases where is_exam is true.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.grid}>
            {cases.map((caseItem: any) => {
              const firstImage = caseItem.images?.[0]?.slices?.[0]?.image_url;
              const isStarting = startingCaseId === caseItem.id;
              return (
                <div key={caseItem.id} className={styles.cardWrap}>
                  <SketchBorder id={`exam-card-${caseItem.id}`} color="var(--ink-secondary)" opacity={0.55} zIndex={3} />
                  <div className={styles.card}>
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
                      <div className={styles.chips}>
                        <span className={`${styles.chip} ${styles.chipMod}`}>
                        {caseItem.modality || 'CASE'}
                        </span>
                        <span className={`${styles.chip} ${styles.chipDifficulty}`}>
                        {caseItem.difficulty || 'Exam'}
                        </span>
                        <span className={styles.stamp}>Timed</span>
                      </div>
                      <h3 className={styles.cardTitle}>
                        {caseItem.title}
                      </h3>
                      <p className={styles.history}>
                        {caseItem.clinical_history || 'No clinical history provided.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => startExam(caseItem.id)}
                        disabled={isStarting}
                        className={styles.startBtn}
                        aria-busy={isStarting}
                      >
                        {isStarting ? <Loader2 size={16} className={styles.spin} /> : <PlayCircle size={16} />}
                        {isStarting ? 'Starting...' : 'Start Exam'}
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
    </div>
  );
}
