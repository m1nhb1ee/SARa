import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Home, ChevronRight, BookMarked, Save, ArrowRight, RotateCcw, Trophy } from 'lucide-react';
import { apiClient } from '@/api/client';
import { STEPS as STEP_CODES, STEP_LABELS } from '@/constants/training';
import { scoreColor } from '@/constants/styles';
import { VolumeSliceViewer } from '@/app/components/shared/VolumeSliceViewer';

// ─── Per-step visual metadata (design tokens only, no mock text) ───
const STEP_VISUAL_META: Array<{
  num: string;
  color: string;
  isFinal?: boolean;
}> = [
  { num: 'I',   color: '#1B3A5C' },
  { num: 'II',  color: '#1B5C4A' },
  { num: 'III', color: '#C9882A' },
  { num: 'IV',  color: '#C0392B' },
  { num: 'V',   color: '#5C3D2E' },
  { num: 'VI',  color: '#7D9B76', isFinal: true },
];

// ─── Composite step type used throughout the view ───
interface StepItem {
  code: string;
  num: string;
  name: string;
  color: string;
  isFinal?: boolean;
  // Answer-key content
  text: string;
  keyPoint: string;
  clinicalExplanation?: string;
  // Session-specific (null when isUploadView)
  feedback?: string;
  score?: number | null;
  // Conclusion-step extras
  diagnosis?: string;
  confidence?: number;
  differentials?: { text: string; checked: boolean }[];
}

// ────────────────────────────────────────────────────────────────
//  Shared UI helpers (verbatim from UploadPage)
// ────────────────────────────────────────────────────────────────

function WavyUnderline({ width = 220, color = '#2C1810', opacity = 0.45 }: {
  width?: number; color?: string; opacity?: number;
}) {
  const w = width;
  return (
    <svg height="8" width={w} style={{ display: 'block', marginTop: '2px' }}>
      <path
        d={`M0,5 C${w * 0.07},1 ${w * 0.15},8 ${w * 0.23},5 C${w * 0.31},1 ${w * 0.38},8 ${w * 0.46},5 C${w * 0.54},1 ${w * 0.62},8 ${w * 0.69},5 C${w * 0.77},1 ${w * 0.85},8 ${w * 0.92},5 C${w * 0.96},2 ${w},5 ${w},5`}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        opacity={opacity}
      />
    </svg>
  );
}

