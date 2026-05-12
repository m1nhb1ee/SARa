import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, MessageSquare, Stethoscope, Trophy } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useCases, useSwapSessions } from '@/api/hooks';
import { SketchBorder } from '@/app/components/shared/SketchBorder';

type SwapSessionRow = {
  id: string;
  case_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED';
  final_score: number | null;
  completed_at: string | null;
};

function firstImageUrl(caseItem: any): string {
  return caseItem?.images?.[0]?.slices?.[0]?.image_url ?? caseItem?.image_urls?.[0] ?? '';
}

function SwapLoadingModal({ progress, caseTitle }: { progress: number; caseTitle?: string }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(44,24,16,0.65)', backdropFilter: 'blur(2px)' }}
    >
      <div className="relative w-full max-w-[520px]" style={{ fontFamily: "'Lora', serif" }}>
        <div
          style={{
            background: 'var(--bg-surface-alt)',
            borderLeft: '2px solid var(--border)',
            borderRight: '2px solid var(--border)',
            borderTop: '2px solid var(--border)',
            clipPath: 'polygon(0 0, 100% 0, 100% 76%, 94% 100%, 88% 73%, 80% 100%, 72% 73%, 64% 100%, 56% 73%, 50% 100%, 44% 73%, 36% 100%, 28% 73%, 20% 100%, 12% 73%, 5% 100%, 0 76%)',
            padding: '16px 24px 34px',
          }}
        >
          <div style={{ fontFamily: "var(--font-typewriter)", fontSize: 12, color: 'var(--accent-sage)', letterSpacing: '0.12em' }}>
            SWAP DEBATE INTAKE
          </div>
        </div>

        <div
          style={{
            background: 'var(--bg-surface-alt)',
            border: '2px solid var(--border)',
            borderTop: 'none',
            padding: '24px 30px 28px',
            boxShadow: '0 12px 40px rgba(44,24,16,0.3)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(196,168,130,0.13) 27px, rgba(196,168,130,0.13) 28px)',
              backgroundPositionY: '12px',
            }}
          />

          <div className="relative z-10 flex flex-col items-center">
            <div className="swap-doctor-animation" aria-hidden="true">
              <svg width="128" height="118" viewBox="0 0 128 118" fill="none">
                <rect x="13" y="23" width="45" height="64" rx="4" fill="var(--bg-page)" stroke="var(--ink)" strokeWidth="1.5" />
                <rect x="20" y="31" width="31" height="40" fill="#2F3A42" stroke="var(--accent-ink)" strokeWidth="1.5" />
                <path className="swap-scan-line" d="M22 43H49" stroke="var(--accent-sage)" strokeWidth="2" strokeLinecap="round" />
                <path d="M25 59C30 51 34 64 39 55C42 50 45 57 48 53" stroke="var(--border)" strokeWidth="1.4" fill="none" />
                <circle cx="85" cy="32" r="16" fill="#E7C7A3" stroke="var(--ink)" strokeWidth="1.5" />
                <path d="M70 30C73 18 84 13 95 19C100 22 102 28 101 34C93 27 82 30 70 30Z" fill="#5C3D2E" stroke="var(--ink)" strokeWidth="1" />
                <circle cx="80" cy="34" r="1.6" fill="var(--ink)" />
                <circle cx="92" cy="34" r="1.6" fill="var(--ink)" />
                <path d="M81 43C86 46 91 45 95 42" stroke="var(--ink)" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M62 111C64 73 71 56 85 56C99 56 107 73 110 111H62Z" fill="var(--bg-page)" stroke="var(--ink)" strokeWidth="1.5" />
                <path d="M84 57L78 111M88 57L95 111" stroke="var(--border)" strokeWidth="1.2" />
                <path d="M73 67C68 77 72 88 82 88C93 88 98 77 92 67" stroke="#1B5C4A" strokeWidth="2" strokeLinecap="round" />
                <circle className="swap-stethoscope" cx="82" cy="89" r="4" fill="#1B5C4A" stroke="var(--ink)" strokeWidth="1" />
                <path d="M111 42L118 36M111 52H122M108 61L117 68" stroke="var(--accent-clay)" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              </svg>
            </div>

            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 23, color: 'var(--ink)', margin: '8px 0 4px', textAlign: 'center' }}>
              Calling the stubborn doctor
            </h2>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: 'var(--ink-secondary)', fontStyle: 'italic', textAlign: 'center', marginBottom: 14 }}>
              {caseTitle ? `Preparing debate for ${caseTitle}` : 'Preparing debate room and first opinion'}
            </p>

            <div className="relative w-full max-w-sm">
              <svg viewBox="0 0 300 24" style={{ width: '100%', height: 24 }}>
                <path d="M2,12 C2,6 4,2 10,2 L290,2 C296,2 298,6 298,12 C298,18 296,22 290,22 L10,22 C4,22 2,18 2,12 Z"
                  fill="none" stroke="var(--border)" strokeWidth="1.5" />
                <rect x="4" y="4" width="292" height="16" rx="4" fill="var(--bg-page)" />
                <rect
                  x="4"
                  y="4"
                  width={`${(Math.min(progress, 100) / 100) * 292}`}
                  height="16"
                  rx="4"
                  fill="var(--accent-sage)"
                  opacity="0.78"
                  style={{ transition: 'width 0.16s ease' }}
                />
              </svg>
            </div>

            <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 20, color: 'var(--ink)', fontWeight: 700 }}>
              {Math.round(progress)}%
            </div>
            <div style={{ marginTop: 6, fontFamily: "var(--font-typewriter)", fontSize: 10, color: 'var(--accent-sage)', letterSpacing: '0.1em' }}>
              MEDGEMMA FIRST PASS + DOCTOR PERSONA
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes swapDoctorFloat {
          from { transform: translateY(0) rotate(-1deg); }
          to { transform: translateY(-6px) rotate(1deg); }
        }
        @keyframes swapScan {
          0% { transform: translateY(-8px); opacity: 0.35; }
          50% { opacity: 1; }
          100% { transform: translateY(24px); opacity: 0.35; }
        }
        @keyframes swapStethoscopePulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.16); }
        }
        .swap-doctor-animation {
          animation: swapDoctorFloat 0.9s ease-in-out infinite alternate;
          filter: drop-shadow(0 6px 10px rgba(62,31,13,0.16));
        }
        .swap-scan-line {
          animation: swapScan 1.15s linear infinite;
          transform-origin: center;
        }
        .swap-stethoscope {
          animation: swapStethoscopePulse 0.75s ease-in-out infinite;
          transform-origin: 82px 89px;
        }
      `}</style>
    </div>
  );
}

export function SwapPage() {
  const navigate = useNavigate();
  const { data, loading, error } = useCases({ is_valid: 'true' });
  const { data: sessionsData, loading: sessionsLoading, error: sessionsError } = useSwapSessions();
  const [startingCaseId, setStartingCaseId] = useState<string | null>(null);
  const [startProgress, setStartProgress] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null);
  const cases = data?.cases ?? [];
  const sessions = sessionsData?.results ?? sessionsData?.sessions ?? [];
  const startingCase = cases.find((c: any) => c.id === startingCaseId);

  const completedByCase = new Map<string, SwapSessionRow>();
  for (const s of sessions) {
    if (s.status !== 'COMPLETED') continue;
    const caseId = s.case_id ?? s.case;
    if (caseId && !completedByCase.has(caseId)) completedByCase.set(caseId, s);
  }
  const activeCompleted = activeCaseId ? completedByCase.get(activeCaseId) : null;
  const activeCase = activeCaseId ? cases.find((c: any) => c.id === activeCaseId) : null;

  useEffect(() => {
    if (!startingCaseId) return;

    setStartProgress(8);
    const progressTimer = window.setInterval(() => {
      // 88% in ~30 seconds (180ms * 166 ticks)
      setStartProgress(prev => (prev >= 99 ? prev : Math.min(prev + (90 / (30000 / 180)) + (Math.random() * 0.2), 99)));
    }, 180);

    return () => window.clearInterval(progressTimer);
  }, [startingCaseId]);

  const startSwap = async (caseId: string) => {
    setStartingCaseId(caseId);
    setStartProgress(0);
    setStartError(null);

    // Mock 30s loading
    await new Promise(r => setTimeout(r, 30000));

    const res = await apiClient.createSwapSession(caseId);
    if (res.error || !res.data?.id) {
      setStartingCaseId(null);
      setStartProgress(0);
      setStartError(res.error || 'Could not start swap session');
      return;
    }
    setStartProgress(100);
    window.setTimeout(() => navigate(`/swap/session/${res.data.id}`), 250);
  };

  return (
    <div
      style={{
        minHeight: '100%',
        backgroundColor: 'var(--bg-page)',
        backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.18) 31px, rgba(196,168,130,0.18) 32px)',
        backgroundSize: '100% 32px',
        padding: '32px',
      }}
    >
      {startingCaseId && (
        <SwapLoadingModal
          progress={startProgress}
          caseTitle={startingCase?.title}
        />
      )}

      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-sage)', fontFamily: "var(--font-typewriter)", fontSize: 12, letterSpacing: '0.12em' }}>
            <MessageSquare size={18} />
            SWAP DEBATE
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, color: 'var(--ink)', margin: '8px 0 4px' }}>
            Debate a difficult doctor
          </h1>
          <p style={{ fontFamily: "'Lora', serif", color: 'var(--ink-secondary)', fontSize: 14 }}>
            Pick a case, challenge the doctor's first impression, and persuade each diagnostic step.
          </p>
        </div>

        {(error || sessionsError || startError) && (
          <div style={{ border: '1px solid var(--accent-clay)', color: 'var(--accent-clay)', background: 'rgba(192,57,43,0.06)', padding: 12, marginBottom: 18, fontFamily: "'Lora', serif", fontSize: 13 }}>
            {error || sessionsError || startError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
          {loading || sessionsLoading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ height: 220, background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', opacity: 0.7 }} />
            ))
          ) : (
            cases.map((c: any, idx: number) => {
              const thumb = firstImageUrl(c);
              const isStarting = startingCaseId === c.id;
              const completed = completedByCase.get(c.id);
              const isDone = !!completed;
              const scorePct = completed?.final_score != null ? Math.round(completed.final_score * 100) : null;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    if (startingCaseId) return;
                    if (isDone) {
                      setActiveCaseId(c.id);
                    } else {
                      startSwap(c.id);
                    }
                  }}
                  disabled={!!startingCaseId}
                  style={{
                    position: 'relative',
                    textAlign: 'left',
                    background: isDone ? 'rgba(125,155,118,0.18)' : 'var(--bg-surface-alt)',
                    border: isDone ? '1px solid var(--accent-sage)' : '1px solid var(--border)',
                    padding: 14,
                    minHeight: 250,
                    cursor: startingCaseId ? 'wait' : 'pointer',
                    boxShadow: '0 3px 12px rgba(62,31,13,0.12)',
                  }}
                >
                  <SketchBorder id={`swap-case-${c.id}`} color={isDone ? 'var(--accent-sage)' : 'var(--ink-secondary)'} opacity={0.45} />
                  {isDone && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10, zIndex: 2,
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'var(--accent-sage)', color: 'var(--bg-page)',
                      padding: '3px 8px',
                      fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: '0.08em',
                    }}>
                      <CheckCircle2 size={12} />
                      {scorePct != null ? `${scorePct}%` : 'DONE'}
                    </div>
                  )}
                  <div style={{ aspectRatio: '4/3', background: '#2f3a42', marginBottom: 12, overflow: 'hidden', border: '1px solid rgba(62,31,13,0.35)' }}>
                    {thumb ? (
                      <img src={thumb} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(20%) contrast(1.05)' }} />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--bg-page)' }}>
                        <Stethoscope size={28} />
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: "var(--font-typewriter)", fontSize: 10, color: isDone ? 'var(--accent-sage)' : 'var(--accent-sage)', letterSpacing: '0.1em', marginBottom: 5 }}>
                    CASE #{String(idx + 1).padStart(3, '0')} / {c.modality}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: 'var(--ink)', lineHeight: 1.25 }}>
                    {c.title}
                  </div>
                  <div style={{ marginTop: 10, fontFamily: "'Lora', serif", fontSize: 12, color: 'var(--ink-secondary)', lineHeight: 1.45 }}>
                    {isStarting ? 'Preparing doctor...' : isDone ? 'Đã hoàn thành — bấm để xem lại' : 'Start debate'}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {activeCase && activeCompleted && (
        <div
          onClick={() => setActiveCaseId(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(44,24,16,0.65)',
            backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 60, padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-surface-alt)', border: '2px solid var(--accent-sage)',
              padding: '22px 26px', maxWidth: 460, width: '100%',
              boxShadow: '0 12px 40px rgba(44,24,16,0.3)',
              fontFamily: "'Lora', serif",
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <Trophy size={20} color="var(--accent-sage)" />
              <h3 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 22, color: 'var(--ink)' }}>
                Case đã hoàn thành
              </h3>
            </div>
            <p style={{ margin: '0 0 6px', color: 'var(--ink-secondary)', fontSize: 14 }}>
              {activeCase.title}
            </p>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: 'var(--accent-sage)', letterSpacing: '0.1em', marginBottom: 18,
            }}>
              MỨC ĐỘ THUYẾT PHỤC: {activeCompleted.final_score != null ? Math.round(activeCompleted.final_score * 100) : '—'}%
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveCaseId(null)}
                style={{
                  padding: '8px 14px', background: 'transparent',
                  border: '1px solid var(--border)', color: 'var(--ink-secondary)',
                  fontFamily: "var(--font-typewriter)", fontSize: 12, letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
              <button
                onClick={() => navigate(`/swap/session/${activeCompleted.id}`)}
                style={{
                  padding: '8px 14px', background: 'var(--bg-page)',
                  border: '1px solid var(--accent-sage)', color: 'var(--accent-sage)',
                  fontFamily: "var(--font-typewriter)", fontSize: 12, letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                Xem kết quả
              </button>
              <button
                onClick={() => {
                  const id = activeCaseId!;
                  setActiveCaseId(null);
                  startSwap(id);
                }}
                style={{
                  padding: '8px 14px', background: 'var(--accent-sage)', color: 'var(--bg-page)',
                  border: '1px solid #5C7A5A',
                  fontFamily: "var(--font-typewriter)", fontSize: 12, letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                Làm lại
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
