import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { MessageSquare, Stethoscope } from 'lucide-react';
import { apiClient } from '@/api/client';
import { useCases } from '@/api/hooks';
import { SketchBorder } from '@/app/components/shared/SketchBorder';

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
            background: '#D4C4A0',
            borderLeft: '2px solid #C4A882',
            borderRight: '2px solid #C4A882',
            borderTop: '2px solid #C4A882',
            clipPath: 'polygon(0 0, 100% 0, 100% 76%, 94% 100%, 88% 73%, 80% 100%, 72% 73%, 64% 100%, 56% 73%, 50% 100%, 44% 73%, 36% 100%, 28% 73%, 20% 100%, 12% 73%, 5% 100%, 0 76%)',
            padding: '16px 24px 34px',
          }}
        >
          <div style={{ fontFamily: "'Special Elite', cursive", fontSize: 12, color: '#1B5C4A', letterSpacing: '0.12em' }}>
            SWAP DEBATE INTAKE
          </div>
        </div>

        <div
          style={{
            background: '#EDE0C4',
            border: '2px solid #C4A882',
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
                <rect x="13" y="23" width="45" height="64" rx="4" fill="#FAF3E3" stroke="#2C1810" strokeWidth="1.5" />
                <rect x="20" y="31" width="31" height="40" fill="#2F3A42" stroke="#1B3A5C" strokeWidth="1.5" />
                <path className="swap-scan-line" d="M22 43H49" stroke="#7D9B76" strokeWidth="2" strokeLinecap="round" />
                <path d="M25 59C30 51 34 64 39 55C42 50 45 57 48 53" stroke="#C4A882" strokeWidth="1.4" fill="none" />
                <circle cx="85" cy="32" r="16" fill="#E7C7A3" stroke="#2C1810" strokeWidth="1.5" />
                <path d="M70 30C73 18 84 13 95 19C100 22 102 28 101 34C93 27 82 30 70 30Z" fill="#5C3D2E" stroke="#2C1810" strokeWidth="1" />
                <circle cx="80" cy="34" r="1.6" fill="#2C1810" />
                <circle cx="92" cy="34" r="1.6" fill="#2C1810" />
                <path d="M81 43C86 46 91 45 95 42" stroke="#2C1810" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M62 111C64 73 71 56 85 56C99 56 107 73 110 111H62Z" fill="#FAF3E3" stroke="#2C1810" strokeWidth="1.5" />
                <path d="M84 57L78 111M88 57L95 111" stroke="#C4A882" strokeWidth="1.2" />
                <path d="M73 67C68 77 72 88 82 88C93 88 98 77 92 67" stroke="#1B5C4A" strokeWidth="2" strokeLinecap="round" />
                <circle className="swap-stethoscope" cx="82" cy="89" r="4" fill="#1B5C4A" stroke="#2C1810" strokeWidth="1" />
                <path d="M111 42L118 36M111 52H122M108 61L117 68" stroke="#C0392B" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              </svg>
            </div>

            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 23, color: '#2C1810', margin: '8px 0 4px', textAlign: 'center' }}>
              Calling the stubborn doctor
            </h2>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: 17, color: '#6B4C3B', fontStyle: 'italic', textAlign: 'center', marginBottom: 14 }}>
              {caseTitle ? `Preparing debate for ${caseTitle}` : 'Preparing debate room and first opinion'}
            </p>

            <div className="relative w-full max-w-sm">
              <svg viewBox="0 0 300 24" style={{ width: '100%', height: 24 }}>
                <path d="M2,12 C2,6 4,2 10,2 L290,2 C296,2 298,6 298,12 C298,18 296,22 290,22 L10,22 C4,22 2,18 2,12 Z"
                  fill="none" stroke="#C4A882" strokeWidth="1.5" />
                <rect x="4" y="4" width="292" height="16" rx="4" fill="#FAF3E3" />
                <rect
                  x="4"
                  y="4"
                  width={`${(Math.min(progress, 100) / 100) * 292}`}
                  height="16"
                  rx="4"
                  fill="#7D9B76"
                  opacity="0.78"
                  style={{ transition: 'width 0.16s ease' }}
                />
              </svg>
            </div>

            <div style={{ marginTop: 8, fontFamily: "'Courier Prime', monospace", fontSize: 20, color: '#2C1810', fontWeight: 700 }}>
              {Math.round(progress)}%
            </div>
            <div style={{ marginTop: 6, fontFamily: "'Special Elite', cursive", fontSize: 10, color: '#1B5C4A', letterSpacing: '0.1em' }}>
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
  const [startingCaseId, setStartingCaseId] = useState<string | null>(null);
  const [startProgress, setStartProgress] = useState(0);
  const [startError, setStartError] = useState<string | null>(null);
  const cases = data?.cases ?? [];
  const startingCase = cases.find((c: any) => c.id === startingCaseId);

  useEffect(() => {
    if (!startingCaseId) return;

    setStartProgress(8);
    const progressTimer = window.setInterval(() => {
      setStartProgress(prev => (prev >= 88 ? prev : Math.min(prev + Math.random() * 8 + 3, 88)));
    }, 180);

    return () => window.clearInterval(progressTimer);
  }, [startingCaseId]);

  const startSwap = async (caseId: string) => {
    setStartingCaseId(caseId);
    setStartProgress(0);
    setStartError(null);
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
        backgroundColor: '#F5EDD6',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#1B5C4A', fontFamily: "'Special Elite', cursive", fontSize: 12, letterSpacing: '0.12em' }}>
            <MessageSquare size={18} />
            SWAP DEBATE
          </div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, color: '#2C1810', margin: '8px 0 4px' }}>
            Debate a difficult doctor
          </h1>
          <p style={{ fontFamily: "'Lora', serif", color: '#6B4C3B', fontSize: 14 }}>
            Pick a case, challenge the doctor's first impression, and persuade each diagnostic step.
          </p>
        </div>

        {(error || startError) && (
          <div style={{ border: '1px solid #C0392B', color: '#A93226', background: 'rgba(192,57,43,0.06)', padding: 12, marginBottom: 18, fontFamily: "'Lora', serif", fontSize: 13 }}>
            {error || startError}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} style={{ height: 220, background: '#EDE0C4', border: '1px solid #C4A882', opacity: 0.7 }} />
            ))
          ) : (
            cases.map((c: any, idx: number) => {
              const thumb = firstImageUrl(c);
              const isStarting = startingCaseId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => startSwap(c.id)}
                  disabled={!!startingCaseId}
                  style={{
                    position: 'relative',
                    textAlign: 'left',
                    background: '#EDE0C4',
                    border: '1px solid #C4A882',
                    padding: 14,
                    minHeight: 250,
                    cursor: startingCaseId ? 'wait' : 'pointer',
                    boxShadow: '0 3px 12px rgba(62,31,13,0.12)',
                  }}
                >
                  <SketchBorder id={`swap-case-${c.id}`} color="#7A6248" opacity={0.45} />
                  <div style={{ aspectRatio: '4/3', background: '#2f3a42', marginBottom: 12, overflow: 'hidden', border: '1px solid rgba(62,31,13,0.35)' }}>
                    {thumb ? (
                      <img src={thumb} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(20%) contrast(1.05)' }} />
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F5EDD6' }}>
                        <Stethoscope size={28} />
                      </div>
                    )}
                  </div>
                  <div style={{ fontFamily: "'Special Elite', cursive", fontSize: 10, color: '#1B5C4A', letterSpacing: '0.1em', marginBottom: 5 }}>
                    CASE #{String(idx + 1).padStart(3, '0')} / {c.modality}
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: '#2C1810', lineHeight: 1.25 }}>
                    {c.title}
                  </div>
                  <div style={{ marginTop: 10, fontFamily: "'Lora', serif", fontSize: 12, color: '#6B4C3B', lineHeight: 1.45 }}>
                    {isStarting ? 'Preparing doctor...' : 'Start debate'}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
