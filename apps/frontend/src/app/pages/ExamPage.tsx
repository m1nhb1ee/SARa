import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ClipboardList, PlayCircle, SearchX } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useExamCases } from '@/api/hooks';

export function ExamPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useExamCases();
  const [startingCaseId, setStartingCaseId] = useState<string | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const cases = data?.cases ?? [];

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
    <div style={{
      minHeight: '100%',
      backgroundColor: 'var(--bg-page)',
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.18) 31px, rgba(196,168,130,0.18) 32px)',
      backgroundSize: '100% 32px',
      padding: 32,
    }}>
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Timed assessment
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)', fontSize: 42, margin: '6px 0 0' }}>
              Exam Cases
            </h1>
          </div>
          <div style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
            4 steps / 300 seconds each
          </div>
        </div>

        {(error || startError) && (
          <div style={{ border: '1px solid var(--accent-clay)', color: 'var(--accent-clay)', padding: 12, marginBottom: 18, background: 'rgba(192,57,43,0.05)' }}>
            {error || startError}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 32, color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)' }}>Loading exam cases...</div>
        ) : cases.length === 0 ? (
          <div style={{ minHeight: 360, display: 'grid', placeItems: 'center', border: '1px dashed var(--border)', background: 'var(--bg-surface-alt)' }}>
            <div style={{ textAlign: 'center', maxWidth: 420 }}>
              <SearchX size={40} style={{ margin: '0 auto 12px', color: 'var(--ink-secondary)' }} />
              <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)', marginBottom: 8 }}>No exam cases yet</h2>
              <p style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                Exam mode only shows cases where is_exam is true.
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
            {cases.map((caseItem: any) => {
              const firstImage = caseItem.images?.[0]?.slices?.[0]?.image_url;
              const isStarting = startingCaseId === caseItem.id;
              return (
                <div
                  key={caseItem.id}
                  style={{
                    border: '1px solid var(--border)',
                    background: 'var(--bg-surface)',
                    overflow: 'hidden',
                    borderRadius: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 420,
                  }}
                >
                  <div style={{ height: 170, background: 'var(--border-strong)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {firstImage ? (
                      <img src={firstImage} alt={caseItem.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <ClipboardList size={36} color="var(--ink-secondary)" />
                    )}
                  </div>
                  <div style={{ padding: 16, background: 'var(--bg-surface-alt)', color: 'var(--ink)', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bg-page)', background: 'var(--accent-ink)', padding: '3px 7px' }}>
                        {caseItem.modality || 'CASE'}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-secondary)', border: '1px solid var(--border)', padding: '2px 7px' }}>
                        {caseItem.difficulty || 'Exam'}
                      </span>
                    </div>
                    <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--ink)', fontSize: 20, margin: '0 0 8px' }}>
                      {caseItem.title}
                    </h3>
                    <p style={{ color: 'var(--ink-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12, minHeight: 48, lineHeight: 1.5 }}>
                      {caseItem.clinical_history || 'No clinical history provided.'}
                    </p>
                    <button
                      onClick={() => startExam(caseItem.id)}
                      disabled={isStarting}
                      style={{
                        width: '100%',
                        marginTop: 'auto',
                        border: '1px solid var(--accent-clay)',
                        background: isStarting ? 'transparent' : 'var(--accent-clay)',
                        color: isStarting ? 'var(--accent-clay)' : 'var(--bg-page)',
                        padding: '10px 12px',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                      }}
                    >
                      <PlayCircle size={16} />
                      {isStarting ? 'Starting...' : 'Start Exam'}
                    </button>
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