function ThumbTack({ color = '#C0392B' }: { color?: string }) {
  return (
    <svg width="16" height="22" viewBox="0 0 16 22">
      <circle cx="8" cy="5" r="4" fill={color} />
      <rect x="7" y="8" width="2" height="12" fill={color} opacity="0.7" rx="1" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────
//  StepCard — UploadPage design, real API data
// ────────────────────────────────────────────────────────────────

function StepCard({
  step,
  isUnlocked,
  isActive,
  onUnlock,
  isUploadView,
  totalSteps,
}: {
  step: StepItem;
  isUnlocked: boolean;
  isActive: boolean;
  onUnlock: () => void;
  isUploadView: boolean;
  totalSteps: number;
}) {
  const nextStepNum = STEP_VISUAL_META[
    STEP_VISUAL_META.findIndex(m => m.num === step.num) + 1
  ]?.num;

  return (
    <div
      className="mb-6 relative"
      style={{
        background: '#EDE0C4',
        borderLeft: `4px solid ${step.color}`,
        border: `1px solid rgba(196,168,130,0.6)`,
        borderLeftWidth: '4px',
        borderLeftColor: step.color,
        boxShadow: isActive
          ? '0 4px 16px rgba(62,31,13,0.15)'
          : '0 2px 6px rgba(62,31,13,0.08)',
        opacity: isUnlocked ? 1 : 0.4,
        transition: 'opacity 0.3s, box-shadow 0.3s',
        backgroundImage: isUnlocked
          ? 'repeating-linear-gradient(transparent, transparent 27px, rgba(196,168,130,0.18) 27px, rgba(196,168,130,0.18) 28px)'
          : 'none',
        backgroundPositionY: '32px',
      }}
    >
      {/* Step header */}
      <div className="px-6 pt-5 pb-3 flex items-center gap-3">
        <div
          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: step.color,
            color: '#F5EDD6',
            fontFamily: "'Special Elite', cursive",
            fontSize: '11px',
          }}
        >
          {step.num}
        </div>

        <div className="flex-1">
          <div
            style={{
              fontFamily: "'Special Elite', cursive",
              fontSize: '13px',
              letterSpacing: '0.12em',
              color: step.color,
            }}
          >
            STEP {step.num} — {step.name}
          </div>
          <WavyUnderline width={160} color={step.color} opacity={0.5} />
        </div>

        {/* Score badge (session mode only) */}
        {!isUploadView && step.score !== null && step.score !== undefined && (
          <div
            className="flex-shrink-0 px-2 py-0.5"
            style={{
              fontFamily: "'Special Elite', cursive",
              fontSize: '10px',
              letterSpacing: '0.08em',
              color: '#F5EDD6',
              background: scoreColor(step.score),
              transform: 'rotate(-1.5deg)',
            }}
          >
            {Math.round(step.score * 100)}%
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-6 pb-4">
        {/* Main answer text */}
        <p
          style={{
            fontFamily: "'Lora', serif",
            fontSize: '14.5px',
            color: '#2C1810',
            lineHeight: 1.85,
          }}
        >
          {step.text.split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </p>

        {/* Key point sticky note */}
        {step.keyPoint && (
          <div
            className="mt-5 p-4 relative"
            style={{
              background: '#FFF9C4',
              transform: 'rotate(-0.8deg)',
              boxShadow:
                '0 3px 10px rgba(62,31,13,0.14), inset 0 0 0 1px rgba(196,168,130,0.3)',
              maxWidth: '95%',
            }}
          >
            {/* Tape strip */}
            <div
              style={{
                position: 'absolute',
                top: '-7px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '40%',
                height: '14px',
                background: 'rgba(201,136,42,0.35)',
                borderRadius: '1px',
              }}
            />
            <div
              style={{
                fontFamily: "'Special Elite', cursive",
                fontSize: '10px',
                color: '#C9882A',
                letterSpacing: '0.1em',
                marginBottom: '4px',
              }}
            >
              💡 KEY POINT
            </div>
            <p
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: '14px',
                color: '#2C1810',
                lineHeight: 1.6,
              }}
            >
              "{step.keyPoint}"
            </p>
          </div>
        )}

        {/* Clinical explanation note (if separate from key point) */}
        {step.clinicalExplanation && step.clinicalExplanation !== step.keyPoint && (
          <div
            className="mt-4 p-3 relative"
            style={{
              background: 'rgba(27,58,92,0.05)',
              borderLeft: '3px solid #1B3A5C',
              maxWidth: '95%',
            }}
          >
            <p
              style={{
                fontFamily: "'Lora', serif",
                fontSize: '13px',
                color: '#1B3A5C',
                lineHeight: 1.65,
                fontStyle: 'italic',
              }}
            >
              {step.clinicalExplanation}
            </p>
          </div>
        )}

        {/* AI feedback note (session mode only) */}
        {!isUploadView && step.feedback && (
          <div
            className="mt-5 p-4 relative"
            style={{
              background: '#EDF6FF',
              transform: 'rotate(0.5deg)',
              boxShadow:
                '0 3px 10px rgba(27,58,92,0.12), inset 0 0 0 1px rgba(27,58,92,0.15)',
              maxWidth: '95%',
            }}
          >
            <div
              style={{
                position: 'absolute',
                top: '-7px',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '40%',
                height: '14px',
                background: 'rgba(27,58,92,0.25)',
                borderRadius: '1px',
              }}
            />
            <div
              style={{
                fontFamily: "'Special Elite', cursive",
                fontSize: '10px',
                color: '#1B3A5C',
                letterSpacing: '0.1em',
                marginBottom: '4px',
              }}
            >
              ✏️ YOUR FEEDBACK
            </div>
            <p
              style={{
                fontFamily: "'Lora', serif",
                fontSize: '16px',
                color: '#2C1810',
                lineHeight: 1.6,
              }}
            >
              {step.feedback}
            </p>
          </div>
        )}

        {/* ── CONCLUSION block (Step VI only) ── */}
        {step.isFinal && isUnlocked && (
          <div className="mt-6">
            {/* Diagnosis stamp */}
            <div
              className="mb-4 p-4 border-2"
              style={{ borderColor: '#7D9B76', background: 'rgba(125,155,118,0.06)' }}
            >
              <div
                style={{
                  fontFamily: "'Special Elite', cursive",
                  fontSize: '11px',
                  color: '#7D9B76',
                  letterSpacing: '0.15em',
                  marginBottom: '4px',
                }}
              >
                FINAL DIAGNOSIS
              </div>
              <div
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontSize: '20px',
                  color: '#2C1810',
                  fontWeight: 700,
                }}
              >
                {step.diagnosis}
              </div>
            </div>

            {/* Confidence thermometer (session mode only) */}
            {!isUploadView && step.confidence !== undefined && (
              <div className="flex items-end gap-4 mb-5">
                <div>
                  <svg width="32" height="110" viewBox="0 0 32 110">
                    <rect
                      x="12" y="4" width="8" height="76" rx="4"
                      fill="rgba(245,237,214,0.7)"
                      stroke="#C4A882"
                      strokeWidth="1.2"
                    />
                    <rect
                      x="13.5"
                      y={80 - step.confidence * 0.76}
                      width="5"
                      height={step.confidence * 0.76}
                      rx="2.5"
                      fill="#C0392B"
                      opacity="0.85"
                    />
                    <circle cx="16" cy="90" r="9" fill="#C0392B" opacity="0.85" stroke="#C4A882" strokeWidth="1" />
                    {[25, 50, 75, 100].map(pct => (
                      <line
                        key={pct}
                        x1="22" y1={80 - pct * 0.76}
                        x2="25" y2={80 - pct * 0.76}
                        stroke="#C4A882"
                        strokeWidth="0.8"
                      />
                    ))}
                  </svg>
                </div>
                <div>
                  <div
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: '12px',
                      color: '#6B4C3B',
                    }}
                  >
                    DIAGNOSTIC CONFIDENCE
                  </div>
                  <div
                    style={{
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: '28px',
                      color: '#C0392B',
                      fontWeight: 700,
                    }}
                  >
                    {step.confidence}%
                  </div>
                </div>
              </div>
            )}

            {/* Upload-view confidence placeholder */}
            {isUploadView && (
              <div
                className="mb-5 p-3"
                style={{
                  background: '#FFF9C4',
                  border: '1px dashed rgba(201,136,42,0.4)',
                  display: 'inline-block',
                }}
              >
                <p
                  style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: '13px',
                    color: '#6B4C3B',
                  }}
                >
                  Complete this case to unlock your diagnostic score →
                </p>
              </div>
            )}

            {/* Differentials checklist */}
            {step.differentials && step.differentials.length > 0 && (
              <div className="mb-4">
                <div
                  style={{
                    fontFamily: "'Special Elite', cursive",
                    fontSize: '11px',
                    color: '#6B4C3B',
                    letterSpacing: '0.1em',
                    marginBottom: '8px',
                  }}
                >
                  DIFFERENTIAL DIAGNOSES
                </div>
                {step.differentials.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <div
                      style={{
                        width: '16px',
                        height: '16px',
                        border: '1.5px solid #6B4C3B',
                        background: d.checked ? '#7D9B76' : 'transparent',
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {d.checked && (
                        <span style={{ color: '#F5EDD6', fontSize: '10px' }}>✓</span>
                      )}
                    </div>
                    <span
                      style={{
                        fontFamily: "'Caveat', cursive",
                        fontSize: '14.5px',
                        color: d.checked ? '#2C1810' : '#8B6355',
                        textDecoration: !d.checked ? 'line-through' : 'none',
                      }}
                    >
                      {d.text}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Unlock CTA */}
        {isUnlocked && !step.isFinal && (
          <button
            onClick={onUnlock}
            className="mt-5 px-5 py-2.5 transition-all active:translate-y-1"
            style={{
              background: step.color,
              color: '#F5EDD6',
              fontFamily: "'Special Elite', cursive",
              fontSize: '12px',
              letterSpacing: '0.08em',
              border: `1px solid rgba(0,0,0,0.2)`,
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              borderRadius: '2px',
            }}
          >
            ✓ Understood — Move to Step {nextStepNum} →
          </button>
        )}

        {!isUnlocked && (
          <div
            className="mt-4 text-sm"
            style={{
              fontFamily: "'Caveat', cursive",
              color: '#C4A882',
              fontSize: '14px',
            }}
          >
            Complete the previous step to unlock…
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
//  Main AnswerKey page
// ────────────────────────────────────────────────────────────────

export function AnswerKey() {
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId: string }>();

  // ── API state ──
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [caseData, setCaseData]         = useState<any>(null);
  const [answerKeyData, setAnswerKeyData] = useState<any>(null);
  const [sessionScore, setSessionScore] = useState<number | null>(null);
  const [isUploadView, setIsUploadView] = useState(false);

  // ── Step unlock state (UploadPage progressive-reveal mechanic) ──
  const [unlockedUntil, setUnlockedUntil] = useState(0);

  const handleUnlock = (idx: number) => {
    if (idx < STEP_VISUAL_META.length - 1) setUnlockedUntil(idx + 1);
  };

  // ── Data fetch (verbatim logic from AnswerKey.tsx) ──
  useEffect(() => {
    if (!caseId) return;

    const load = async () => {
      setLoading(true);

      // 1. Case detail
      const caseRes = await apiClient.getCaseDetail(caseId);
      if (caseRes.error) {
        setError('Không tìm thấy case.');
        setLoading(false);
        return;
      }
      setCaseData(caseRes.data);

      // 2. Latest completed session
      const API_BASE =
        import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const token = localStorage.getItem('sara_token') || '';
      const sessionRes = await fetch(
        `${API_BASE}/sessions/?case=${caseId}&status=COMPLETED`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!sessionRes.ok) {
        setError('Không tìm được session.');
        setLoading(false);
        return;
      }
      const sessionsJson = await sessionRes.json();
      const results: any[] = sessionsJson.results ?? sessionsJson;

      if (!results.length) {
        // No completed session → try upload view
        const uploadsRes = await apiClient.getUploadedCases();
        const uploadSession = (uploadsRes.data?.results ?? []).find(
          (u: any) => String(u.case_id) === caseId
        );
        if (uploadSession) {
          const findingsRes = await apiClient.getUploadedCaseFindings(
            uploadSession.id
          );
          if (!findingsRes.error && findingsRes.data) {
            const ansKey: Record<string, any> = {};
            for (const ak of findingsRes.data.answer_keys ?? []) {
              ansKey[ak.step_code] = {
                expected_finding:     ak.expected_finding,
                clinical_explanation: ak.clinical_explanation,
                key_points:           ak.key_points,
              };
            }
            setAnswerKeyData({ answer_key: ansKey, details: [], your_score: null });
            setIsUploadView(true);
            setLoading(false);
            return;
          }
        }
        setError('Chưa có session nào hoàn thành cho case này.');
        setLoading(false);
        return;
      }

      const latestSession = results[0];
      setSessionScore(latestSession.final_score);

      const keyRes = await apiClient.getAnswerKey(latestSession.id);
      if (keyRes.error) {
        setError('Không thể tải đáp án.');
        setLoading(false);
        return;
      }
      setAnswerKeyData(keyRes.data);
      setLoading(false);
    };

    load();
  }, [caseId]);

  // ── Derived values ──
  const details: any[]             = answerKeyData?.details   ?? [];
  const answerKey: Record<string, any> = answerKeyData?.answer_key ?? {};
  const finalScore: number         = sessionScore ?? answerKeyData?.your_score ?? 0;
  const finalScorePct: number      = Math.round(finalScore * 100);
  const caseImages: any[]          = caseData?.images ?? [];
  const legacyUrl: string          = caseData?.image_urls?.[0] ?? '';

  // Build visual step cards by merging STEP_CODES + API data
  const stepCards: StepItem[] = STEP_CODES.map((code: string, idx: number) => {
    const meta   = STEP_VISUAL_META[idx] ?? { num: String(idx + 1), color: '#6B4C3B' };
    const ansKey = answerKey[code];
    const detail = details.find((d: any) => d.step === code);

    const rawKeyPoint = Array.isArray(ansKey?.key_points)
      ? ansKey.key_points[0] ?? ''
      : (ansKey?.key_points ?? '');

    const differentials: { text: string; checked: boolean }[] =
      Array.isArray(ansKey?.key_points) && ansKey.key_points.length > 0
        ? ansKey.key_points.map((p: string, i: number) => ({
            text: p,
            checked: i === 0,
          }))
        : [];

    return {
      code,
      num:    meta.num,
      name:   (STEP_LABELS as Record<string, string>)?.[code] ?? code,
      color:  meta.color,
      isFinal: meta.isFinal,
      // Answer key content
      text:    ansKey?.expected_finding ?? '—',
      keyPoint: rawKeyPoint,
      clinicalExplanation: ansKey?.clinical_explanation,
      // Session data
      feedback: typeof detail?.feedback === 'string'
        ? detail.feedback
        : detail?.feedback?.content,
      score: detail?.score ?? null,
      // Conclusion extras
      ...(meta.isFinal && {
        diagnosis:    caseData?.title ?? ansKey?.expected_finding ?? '—',
        confidence:   isUploadView ? undefined : finalScorePct,
        differentials,
      }),
    };
  });

  // Case number display
  const caseLabel = caseId ? `#${String(caseId).padStart(4, '0')}` : '—';

  // ────────────────────────────────────────────────────────────────
  //  Loading state — UploadPage parchment aesthetic
  // ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#F5EDD6' }}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Hand-drawn spinner (SVG) */}
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
            style={{ animation: 'spin 1.2s linear infinite' }}>
            <circle cx="24" cy="24" r="20" stroke="#C4A882" strokeWidth="2" strokeDasharray="100 28" />
          </svg>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: '18px', color: '#6B4C3B', fontStyle: 'italic' }}>
            Developing your case…
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  //  Error state — UploadPage aesthetic
  // ────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: '#F5EDD6' }}
      >
        <div
          className="flex flex-col items-center gap-5 text-center p-10"
          style={{
            background: '#EDE0C4',
            border: '1px solid #C4A882',
            boxShadow: '0 4px 16px rgba(62,31,13,0.14)',
            maxWidth: '360px',
          }}
        >
          <div style={{ fontFamily: "'Special Elite', cursive", fontSize: '14px', color: '#C0392B', letterSpacing: '0.12em' }}>
            CASE NOT FOUND
          </div>
          <p style={{ fontFamily: "'Lora', serif", fontSize: '14px', color: '#2C1810', lineHeight: 1.7 }}>
            {error}
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2.5 transition-all active:translate-y-0.5"
            style={{
              fontFamily: "'Special Elite', cursive",
              fontSize: '13px',
              letterSpacing: '0.08em',
              background: '#C0392B',
              color: '#F5EDD6',
              border: '1px solid #A93226',
              borderRadius: '2px',
              boxShadow: '0 2px 6px rgba(192,57,43,0.25)',
            }}
          >
            ← Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  // ────────────────────────────────────────────────────────────────
  //  Main view (StepByStepView from UploadPage, real data)
  // ────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: '#F5EDD6', minHeight: '100vh' }}>

      {/* ── Page header ── */}
      <div
        className="px-8 py-4 flex justify-between items-center border-b sticky top-0 z-10"
        style={{
          background: '#F5EDD6',
          borderColor: '#C4A882',
          fontFamily: "'Courier Prime', monospace",
        }}
      >
        <div className="flex items-center gap-2 text-sm" style={{ color: '#6B4C3B' }}>
          <Home className="w-4 h-4" />
          <span
            className="cursor-pointer hover:underline"
            onClick={() => navigate('/')}
          >
            Home
          </span>
          <ChevronRight className="w-3 h-3" />
          <span
            className="cursor-pointer hover:underline"
            onClick={() => navigate(-1)}
          >
            Upload
          </span>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: '#2C1810' }}>
            {isUploadView ? 'AI Answer Key' : 'Case Study'} {caseLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Case stamp */}
          <div
            className="px-3 py-1 text-xs"
            style={{
              fontFamily: "'Special Elite', cursive",
              color: '#C0392B',
              border: '1.5px solid #C0392B',
              transform: 'rotate(-2deg)',
              opacity: 0.8,
            }}
          >
            CASE {caseLabel}
          </div>

          {/* Retry button (session mode only) */}
          {!isUploadView && (
            <button
              onClick={() => navigate(`/session/${caseId}`)}
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
              style={{
                fontFamily: "'Special Elite', cursive",
                fontSize: '11.5px',
                letterSpacing: '0.06em',
                color: '#6B4C3B',
              }}
            >
              <RotateCcw className="w-3 h-3" /> RETRY
            </button>
          )}

          <BookMarked className="w-4 h-4" style={{ color: '#C4A882' }} />
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="flex gap-0 h-[calc(100vh-57px)]">

        {/* ── LEFT COLUMN: Image + Meta + Step Spine ── */}
        <div
          className="w-[400px] flex-shrink-0 overflow-y-auto border-r p-6"
          style={{ borderColor: '#C4A882', background: '#F5EDD6' }}
        >
          {/* ── Scan image ── */}
          <div className="relative" style={{ marginBottom: '16px' }}>
            {/* Case stamp */}
            <div
              className="absolute top-2 left-2 z-10 px-2 py-0.5"
              style={{
                fontFamily: "'Special Elite', cursive",
                fontSize: '10px',
                color: '#F5EDD6',
                background: '#C0392B',
                letterSpacing: '0.1em',
              }}
            >
              CASE {caseLabel}
            </div>

            {/* Image with photo-corner mounts */}
            <div
              className="relative"
              style={{
                border: '1px solid #C4A882',
                padding: '4px',
                background: '#1a1a1a',
              }}
            >
              {/* Photo corners */}
              {[
                'linear-gradient(135deg, #2C1810 50%, transparent 50%)',
                'linear-gradient(225deg, #2C1810 50%, transparent 50%)',
                'linear-gradient(45deg,  #2C1810 50%, transparent 50%)',
                'linear-gradient(315deg, #2C1810 50%, transparent 50%)',
              ].map((bg, i) => (
                <div
                  key={i}
                  className="absolute w-4 h-4 z-10"
                  style={{
                    background: bg,
                    top:    i < 2 ? '1px' : undefined,
                    bottom: i >= 2 ? '1px' : undefined,
                    left:   i % 2 === 0 ? '1px' : undefined,
                    right:  i % 2 === 1 ? '1px' : undefined,
                  }}
                />
              ))}

              <VolumeSliceViewer
                images={caseImages}
                legacyUrl={legacyUrl}
                zoom={1}
              />

              {/* Annotation overlay — visible from step II onwards */}
              {unlockedUntil >= 1 && (
                <div className="absolute inset-0 pointer-events-none">
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '25%',
                      right: '20%',
                      width: '72px',
                      height: '60px',
                      border: '2px solid #C0392B',
                      borderRadius: '40% 45% 48% 40%',
                      transform: 'rotate(8deg)',
                      opacity: 0.75,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '27%',
                      right: '18%',
                      width: '18px',
                      height: '18px',
                      background: '#C0392B',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F5EDD6',
                      fontSize: '9px',
                      fontFamily: "'Special Elite', cursive",
                    }}
                  >
                    1
                  </div>
                </div>
              )}
            </div>

            {/* Caption */}
            <p
              className="mt-2 text-center"
              style={{
                fontFamily: "'Courier Prime', monospace",
                fontSize: '11px',
                color: '#6B4C3B',
              }}
            >
              Fig. 1 — {caseData?.modality ?? 'Medical Scan'} · Case {caseLabel}
            </p>
          </div>

          {/* ── Case meta strip ── */}
          <div
            className="p-4 border"
            style={{
              background: '#EDE0C4',
              borderColor: '#C4A882',
              marginBottom: '16px',
            }}
          >
            {[
              {
                label: 'PATIENT',
                value: caseData?.patient_info ?? caseData?.patient ?? 'Anonymous',
              },
              {
                label: 'DATE',
                value:
                  caseData?.study_date
                    ? new Date(caseData.study_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : caseData?.created_at
                    ? new Date(caseData.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : '—',
              },
              {
                label: 'VIEW',
                value: caseData?.view_position ?? caseData?.view ?? '—',
              },
              {
                label: 'MODALITY',
                value: caseData?.modality ?? '—',
              },
              {
                label: 'CASE',
                value: `${caseLabel} · ${caseData?.difficulty ?? '—'}`,
              },
            ].map(item => (
              <div key={item.label} className="flex items-baseline gap-2 mb-1.5">
                <span
                  style={{
                    fontFamily: "'Special Elite', cursive",
                    fontSize: '10px',
                    color: '#8B6355',
                    width: '68px',
                    flexShrink: 0,
                  }}
                >
                  {item.label}
                </span>
                <span
                  style={{
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: '10px',
                    color: '#C4A882',
                  }}
                >
                  ···
                </span>
                <span
                  style={{
                    fontFamily: "'Courier Prime', monospace",
                    fontSize: '11px',
                    color: '#2C1810',
                  }}
                >
                  {item.value}
                </span>
              </div>
            ))}

            {/* Difficulty badge */}
            {caseData?.difficulty && (
              <div
                className="mt-3 inline-block px-3 py-1"
                style={{
                  background: 'rgba(201,136,42,0.3)',
                  fontFamily: "'Special Elite', cursive",
                  fontSize: '9px',
                  color: '#5C3A10',
                  letterSpacing: '0.15em',
                  transform: 'rotate(-1deg)',
                }}
              >
                {String(caseData.difficulty).toUpperCase()}
              </div>
            )}

            {/* isUploadView note */}
            {isUploadView && (
              <div className="mt-3 flex items-start gap-1.5">
                <span
                  style={{
                    fontFamily: "'Caveat', cursive",
                    fontSize: '12px',
                    color: '#8B6355',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                  }}
                >
                  AI reference answer for your upload. Làm bài để nhận điểm thực.
                </span>
              </div>
            )}
          </div>

          {/* ── Step progress spine ── */}
          <div className="relative pl-6">
            <div
              className="absolute left-3 top-4 bottom-4 w-px"
              style={{ background: '#C4A882' }}
            />
            {stepCards.map((step, idx) => (
              <div key={idx} className="flex items-center gap-3 mb-5 relative">
                {/* Circle marker */}
                <div
                  className="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full z-10"
                  style={{
                    background: idx <= unlockedUntil ? step.color : 'transparent',
                    border:
                      idx <= unlockedUntil
                        ? 'none'
                        : `2px ${idx === unlockedUntil + 1 ? 'solid' : 'dashed'} rgba(196,168,130,0.6)`,
                    color: idx <= unlockedUntil ? '#F5EDD6' : '#C4A882',
                    fontFamily: "'Special Elite', cursive",
                    fontSize: '10px',
                    boxShadow:
                      idx === unlockedUntil
                        ? `0 0 0 3px ${step.color}33`
                        : 'none',
                  }}
                >
                  {idx <= unlockedUntil ? step.num : idx + 1}
                </div>

                <span
                  style={{
                    fontFamily: "'Special Elite', cursive",
                    fontSize: '10.5px',
                    color: idx <= unlockedUntil ? step.color : '#C4A882',
                    letterSpacing: '0.06em',
                  }}
                >
                  {step.name}
                </span>

                {/* Per-step score dot (session mode) */}
                {!isUploadView && step.score !== null && step.score !== undefined && (
                  <span
                    style={{
                      marginLeft: 'auto',
                      fontFamily: "'Courier Prime', monospace",
                      fontSize: '9px',
                      color: scoreColor(step.score),
                      fontWeight: 700,
                    }}
                  >
                    {Math.round(step.score * 100)}%
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Session overall score summary */}
          {!isUploadView && (
            <div
              className="mt-4 p-4 border"
              style={{
                background: '#EDE0C4',
                borderColor: '#C4A882',
              }}
            >
              <div
                style={{
                  fontFamily: "'Special Elite', cursive",
                  fontSize: '10px',
                  color: '#8B6355',
                  letterSpacing: '0.1em',
                  marginBottom: '6px',
                }}
              >
                OVERALL SCORE
              </div>
              <div
                style={{
                  fontFamily: "'Courier Prime', monospace",
                  fontSize: '28px',
                  color: scoreColor(finalScore),
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                {finalScorePct}
                <span
                  style={{
                    fontSize: '14px',
                    color: '#8B6355',
                    fontWeight: 400,
                    marginLeft: '2px',
                  }}
                >
                  /100
                </span>
              </div>
            </div>
          )}

          {/* Navigation arrows */}
          <div className="flex justify-between mt-4">
            <button
              className="text-sm hover:opacity-70"
              style={{
                fontFamily: "'Caveat', cursive",
                color: '#C0392B',
                fontSize: '15px',
              }}
              onClick={() => navigate(-1)}
            >
              ← Back
            </button>
            <button
              className="text-sm hover:opacity-70"
              style={{
                fontFamily: "'Caveat', cursive",
                color: '#C0392B',
                fontSize: '15px',
              }}
              onClick={() => navigate('/cases')}
            >
              All Cases →
            </button>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Step cards ── */}
        <div className="flex-1 overflow-y-auto px-8 py-6 pb-24">
          {/* Column header */}
          <div className="mb-8">
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: '1.6rem',
                color: '#2C1810',
                marginBottom: '4px',
              }}
            >
              {isUploadView ? 'AI Diagnostic Walkthrough' : 'Step-by-Step Answer Key'}
            </h2>
            <p
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: '15px',
                color: '#6B4C3B',
              }}
            >
              {isUploadView
                ? 'Follow each step as a senior radiologist would reason through this case'
                : 'Review the AIs full diagnostic reasoning alongside your session feedback'}
            </p>
            <WavyUnderline width={340} opacity={0.35} />
          </div>

          {/* Dr. AI sticky note */}
          <div className="mb-8 flex justify-center">
            <div
              className="relative max-w-xs p-4"
              style={{
                background: '#FFF9C4',
                transform: 'rotate(-0.5deg)',
                boxShadow: '0 2px 6px rgba(62,31,13,0.15)',
                border: '1px solid rgba(201,136,42,0.2)',
              }}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <ThumbTack />
              </div>
              <div
                style={{
                  fontFamily: "'Special Elite', cursive",
                  fontSize: '10px',
                  color: '#C0392B',
                  letterSpacing: '0.12em',
                  marginBottom: '5px',
                  marginTop: '4px',
                }}
              >
                Dr. AI's Notes
              </div>
              <p
                style={{
                  fontFamily: "'Caveat', cursive",
                  fontSize: '13px',
                  color: '#2C1810',
                  lineHeight: 1.65,
                }}
              >
                {isUploadView
                  ? <>6 diagnostic steps: <span style={{ color: '#1B3A5C' }}>OBSERVE</span> → <span style={{ color: '#1B5C4A' }}>DESCRIBE</span> → <span style={{ color: '#C9882A' }}>INTERPRET</span> → <span style={{ color: '#C0392B' }}>HYPOTHESIS</span> → <span style={{ color: '#5C3D2E' }}>DDx</span> → <span style={{ color: '#7D9B76' }}>CONCLUSION</span>. Click each step to unlock the next.</>
                  : <>AI Reference case — <span style={{ fontWeight: 600 }}>{caseData?.modality}</span>. Detected: {caseData?.title}. Confidence: <span style={{ color: '#C0392B' }}>{finalScorePct}%</span></>
                }
              </p>
            </div>
          </div>

          {/* Step cards */}
          {stepCards.map((step, idx) => (
            <StepCard
              key={step.code}
              step={step}
              isUnlocked={idx <= unlockedUntil}
              isActive={idx === unlockedUntil}
              onUnlock={() => handleUnlock(idx)}
              isUploadView={isUploadView}
              totalSteps={stepCards.length}
            />
          ))}

          {/* Bottom action bar — visible once all steps unlocked */}
          {unlockedUntil >= stepCards.length - 1 && (
            <div
              className="fixed bottom-0 left-[400px] right-0 flex items-center justify-between px-8 py-4 border-t z-20"
              style={{
                background: '#F5EDD6',
                borderColor: '#C4A882',
                boxShadow: '0 -4px 16px rgba(62,31,13,0.1)',
              }}
            >
              <button
                className="text-sm hover:underline"
                style={{
                  fontFamily: "'Caveat', cursive",
                  color: '#6B4C3B',
                  fontSize: '15px',
                }}
                onClick={() => navigate(`/session/${caseId}`)}
              >
                {isUploadView
                  ? 'Practice diagnosing this case yourself →'
                  : 'Try this case again →'}
              </button>

              <div className="flex items-center gap-3">
                <button
                  className="px-4 py-2 border flex items-center gap-2 hover:opacity-80 transition-opacity"
                  style={{
                    borderColor: '#7D9B76',
                    color: '#7D9B76',
                    fontFamily: "'Special Elite', cursive",
                    fontSize: '12px',
                    borderRadius: '2px',
                  }}
                  onClick={() => navigate('/performance')}
                >
                  <Trophy className="w-4 h-4" /> {isUploadView ? 'My Performance' : 'View Results'}
                </button>
                <button
                  className="px-6 py-2 flex items-center gap-2 hover:opacity-90 active:translate-y-px transition-all"
                  style={{
                    background: '#C0392B',
                    color: '#F5EDD6',
                    fontFamily: "'Special Elite', cursive",
                    fontSize: '12px',
                    letterSpacing: '0.06em',
                    borderRadius: '2px',
                    border: '1px solid #A93226',
                    boxShadow: '0 2px 6px rgba(192,57,43,0.3)',
                  }}
                  onClick={() => navigate('/cases')}
                >
                  Next Case <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}