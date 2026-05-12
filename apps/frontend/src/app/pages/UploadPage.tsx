import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Home, ChevronRight, BookOpen, Stethoscope, ArrowRight, BookMarked } from 'lucide-react';
import { useCreateSession } from '@/api/hooks';
import { SketchBorder } from '@/app/components/shared/SketchBorder';
import { useAuth } from '@/api/authContext';
import { engineForUser } from '@/constants/engineConfig';

const SCAN_TYPE_TO_MODALITY: Record<string, string> = {
  'X-Ray': 'XRAY',
  'CT Scan': 'CT',
  'MRI': 'MRI',
  'Other': 'ULTRASOUND',
};

const UPLOAD_MAX_IMAGES = Number(import.meta.env.VITE_UPLOAD_MAX_IMAGES ?? 20);

const RECENT_CASES = [
  {
    id: '#0247', name: 'Right lung consolidation – PA view',
    date: "14 Apr '26", modality: 'CHEST X-RAY',
    status: 'REVIEWED', statusColor: 'var(--accent-sage)',
    image: 'https://images.unsplash.com/photo-1584555684040-bad07f46a21f?w=400&q=80',
    rotation: -1.2,
    tapeColor: 'rgba(193,57,43,0.28)',
  },
  {
    id: '#0246', name: 'Brain MRI – Glioma evaluation',
    date: "13 Apr '26", modality: 'MRI BRAIN',
    status: 'PENDING', statusColor: 'var(--accent-ochre)',
    image: 'https://images.unsplash.com/photo-1758691463165-ca9b5bc2b28a?w=400&q=80',
    rotation: 1.5,
    tapeColor: 'rgba(27,58,92,0.3)',
  },
  {
    id: '#0245', name: 'CT Abdomen – liver lesion',
    date: "12 Apr '26", modality: 'CT SCAN',
    status: 'IN PROGRESS', statusColor: 'var(--accent-ink)',
    image: 'https://images.unsplash.com/photo-1666214280165-20e3d73d70bf?w=400&q=80',
    rotation: -0.6,
    tapeColor: 'rgba(125,155,118,0.3)',
  },
];

function WavyUnderline({ width = 220, color = 'var(--ink)', opacity = 0.45 }: { width?: number; color?: string; opacity?: number }) {
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

function IrregularDashedBorder({ active, dragging }: { active: boolean; dragging: boolean }) {
  const stroke = dragging ? 'var(--accent-clay)' : active ? 'var(--accent-sage)' : 'var(--border)';
  return (
    <svg
      viewBox="0 0 600 200"
      preserveAspectRatio="none"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <rect x="3" y="3" width="594" height="194" fill="none"
        stroke={stroke} strokeWidth="2"
        strokeDasharray="14 5 9 3 18 5 7 3 11 6"
        rx="2" />
    </svg>
  );
}

function FilmSlideIcon({ size = 44, color = 'var(--ink)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none">
      <rect x="4" y="6" width="36" height="32" rx="2" stroke={color} strokeWidth="1.8" fill="none" />
      <rect x="8" y="10" width="28" height="24" rx="1" stroke={color} strokeWidth="1.2" fill="none" />
      <rect x="4" y="10" width="4" height="4" rx="0.5" stroke={color} strokeWidth="1" fill={color} opacity="0.3" />
      <rect x="4" y="18" width="4" height="4" rx="0.5" stroke={color} strokeWidth="1" fill={color} opacity="0.3" />
      <rect x="4" y="26" width="4" height="4" rx="0.5" stroke={color} strokeWidth="1" fill={color} opacity="0.3" />
      <rect x="36" y="10" width="4" height="4" rx="0.5" stroke={color} strokeWidth="1" fill={color} opacity="0.3" />
      <rect x="36" y="18" width="4" height="4" rx="0.5" stroke={color} strokeWidth="1" fill={color} opacity="0.3" />
      <rect x="36" y="26" width="4" height="4" rx="0.5" stroke={color} strokeWidth="1" fill={color} opacity="0.3" />
      <path d="M16 22 L20 18 L24 22 L28 16" stroke={color} strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function ThumbTack({ color = 'var(--accent-clay)' }: { color?: string }) {
  return (
    <svg width="16" height="22" viewBox="0 0 16 22">
      <circle cx="8" cy="5" r="4" fill={color} />
      <rect x="7" y="8" width="2" height="12" fill={color} opacity="0.7" rx="1" />
    </svg>
  );
}

function PolaroidCard({ c }: { c: typeof RECENT_CASES[0] }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative cursor-pointer flex-1"
      style={{
        transform: hovered ? 'rotate(0deg) translateY(-4px)' : `rotate(${c.rotation}deg)`,
        transition: 'transform 0.25s ease',
        minWidth: '180px',
        maxWidth: '240px',
      }}
    >
      <div
        style={{
          position: 'absolute', top: '-9px', left: '50%',
          transform: `translateX(-50%) rotate(${c.rotation * 0.5}deg)`,
          width: '55%', height: '18px',
          background: c.tapeColor,
          zIndex: 2,
          borderRadius: '2px',
        }}
      />

      <div
        className="relative"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(196,168,130,0.5)',
          boxShadow: `0 ${hovered ? 8 : 4}px ${hovered ? 20 : 10}px rgba(62,31,13,0.18)`,
          padding: '10px 10px 16px',
          transition: 'box-shadow 0.25s',
        }}
      >
        <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', marginBottom: '10px', position: 'relative', background: '#4B5563' }}>
          <img
            src={c.image}
            alt={c.name}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              filter: 'sepia(40%) contrast(1.05) brightness(0.97)',
            }}
          />
        </div>

        <div style={{ fontFamily: "var(--font-mono)", fontSize: '10px', color: 'var(--ink)', lineHeight: 1.4, marginBottom: '6px' }}>
          {c.name}
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: '9.5px', color: 'var(--ink-secondary)' }}>
          {c.id} · {c.date}
        </div>

        <div className="mt-2 inline-block px-2 py-0.5"
          style={{
            background: c.statusColor, color: 'var(--bg-page)',
            fontFamily: "var(--font-typewriter)", fontSize: '9px',
            letterSpacing: '0.1em',
          }}>
          {c.status}
        </div>
      </div>
    </div>
  );
}

function UploadModal({ caseNum, onViewAnswer, onPractice, onClose, onSaveLater }: {
  caseNum: string; onViewAnswer: () => void; onPractice: () => void; onClose: () => void; onSaveLater: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: 'rgba(44,24,16,0.65)', backdropFilter: 'blur(2px)' }}
    >
      <div className="relative w-full max-w-[540px]" style={{ fontFamily: "'Lora', serif" }}>
        {/* Manila envelope top flap */}
        <div
          style={{
            background: 'var(--bg-surface-alt)',
            borderLeft: '2px solid var(--border)',
            borderRight: '2px solid var(--border)',
            borderTop: '2px solid var(--border)',
            clipPath: 'polygon(0 0, 100% 0, 100% 75%, 94% 100%, 88% 72%, 80% 100%, 72% 72%, 65% 100%, 57% 72%, 50% 100%, 43% 72%, 36% 100%, 28% 72%, 20% 100%, 12% 72%, 5% 100%, 0 75%)',
            padding: '16px 24px 36px',
            position: 'relative',
          }}
        >
          <div className="flex items-center gap-2">
            <div style={{
              fontFamily: "var(--font-typewriter)", fontSize: '13px',
              color: 'var(--accent-clay)', transform: 'rotate(-2deg)',
              border: '1px solid var(--accent-clay)', padding: '2px 8px',
              letterSpacing: '0.1em', opacity: 0.85,
            }}>
              CASE #{caseNum}
            </div>
            <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-clay)', opacity: 0.8 }} />
          </div>
        </div>

        {/* Modal card body */}
        <div
          style={{
            background: 'var(--bg-surface-alt)',
            border: '2px solid var(--border)',
            borderTop: 'none',
            padding: '24px 32px 28px',
            boxShadow: '0 12px 40px rgba(44,24,16,0.3)',
            position: 'relative',
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 hover:opacity-70 transition-opacity"
            style={{ fontFamily: "'Caveat', cursive", fontSize: '16px', color: 'var(--ink-secondary)' }}
          >
            ✕ Close
          </button>

          <h2 className="text-center mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '22px', color: 'var(--ink)' }}>
            Analysis Complete
          </h2>
          <WavyUnderline width={180} opacity={0.4} />
          <p className="text-center mt-3 mb-4" style={{ fontFamily: "'Lora', serif", fontSize: '14px', color: 'var(--ink-secondary)', fontStyle: 'italic' }}>
            Your scan has been processed. How would you like to proceed?
          </p>

          <div
            className="mx-auto mb-6 p-3 max-w-[340px]"
            style={{
              background: 'var(--bg-highlight)',
              transform: 'rotate(1deg)',
              boxShadow: '0 3px 10px rgba(62,31,13,0.14)',
            }}
          >
            <div style={{ fontFamily: "var(--font-typewriter)", fontSize: '10px', color: 'var(--accent-ochre)', marginBottom: '4px' }}>
              Dr. AI's Notes
            </div>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: '13px', color: 'var(--ink)', lineHeight: 1.55 }}>
              Image uploaded and AI analysis complete. 4 diagnostic steps generated.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div
              onClick={onViewAnswer}
              className="p-5 cursor-pointer hover:-translate-y-0.5 transition-all"
              style={{ background: 'var(--bg-page)', borderLeft: '3px solid var(--accent-ink)', border: '1px solid rgba(196,168,130,0.6)', borderLeftWidth: '3px', borderLeftColor: 'var(--accent-ink)', boxShadow: '0 2px 8px rgba(62,31,13,0.1)' }}
            >
              <BookOpen className="w-10 h-10 mb-3" style={{ color: 'var(--accent-ink)', opacity: 0.8 }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: 'var(--ink)', marginBottom: '6px' }}>
                View Step-by-Step Answer
              </div>
              <div className="w-full h-px mb-3" style={{ background: 'var(--border)', opacity: 0.4 }} />
              <p style={{ fontFamily: "'Lora', serif", fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.55, marginBottom: '12px' }}>
                Study the AI's full diagnostic reasoning across 4 steps
              </p>
              <button
                className="flex items-center gap-2 hover:gap-3 transition-all"
                style={{ fontFamily: "var(--font-typewriter)", fontSize: '12px', color: 'var(--accent-ink)', letterSpacing: '0.05em' }}
              >
                Read the Case <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div
              onClick={onPractice}
              className="p-5 cursor-pointer hover:-translate-y-0.5 transition-all"
              style={{ background: 'var(--bg-page)', borderLeft: '3px solid var(--accent-clay)', border: '1px solid rgba(196,168,130,0.6)', borderLeftWidth: '3px', borderLeftColor: 'var(--accent-clay)', boxShadow: '0 2px 8px rgba(62,31,13,0.1)' }}
            >
              <Stethoscope className="w-10 h-10 mb-3" style={{ color: 'var(--accent-clay)', opacity: 0.8 }} />
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: '15px', color: 'var(--ink)', marginBottom: '6px' }}>
                Practice Diagnosis
              </div>
              <div className="w-full h-px mb-3" style={{ background: 'var(--border)', opacity: 0.4 }} />
              <p style={{ fontFamily: "'Lora', serif", fontSize: '12.5px', color: 'var(--ink-secondary)', lineHeight: 1.55, marginBottom: '12px' }}>
                Test your skills before seeing the AI's analysis
              </p>
              <button
                className="flex items-center gap-2 hover:gap-3 transition-all"
                style={{ fontFamily: "var(--font-typewriter)", fontSize: '12px', color: 'var(--accent-clay)', letterSpacing: '0.05em' }}
              >
                Start Practice <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="text-center">
            <span style={{ fontFamily: "'Caveat', cursive", fontSize: '14px', color: 'var(--ink-secondary)' }}>Or save for later — </span>
            <button onClick={onSaveLater}
              className="hover:opacity-70 transition-opacity underline"
              style={{ fontFamily: "'Caveat', cursive", fontSize: '14px', color: 'var(--ink-secondary)' }}>
              Add to My Cases without starting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UploadPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createSession } = useCreateSession();

  const [dragState, setDragState] = useState<'idle' | 'dragging' | 'uploading' | 'attached'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [volumeNames, setVolumeNames] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<{ errorType: string; issues: string[] } | null>(null);
  const [region, setRegion] = useState('unspecified');
  const [clinicalHistory, setClinicalHistory] = useState('');
  const [caseName, setCaseName] = useState('');
  const [scanType, setScanType] = useState('X-Ray');
  const [showModal, setShowModal] = useState(false);
  const [caseNum, setCaseNum] = useState('');
  const [uploadedCaseId, setUploadedCaseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const progressInterval = useRef<number | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragState !== 'uploading') setDragState('dragging');
  }, [dragState]);

  const handleDragLeave = useCallback(() => {
    if (dragState === 'dragging') setDragState('idle');
  }, [dragState]);

  const appendSelectedFiles = (files: File[]) => {
    const availableSlots = Math.max(UPLOAD_MAX_IMAGES - selectedFiles.length, 0);
    if (files.length > availableSlots) {
      setUploadError({
        errorType: 'too_many_images',
        issues: [`Upload tối đa ${UPLOAD_MAX_IMAGES} ảnh cho mỗi case. Hãy chọn các lát cắt đại diện nhất.`],
      });
    }

    const acceptedFiles = files.slice(0, availableSlots);
    if (!acceptedFiles.length) return;

    setSelectedFiles(prev => [...prev, ...acceptedFiles]);
    setVolumeNames(prev => [...prev, ...acceptedFiles.map(() => 'Default')]);
    setDragState('attached');
    if (files.length <= availableSlots) setUploadError(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length) appendSelectedFiles(files);
  }, [selectedFiles.length]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter(f => f.type.startsWith('image/'));
    if (files.length) appendSelectedFiles(files);
    e.target.value = '';
  };

  const handleRemoveFile = (i: number) => {
    const newFiles = selectedFiles.filter((_, idx) => idx !== i);
    setSelectedFiles(newFiles);
    setVolumeNames(prev => prev.filter((_, idx) => idx !== i));
    if (newFiles.length === 0) { setDragState('idle'); setUploadProgress(0); }
  };

  const handleVolumeNameChange = (i: number, name: string) => {
    setVolumeNames(prev => prev.map((v, idx) => idx === i ? name : v));
  };

  const handleSubmit = async () => {
    if (selectedFiles.length === 0 || !caseName.trim()) return;
    setDragState('uploading');
    setUploadProgress(0);

    let p = 0;
    progressInterval.current = window.setInterval(() => {
      p = Math.min(p + Math.random() * 12 + 4, 89);
      setUploadProgress(p);
    }, 180);

    try {
      const modality = SCAN_TYPE_TO_MODALITY[scanType] ?? 'XRAY';
      const formData = new FormData();
      selectedFiles.forEach((file, i) => {
        formData.append('images', file);
        formData.append('slice_indexes', String(i));
        formData.append('volume_names', volumeNames[i] || 'Default');
      });
      formData.append('title', caseName);
      formData.append('modality', modality);
      formData.append('region', region);
      formData.append('clinical_history', clinicalHistory.trim());
      formData.append('engine', engineForUser(user?.is_premium ?? false));

      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
      const token = localStorage.getItem('sara_token') || '';
      const response = await fetch(`${API_BASE}/uploaded-cases/`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (progressInterval.current) { clearInterval(progressInterval.current); progressInterval.current = null; }

      if (response.ok) {
        const data = await response.json();
        setUploadProgress(100);

        const caseId = data.case?.id;
        if (caseId) {
          setUploadedCaseId(caseId);
          await createSession(caseId).catch(() => null);
        }

        const n = String(Math.floor(Math.random() * 300 + 100)).padStart(4, '0');
        setCaseNum(n);
        setTimeout(() => { setDragState('attached'); setShowModal(true); }, 600);
      } else if (response.status === 422 || response.status === 400) {
        const data = await response.json();
        setUploadError({
          errorType: data.error_type ?? data.error ?? 'unknown',
          issues: data.issues ?? [data.message ?? data.error ?? 'Upload failed'],
        });
        setDragState('attached');
      } else {
        setDragState('idle');
      }
    } catch {
      if (progressInterval.current) { clearInterval(progressInterval.current); progressInterval.current = null; }
      setDragState('idle');
    }
  };

  useEffect(() => () => { if (progressInterval.current) clearInterval(progressInterval.current); }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canSubmit = dragState === 'attached' && selectedFiles.length > 0 && caseName.trim().length > 0;

  return (
    <div style={{
      minHeight: '100%',
      backgroundColor: 'var(--bg-page)',
      backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.18) 31px, rgba(196,168,130,0.18) 32px)',
      backgroundSize: '100% 32px',
    }}>
      {showModal && (
        <UploadModal
          caseNum={caseNum}
          onViewAnswer={() => { setShowModal(false); if (uploadedCaseId) navigate(`/answer-key/${uploadedCaseId}`); }}
          onPractice={() => { setShowModal(false); if (uploadedCaseId) navigate(`/session/${uploadedCaseId}`); }}
          onClose={() => setShowModal(false)}
          onSaveLater={() => { setShowModal(false); navigate('/cases'); }}
        />
      )}

      {/* ── Page Header ── */}
      <div className="px-8 py-4 flex justify-between items-center border-b sticky top-0 z-10"
        style={{ background: 'var(--bg-page)', borderColor: 'var(--border)', fontFamily: "var(--font-mono)" }}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink-secondary)' }}>
          <Home className="w-4 h-4" />
          <span>Home</span>
          <ChevronRight className="w-3 h-3" />
          <span style={{ color: 'var(--ink)' }}>Upload New Case</span>
        </div>
        <BookMarked className="w-4 h-4" style={{ color: 'var(--border)' }} />
      </div>

      <div className="max-w-[820px] mx-auto px-8 py-8">
        {/* Page title */}
        <div className="mb-8">
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: '28px', color: 'var(--ink)', marginBottom: '4px' }}>
            Upload a Medical Image
          </h1>
          <WavyUnderline width={260} />
          <p className="mt-3" style={{ fontFamily: "'Lora', serif", fontSize: '15px', color: 'var(--ink-secondary)', fontStyle: 'italic' }}>
            Submit a scan for AI analysis and begin your case study.
          </p>
        </div>

        {/* ── CASE INTAKE FORM CARD ── */}
        <div
          className="relative overflow-hidden mb-10"
          style={{
            background: 'var(--bg-surface-alt)',
            border: '1px solid var(--border)',
            boxShadow: '0 3px 12px rgba(62,31,13,0.14)',
            padding: '40px',
          }}
        >
          {/* Corner fold */}
          <SketchBorder id="prof-dossier" color="var(--ink-secondary)" opacity={0.5} />
          <div className="absolute top-0 right-0 w-14 h-14"
            style={{ background: 'linear-gradient(135deg, transparent 50%, var(--border) 50%)' }} />
          <div className="absolute top-0 right-0"
            style={{ background: 'linear-gradient(135deg, transparent 50%, #D4C4A0 50%)', width: '52px', height: '52px' }} />

          {/* CASE INTAKE FORM watermark */}
          <div
            className="absolute top-1/2 left-1/2 pointer-events-none select-none"
            style={{
              fontFamily: "var(--font-typewriter)",
              fontSize: '52px',
              color: 'var(--accent-clay)',
              opacity: 0.055,
              transform: 'translate(-50%, -50%) rotate(-3deg)',
              whiteSpace: 'nowrap',
              letterSpacing: '0.06em',
            }}
          >
            CASE INTAKE FORM
          </div>

          {/* ── DROP ZONE ── */}
          <div className="mb-8 relative">
            {dragState === 'uploading' ? (
              <div className="relative p-8 flex flex-col items-center justify-center"
                style={{ minHeight: '180px', background: 'var(--bg-page)' }}>
                <IrregularDashedBorder active={true} dragging={false} />
                <div className="mb-4" style={{ fontFamily: "'Caveat', cursive", fontSize: '18px', color: 'var(--ink)', fontStyle: 'italic' }}>
                  Developing your film…
                </div>
                <div className="relative w-full max-w-xs">
                  <svg viewBox="0 0 300 24" style={{ width: '100%', height: '24px' }}>
                    <path d="M2,12 C2,6 4,2 10,2 L290,2 C296,2 298,6 298,12 C298,18 296,22 290,22 L10,22 C4,22 2,18 2,12 Z"
                      fill="none" stroke="var(--border)" strokeWidth="1.5" />
                    <rect x="4" y="4" width="292" height="16" rx="4" fill="var(--bg-surface-alt)" />
                    <rect x="4" y="4" width={`${(uploadProgress / 100) * 292}`} height="16" rx="4"
                      fill="var(--accent-sage)" opacity="0.75"
                      style={{ transition: 'width 0.15s ease' }}
                    />
                  </svg>
                </div>
                <div className="mt-2" style={{ fontFamily: "var(--font-mono)", fontSize: '20px', color: 'var(--ink)', fontWeight: 700 }}>
                  {Math.round(uploadProgress)}%
                </div>
              </div>
            ) : dragState === 'attached' && selectedFiles.length > 0 ? (
              <div className="relative"
                style={{ background: 'var(--bg-page)', border: '1px solid var(--border)' }}>
                <IrregularDashedBorder active={true} dragging={false} />
                <div style={{ padding: '8px 12px 4px', fontFamily: "var(--font-typewriter)", fontSize: '10px', color: 'var(--ink-secondary)', letterSpacing: '0.1em' }}>
                  {selectedFiles.length} FILM{selectedFiles.length > 1 ? 'S' : ''} SELECTED
                </div>
                {selectedFiles.map((file, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2"
                    style={{ borderTop: i > 0 ? '1px solid rgba(196,168,130,0.4)' : undefined }}>
                    <div className="flex-shrink-0 flex items-center justify-center"
                      style={{ width: 36, height: 36, background: 'var(--border-strong)', border: '1px solid var(--ink-secondary)' }}>
                      <FilmSlideIcon size={22} color="var(--ink-secondary)" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: '12px', color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: '10px', color: 'var(--ink-secondary)' }}>{formatSize(file.size)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontFamily: "var(--font-typewriter)", fontSize: '9px', color: 'var(--ink-secondary)', letterSpacing: '0.08em' }}>VOL:</span>
                      <input
                        type="text"
                        value={volumeNames[i] ?? 'Default'}
                        onChange={e => handleVolumeNameChange(i, e.target.value)}
                        style={{
                          width: 90,
                          fontFamily: "var(--font-typewriter)",
                          fontSize: '11px',
                          color: 'var(--ink)',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid var(--border)',
                          outline: 'none',
                          padding: '1px 2px',
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    </div>
                    <button onClick={() => handleRemoveFile(i)}
                      className="hover:opacity-70 transition-opacity flex-shrink-0"
                      style={{ fontFamily: "'Caveat', cursive", fontSize: '13px', color: 'var(--accent-clay)' }}>
                      ✕
                    </button>
                  </div>
                ))}
                <div style={{ padding: '6px 12px 10px' }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      fontFamily: "var(--font-typewriter)",
                      fontSize: '11px',
                      color: 'var(--accent-sage)',
                      letterSpacing: '0.06em',
                      background: 'none',
                      border: '1px dashed var(--accent-sage)',
                      padding: '4px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    + Thêm ảnh khác
                  </button>
                </div>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="relative flex flex-col items-center justify-center cursor-pointer"
                style={{
                  minHeight: '200px',
                  background: dragState === 'dragging' ? 'rgba(255,253,231,0.9)' : 'var(--bg-page)',
                  padding: '40px',
                  transition: 'background 0.15s',
                }}
              >
                <IrregularDashedBorder active={false} dragging={dragState === 'dragging'} />

                <div style={{
                  animation: dragState === 'dragging' ? 'bounce 0.4s ease infinite alternate' : 'none',
                }}>
                  <FilmSlideIcon size={44} color={dragState === 'dragging' ? 'var(--accent-clay)' : 'var(--ink)'} />
                </div>

                {dragState === 'dragging' ? (
                  <div className="mt-4" style={{ fontFamily: "'Caveat', cursive", fontSize: '20px', color: 'var(--accent-clay)', fontStyle: 'italic' }}>
                    Release to upload!
                  </div>
                ) : (
                  <>
                    <div className="mt-4" style={{ fontFamily: "'Playfair Display', serif", fontSize: '16px', color: 'var(--ink)' }}>
                      Drop your scan here
                    </div>
                    <div className="mt-1" style={{ fontFamily: "'Lora', serif", fontSize: '13px', color: 'var(--ink-secondary)' }}>
                      or click to browse files
                    </div>
                    <div className="mt-2" style={{ fontFamily: "var(--font-mono)", fontSize: '11px', color: 'var(--ink-secondary)' }}>
                      PNG · JPG · GIF · WEBP — max {UPLOAD_MAX_IMAGES} images
                    </div>
                  </>
                )}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          
          {/* ── VALIDATION ERROR BANNER ── */}
          {uploadError && (
            <div className="mb-6 relative z-10"
              style={{ border: '1.5px solid var(--accent-clay)', background: 'rgba(192,57,43,0.06)', padding: '14px 16px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <span style={{ fontFamily: "var(--font-typewriter)", fontSize: '11px', letterSpacing: '0.1em', color: 'var(--accent-clay)' }}>
                  {uploadError.errorType === 'not_medical'
                    ? '⚠ ẢNH KHÔNG HỢP LỆ'
                    : '⚠ ẢNH KHÔNG NHẤT QUÁN'}
                </span>
                <button
                  onClick={() => setUploadError(null)}
                  style={{ fontFamily: "var(--font-mono)", fontSize: '13px', color: 'var(--accent-clay)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
              <ul style={{ margin: 0, padding: '0 0 0 14px' }}>
                {uploadError.issues.map((issue, i) => (
                  <li key={i} style={{ fontFamily: "'Lora', serif", fontSize: '13px', color: 'var(--ink)', lineHeight: 1.6 }}>
                    {issue}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Faint ruled line overlay */}
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'repeating-linear-gradient(transparent, transparent 27px, rgba(196,168,130,0.13) 27px, rgba(196,168,130,0.13) 28px)',
            backgroundPositionY: '68px',
          }} />

          {/* ── CASE NAME field ── */}
          <div className="mb-7 relative z-10">
            <label style={{ fontFamily: "var(--font-typewriter)", fontSize: '11.5px', color: 'var(--ink-secondary)', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
              CASE NAME
            </label>
            <input
              type="text"
              value={caseName}
              onChange={e => setCaseName(e.target.value)}
              placeholder="e.g. Right lung consolidation – PA view"
              className="w-full bg-transparent focus:outline-none pb-2 placeholder:italic"
              style={{
                fontFamily: "'Lora', serif",
                fontSize: '15px',
                color: 'var(--ink)',
                borderBottom: '1px solid var(--border)',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.target.style.borderBottomColor = 'var(--accent-clay)'; e.target.style.borderBottomWidth = '2px'; }}
              onBlur={e => { e.target.style.borderBottomColor = 'var(--border)'; e.target.style.borderBottomWidth = '1px'; }}
            />
          </div>

          {/* ── SCAN TYPE tabs ── */}
          <div className="mb-8 relative z-10">
            <label style={{ fontFamily: "var(--font-typewriter)", fontSize: '11.5px', color: 'var(--ink-secondary)', letterSpacing: '0.1em', display: 'block', marginBottom: '10px' }}>
              SCAN TYPE
            </label>
            <div className="flex gap-2 flex-wrap">
              {['X-Ray', 'CT Scan', 'MRI', 'Other'].map(type => {
                const selected = scanType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setScanType(type)}
                    className="px-5 py-2 transition-all"
                    style={{
                      fontFamily: "var(--font-typewriter)",
                      fontSize: '12.5px',
                      letterSpacing: '0.05em',
                      background: selected ? 'var(--bg-surface)' : 'var(--bg-surface-alt)',
                      color: selected ? 'var(--accent-clay)' : 'var(--ink-secondary)',
                      border: `1px solid ${selected ? 'var(--accent-clay)' : 'var(--border)'}`,
                      borderRadius: '3px 3px 0 0',
                      borderBottom: selected ? '2px solid var(--accent-clay)' : '1px solid var(--border)',
                      transform: selected ? 'translateY(-2px)' : 'none',
                      boxShadow: selected ? '0 -2px 6px rgba(62,31,13,0.1)' : 'none',
                    }}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── REGION tabs ── */}
          <div className="mb-8 relative z-10">
            <label style={{ fontFamily: "var(--font-typewriter)", fontSize: '11.5px', color: 'var(--ink-secondary)', letterSpacing: '0.1em', display: 'block', marginBottom: '10px' }}>
              REGION (tuỳ chọn)
            </label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: 'Ngực', value: 'chest' },
                { label: 'Não', value: 'brain' },
                { label: 'Cột sống', value: 'spine' },
                { label: 'Bụng', value: 'abdomen' },
                { label: 'Chi trên', value: 'upper_limb' },
                { label: 'Chi dưới', value: 'lower_limb' },
                { label: 'Không xác định', value: 'unspecified' },
              ].map(({ label, value }) => {
                const selected = region === value;
                return (
                  <button
                    key={value}
                    onClick={() => setRegion(value)}
                    className="px-4 py-1.5 transition-all"
                    style={{
                      fontFamily: "var(--font-typewriter)",
                      fontSize: '11.5px',
                      letterSpacing: '0.04em',
                      background: selected ? 'rgba(29,58,92,0.1)' : 'var(--bg-surface-alt)',
                      color: selected ? 'var(--accent-ink)' : 'var(--ink-secondary)',
                      border: `1px solid ${selected ? 'var(--accent-ink)' : 'var(--border)'}`,
                      borderRadius: '2px',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-8 relative z-10">
            <label style={{ fontFamily: "var(--font-typewriter)", fontSize: '11.5px', color: 'var(--ink-secondary)', letterSpacing: '0.1em', display: 'block', marginBottom: '8px' }}>
              CLINICAL HISTORY (OPTIONAL)
            </label>
            <textarea
              value={clinicalHistory}
              onChange={e => setClinicalHistory(e.target.value)}
              placeholder="Nhập bệnh án ngắn gọn của bệnh nhân (tuổi, giới tính, triệu chứng, bệnh nền, thời gian khởi phát...)"
              rows={4}
              className="w-full bg-transparent focus:outline-none placeholder:italic"
              style={{
                fontFamily: "'Lora', serif",
                fontSize: '14px',
                color: 'var(--ink)',
                border: '1px solid var(--border)',
                padding: '10px 12px',
                resize: 'vertical',
              }}
            />
          </div>

          {/* ── THUMBTACK INFO NOTE ── */}
          <div className="mb-8 flex justify-center relative z-10">
            <div
              className="relative max-w-xs p-4"
              style={{
                background: 'var(--bg-highlight)',
                transform: 'rotate(-0.5deg)',
                boxShadow: '0 2px 6px rgba(62,31,13,0.15)',
                border: '1px solid rgba(201,136,42,0.2)',
              }}
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <ThumbTack />
              </div>
              <div style={{ fontFamily: "var(--font-typewriter)", fontSize: '10px', color: 'var(--accent-clay)', letterSpacing: '0.12em', marginBottom: '5px', marginTop: '4px' }}>
                Dr. AI's Notes
              </div>
              <p style={{ fontFamily: "'Caveat', cursive", fontSize: '13px', color: 'var(--ink)', lineHeight: 1.65 }}>
                AI will analyse your image and generate 4 diagnostic steps:{' '}
                <span style={{ color: 'var(--accent-ink)' }}>DESCRIBE</span> →{' '}
                <span style={{ color: 'var(--accent-ochre)' }}>REASONING</span> →{' '}
                <span style={{ color: '#5C3D2E' }}>DDx</span> →{' '}
                <span style={{ color: 'var(--accent-sage)' }}>CONCLUSION</span>
              </p>
            </div>
          </div>
              
          {/* ── SUBMIT BUTTON ── */}
          <div className="relative z-10">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2 transition-all active:translate-y-1"
              style={{
                height: '52px',
                fontFamily: "var(--font-typewriter)",
                fontSize: '15px',
                letterSpacing: '0.10em',
                background: canSubmit ? 'var(--accent-clay)' : 'var(--border)',
                color: 'var(--bg-page)',
                border: `1px solid ${canSubmit ? 'var(--accent-clay)' : '#B09070'}`,
                borderRadius: '3px',
                boxShadow: canSubmit ? '0 2px 8px rgba(192,57,43,0.25), inset 0 1px 0 rgba(255,255,255,0.08)' : 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                opacity: canSubmit ? 1 : 0.5,
                transition: 'all 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 12V4M4 8L8 4L12 8" stroke="var(--bg-page)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Upload &amp; Begin Case Study
            </button>
          </div>
        </div>

        {/* ── RECENT CASES (Polaroids) ── */}
        <div>
          <div className="mb-5">
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', color: 'var(--ink)' }}>
              Recent Cases
            </h2>
            <p style={{ fontFamily: "'Caveat', cursive", fontSize: '15px', color: 'var(--ink-secondary)', marginTop: '2px' }}>
              Pick up where you left off
            </p>
          </div>

          <div
            className="p-8 flex gap-6 justify-center flex-wrap"
            style={{
              background: 'rgba(139,99,85,0.08)',
              border: '1px solid rgba(196,168,130,0.3)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.5' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
            }}
          >
            {RECENT_CASES.map(c => (
              <PolaroidCard key={c.id} c={c} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          from { transform: translateY(0); }
          to { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
