/**
 * CaseListPage - Redesigned
 * - Tab "Thư Viện": hoàn toàn theo format Dashboard (filter bar + card grid)
 * - Tab "Upload": thiết kế sạch nhất quán với Dashboard
 * - Tab "Thực Hành": hoàn toàn theo DiagnosisSession (split layout + chat + modals)
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  useCases,
  useCaseDetail,
  useCreateSession,
  useSessionDetail,
  useSubmitAnswer,
} from '@/api/hooks';
import {
  CheckCircle2,
  Clock,
  PlayCircle,
  RefreshCw,
  Layers,
  Upload,
  Lightbulb,
  BookOpen,
  FileUp,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Send,
  X,
  ChevronRight,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION'];

type Status = 'Chưa làm' | 'Đang làm' | 'Hoàn thành';
type Difficulty = 'Cơ bản' | 'Trung bình' | 'Nặng cao';
type Modality = 'X-Ray' | 'CT' | 'MRI';
type ViewMode = 'library' | 'upload' | 'training';

// ─── Mapping helpers (same as Dashboard) ─────────────────────────────────────

const mapModality = (m: string): Modality =>
  ({ XRAY: 'X-Ray', CT: 'CT', MRI: 'MRI' } as Record<string, Modality>)[m] ?? 'X-Ray';

const mapDifficulty = (d: string): Difficulty =>
  ({ BASIC: 'Cơ bản', INTERMEDIATE: 'Trung bình', ADVANCED: 'Nặng cao' } as Record<string, Difficulty>)[d] ?? 'Cơ bản';

const getImageKey = (m: string): string =>
  ({ XRAY: 'body', CT: 'ct', MRI: 'head' } as Record<string, string>)[m] ?? 'body';

// ─── Style maps (same as Dashboard) ──────────────────────────────────────────

const difficultyStyle: Record<Difficulty, { bg: string; color: string }> = {
  'Cơ bản':   { bg: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' },
  'Trung bình': { bg: 'color-mix(in srgb, var(--warning) 15%, transparent)', color: 'var(--warning)' },
  'Nặng cao': { bg: 'color-mix(in srgb, var(--error) 15%, transparent)',   color: 'var(--error)' },
};

const statusStyle: Record<Status, { icon: any; color: string }> = {
  'Chưa làm': { icon: Clock,        color: 'var(--text-muted)' },
  'Đang làm': { icon: RefreshCw,    color: 'var(--warning)' },
  'Hoàn thành': { icon: CheckCircle2, color: 'var(--success)' },
};

const modalityStyle: Record<Modality, { bg: string; color: string }> = {
  'X-Ray': { bg: 'color-mix(in srgb, var(--info) 15%, transparent)',     color: 'var(--info)' },
  'CT':    { bg: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' },
  'MRI':   { bg: 'color-mix(in srgb, var(--emphasis) 15%, transparent)', color: 'var(--emphasis)' },
};

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CaseCard {
  id: string;
  title: string;
  modality: Modality;
  difficulty: Difficulty;
  hint: string;
  status: Status;
  imageKey: string;
}

interface FeedbackResult {
  attempt: {
    id: number;
    step_index: number;
    step_name: string;
    student_answer: string;
    score: number;
    errors: string[];
    feedback: { type: 'error' | 'hint' | 'correct'; content: string };
    latency_ms: number;
  };
  passed: boolean;
  next_step?: number;
  hint?: string;
  message: string;
  session_complete?: boolean;
}

interface Message {
  id: string;
  role: 'ai' | 'student';
  content: string;
  type?: 'question' | 'correct' | 'partial' | 'incorrect';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CaseListPage() {
  const navigate = useNavigate();

  // ── View ──
  const [viewMode, setViewMode] = useState<ViewMode>('library');

  // ── Library filters ──
  const [activeModality, setActiveModality] = useState<string>('Tất cả');
  const [activeDifficulty, setActiveDifficulty] = useState<string>('Tất cả');
  const [page, setPage] = useState(1);
  const [apiFilters, setApiFilters] = useState({ modality: '', difficulty: '' });

  // ── Upload ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadModality, setUploadModality] = useState('XRAY');
  const [uploading, setUploading] = useState(false);
  const [uploadProcessing, setUploadProcessing] = useState(false);

  // ── Training ──
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activeTab, setActiveTab] = useState<'image' | 'chat'>('image');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Uploaded case data ──
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedCaseData, setUploadedCaseData] = useState<any>(null);

  // ── Answer preview modals ──
  const [showAnswerPreview, setShowAnswerPreview] = useState(false);
  const [showAnswerDetails, setShowAnswerDetails] = useState(false);
  const [stepAnswers, setStepAnswers] = useState<any>(null);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [currentAnswerStep, setCurrentAnswerStep] = useState(0);

  // ── API ──
  const { data: casesData, loading: casesLoading } = useCases({ ...apiFilters, page });
  const { data: caseData, loading: caseLoading } = useCaseDetail(selectedCaseId);
  const { createSession } = useCreateSession();
  const { data: sessionData, loading: sessionLoading, refetch: refetchSession } = useSessionDetail(sessionId);
  const { submitAnswer } = useSubmitAnswer();

  // ── Derived ──
  // sessionId=null → hook never fetches → guard so we don't show "loading" spinner forever
  const isSessionLoading = !!sessionId && sessionLoading;
  const currentStep = sessionData?.current_step ?? 0;
  const currentStepName = STEPS[currentStep] ?? 'OBSERVE';
  const isSessionComplete = sessionData?.status === 'COMPLETED';
  
  // Use uploaded image/data if available, otherwise use case data
  const isUploadedCase = !!uploadedCaseData;
  // uploadedCaseData shape: { image_url, original_image, created_case: { title, modality, difficulty, clinical_history, image_urls } }
  const uploadedCreatedCase = uploadedCaseData?.created_case;
  const caseImage = uploadedImage
    || (uploadedCreatedCase?.image_urls?.[0])
    || (caseData?.image_urls?.[0] ?? '');
  const caseTitle = uploadedCreatedCase?.title || uploadedCaseData?.title || (caseData?.title || '');
  const caseModality = uploadedCreatedCase?.modality || uploadedCaseData?.modality || (caseData?.modality || '');
  const caseDifficulty = uploadedCreatedCase?.difficulty || uploadedCaseData?.difficulty || (caseData?.difficulty || '');
  const clinicalHistory = (uploadedCreatedCase?.clinical_history || uploadedCaseData?.clinical_history || caseData?.clinical_history) ?? '';

  // Build status map (mirror Dashboard)
  const statusMap: Record<number, Status> = {};

  // Cases in Dashboard format
  const cases: CaseCard[] = (casesData?.results ?? []).map((apiCase: any) => ({
    id: apiCase.id.toString(),
    title: apiCase.title,
    modality: mapModality(apiCase.modality),
    difficulty: mapDifficulty(apiCase.difficulty),
    hint: apiCase.clinical_history || apiCase.description || '',
    status: statusMap[apiCase.id] ?? ('Chưa làm' as Status),
    imageKey: getImageKey(apiCase.modality),
  }));

  const filtered = cases.filter(
    (c) =>
      (activeModality === 'Tất cả' || c.modality === activeModality) &&
      (activeDifficulty === 'Tất cả' || c.difficulty === activeDifficulty),
  );

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Handlers ──

  const handleModalityFilter = (m: string) => {
    setActiveModality(m);
    setApiFilters((p) => ({ ...p, modality: m === 'Tất cả' ? '' : m.replace('-', '').toUpperCase() }));
    setPage(1);
  };

  const handleDifficultyFilter = (d: string) => {
    setActiveDifficulty(d);
    const map: Record<string, string> = { 'Cơ bản': 'BASIC', 'Trung bình': 'INTERMEDIATE', 'Nặng cao': 'ADVANCED' };
    setApiFilters((p) => ({ ...p, difficulty: d === 'Tất cả' ? '' : map[d] ?? '' }));
    setPage(1);
  };

  const handleStartTraining = async (caseId: number) => {
    setSelectedCaseId(caseId);
    setViewMode('training');
    setMessages([]);
    setFeedback(null);
    setStudentAnswer('');

    const session = await createSession(caseId);
    if (session) {
      setSessionId(session.id);
      setMessages([
        {
          id: '1',
          role: 'ai',
          type: 'question',
          content: 'Bước 1: Quan sát kỹ hình ảnh. Bạn nhìn thấy những bất thường gì? Hãy xác định vùng bất thường mà bạn nhận thấy.',
        },
      ]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) setUploadFile(file);
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('original_image', uploadFile);
      formData.append('title', uploadTitle);
      formData.append('modality', uploadModality);

      const response = await fetch('http://localhost:8000/api/v1/uploaded-cases/', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setUploading(false);
        setUploadProcessing(true);

        if (data.original_image) {
          setUploadedImage(`http://localhost:8000${data.original_image}`);
        }
        setUploadedCaseData(data);

        // ✅ Fix Bug 1: dùng data.created_case.id thay vì data.created_case_id
        if (data.created_case) {
          try {
            const sessionRes = await createSession(data.created_case.id);
            if (sessionRes) {
              setSessionId(sessionRes.id);
            } else {
              console.error('Failed to create session - no response');
            }
          } catch (createErr) {
            console.error('Error creating session:', createErr);
          }
        }

        // ✅ Show answer preview modal instead of directly going to training
        setUploadFile(null);
        setUploadTitle('');
        setMessages([{
          id: '1',
          role: 'ai',
          type: 'question',
          content: 'Bước 1: Quan sát kỹ hình ảnh. Bạn nhìn thấy những bất thường gì? Hãy xác định vùng bất thường mà bạn nhận thấy.',
        }]);

        // ✅ Fix Bug 3: Chờ 500ms để sessionData được fetch & set trong hook
        // useSessionDetail fetch async, component render mấy lần mới có dữ liệu
        setTimeout(() => {
          setUploadProcessing(false);
          setShowAnswerPreview(true);  // Show popup with 2 options
        }, 500);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadProcessing(false); // ✅ cũng cần reset nếu lỗi
    } finally {
      setUploading(false);
    }
  };

  const fetchStepAnswers = async (sid: number) => {
    if (!sid) return;
    setLoadingAnswers(true);
    try {
      const response = await fetch(`http://localhost:8000/api/v1/sessions/${sid}/step_answers/`, {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setStepAnswers(data);
        setShowAnswerDetails(true);
      } else {
        console.error('Failed to fetch step answers:', response.statusText);
      }
    } catch (err) {
      console.error('Error fetching step answers:', err);
    } finally {
      setLoadingAnswers(false);
    }
  };

  const handleShowAnswers = async () => {
    setShowAnswerPreview(false);
    setCurrentAnswerStep(0);  // Reset to first step
    if (sessionId) {
      await fetchStepAnswers(sessionId);
    }
  };

  const handleStartPractice = () => {
    setShowAnswerPreview(false);
    setShowAnswerDetails(false);
    setCurrentAnswerStep(0);  // Reset carousel for next view
    setViewMode('training');
  };

  const handleSubmitAnswer = async () => {
    if (!sessionId || studentAnswer.trim().length < 10) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'student', content: studentAnswer };
    setMessages((p) => [...p, userMsg]);
    setStudentAnswer('');
    setSubmitting(true);
    setIsTyping(true);

    const result = (await submitAnswer(sessionId, userMsg.content)) as FeedbackResult | null;
    setIsTyping(false);
    setSubmitting(false);

    if (result) {
      setFeedback(result);
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        type: result.passed ? 'correct' : 'partial',
        content: result.attempt.feedback.content,
      };
      setMessages((p) => [...p, aiMsg]);
      setShowFeedbackDialog(true);
      if (result.passed || result.attempt.score >= 0.6) {
        setTimeout(() => refetchSession(), 300);
      }
    }
  };

  const handleContinue = async () => {
    if (!feedback || feedback.attempt.score < 0.6) {
      setShowFeedbackDialog(false);
      return;
    }
    setShowFeedbackDialog(false);
    setFeedback(null);

    let nextStepNum = feedback.next_step;
    if (nextStepNum === undefined) {
      await new Promise((r) => setTimeout(r, 200));
      await refetchSession();
      nextStepNum = sessionData?.current_step;
    }

    if (nextStepNum !== undefined && nextStepNum < STEPS.length) {
      const prompts: Record<number, string> = {
        0: 'Bước 1: Quan sát kỹ hình ảnh. Bạn nhìn thấy những bất thường gì?',
        1: 'Bước 2: Mô tả chi tiết các đặc điểm của tổn thương bạn quan sát thấy.',
        2: 'Bước 3: Diễn giải ý nghĩa lâm sàng của các phát hiện này.',
        3: 'Bước 4: Đưa ra giả thuyết chẩn đoán dự phòng.',
        4: 'Bước 5: Phân tích các chẩn đoán phân biệt cần loại trừ.',
        5: 'Bước 6: Đưa ra kết luận chẩn đoán cuối cùng.',
      };
      setMessages((p) => [
        ...p,
        { id: Date.now().toString(), role: 'ai', type: 'question', content: prompts[nextStepNum] ?? `Bước ${nextStepNum + 1}` },
      ]);
      setActiveTab('chat');
    } else {
      const targetCaseId = uploadedCaseData?.created_case?.id ?? uploadedCaseData?.id ?? selectedCaseId;
      navigate(`/answer-key/${targetCaseId}`);
    }
  };

  // ── Shared tab button style (mirrors Dashboard filter buttons) ──
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 500,
    border: active ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
    backgroundColor: active ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
    color: active ? 'var(--accent)' : 'var(--text-sec)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  });

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: 'var(--bg-base)', paddingLeft: 100 }}>

      {/* ── Global Tab Bar ── */}
      <div
        style={{
          flexShrink: 0,
          backgroundColor: 'var(--bg-base)',
          borderBottom: '1px solid var(--border-dim)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button style={tabBtn(viewMode === 'library')} onClick={() => setViewMode('library')}>
          <BookOpen size={14} /> Thư Viện
        </button>
        <button style={tabBtn(viewMode === 'upload')} onClick={() => setViewMode('upload')}>
          <FileUp size={14} /> Upload
        </button>
        <button
          style={{ ...tabBtn(viewMode === 'training'), opacity: !sessionId ? 0.45 : 1, cursor: !sessionId ? 'not-allowed' : 'pointer' }}
          onClick={() => sessionId && setViewMode('training')}
          disabled={!sessionId}
        >
          <PlayCircle size={14} /> Thực Hành
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 1 – CASE LIBRARY  (exact Dashboard format)
      ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'library' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', maxWidth: 1280, width: '100%', margin: '0 auto' }}>

          {/* Header */}
          <div style={{ marginBottom: 12 }}>
            <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--text-primary)', marginBottom: 6 }}>
              Case Study Library
            </h1>
            <p style={{ color: 'var(--text-sec)', fontSize: 14 }}>
              Chọn ca để bắt đầu luyện tập pipeline 6 bước
            </p>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-sec)', fontSize: 13 }}>Phương thức:</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Tất cả', 'X-Ray', 'CT', 'MRI'].map((m) => (
                  <button
                    key={m}
                    onClick={() => handleModalityFilter(m)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 500,
                      border: activeModality === m ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
                      backgroundColor: activeModality === m ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                      color: activeModality === m ? 'var(--accent)' : 'var(--text-sec)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-sec)', fontSize: 13 }}>Độ khó:</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Tất cả', 'Cơ bản', 'Trung bình', 'Nặng cao'].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleDifficultyFilter(d)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 500,
                      border: activeDifficulty === d ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
                      backgroundColor: activeDifficulty === d ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                      color: activeDifficulty === d ? 'var(--accent)' : 'var(--text-sec)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card Grid */}
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {casesLoading
              ? [1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 8, height: 280, animation: 'pulse 2s infinite' }} />
                ))
              : filtered.length > 0
              ? filtered.map((c) => {
                  const StatusIcon = statusStyle[c.status].icon;
                  return (
                    <div
                      key={c.id}
                      style={{
                        backgroundColor: 'var(--bg-surface)',
                        border: '1px solid var(--border-dim)',
                        borderRadius: 8,
                        overflow: 'hidden',
                        transition: 'border-color 0.2s, transform 0.2s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-dim)';
                        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                      }}
                    >
                      {/* Thumbnail */}
                      <div style={{ height: 140, backgroundColor: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                        <div className={`img-${c.imageKey}`} style={{ width: '100%', height: '100%', opacity: 0.85 }} />
                        <span style={{ position: 'absolute', top: 10, right: 10, padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: modalityStyle[c.modality].bg, color: modalityStyle[c.modality].color, border: `1px solid ${modalityStyle[c.modality].color}44` }}>
                          {c.modality.toUpperCase()}
                        </span>
                        <span style={{ position: 'absolute', top: 10, left: 10, padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, backgroundColor: difficultyStyle[c.difficulty].bg, color: difficultyStyle[c.difficulty].color, border: `1px solid ${difficultyStyle[c.difficulty].color}44` }}>
                          {c.difficulty}
                        </span>
                      </div>

                      {/* Content */}
                      <div style={{ padding: 12 }}>
                        <h3 style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.3 }}>
                          {c.title}
                        </h3>
                        <p style={{ fontSize: 12, color: 'var(--text-sec)', marginBottom: 8, lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {c.hint}
                        </p>

                        {/* Footer */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <StatusIcon size={13} color={statusStyle[c.status].color} />
                            <span style={{ fontSize: 12, color: statusStyle[c.status].color, fontWeight: 500 }}>
                              {c.status}
                            </span>
                          </div>
                          <button
                            onClick={() => handleStartTraining(Number(c.id))}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 6,
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              ...(c.status === 'Đang làm'
                                ? { backgroundColor: 'transparent', border: '1px solid var(--warning)', color: 'var(--warning)' }
                                : c.status === 'Hoàn thành'
                                ? { backgroundColor: 'transparent', border: '1px solid var(--success)', color: 'var(--success)' }
                                : { backgroundColor: 'var(--accent)', border: '1px solid var(--accent)', color: 'var(--primary-foreground)' }),
                            }}
                          >
                            {c.status === 'Đang làm' ? (
                              <><RefreshCw size={12} /> Tiếp tục</>
                            ) : c.status === 'Hoàn thành' ? (
                              <><PlayCircle size={12} /> Làm lại</>
                            ) : (
                              <><PlayCircle size={12} /> Bắt đầu</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              : (
                <div style={{ gridColumn: '1/-1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: 'var(--text-muted)' }}>
                  <Layers size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                  <p style={{ fontSize: 16, fontWeight: 500 }}>Chưa có ca nào</p>
                  <p style={{ fontSize: 13, marginTop: 6 }}>Thử thay đổi bộ lọc để xem thêm ca học</p>
                </div>
              )}
          </div>

          {/* Pagination */}
          {casesData?.count && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', paddingTop: 24 }}>
              <button
                disabled={!casesData.previous}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'transparent', color: 'var(--text-sec)', fontSize: 13, cursor: casesData.previous ? 'pointer' : 'not-allowed', opacity: casesData.previous ? 1 : 0.4 }}
              >
                ← Trước
              </button>
              <span style={{ fontSize: 13, color: 'var(--text-sec)' }}>
                Trang {page} / {Math.ceil(casesData.count / 20)}
              </span>
              <button
                disabled={!casesData.next}
                onClick={() => setPage((p) => p + 1)}
                style={{ padding: '5px 16px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'transparent', color: 'var(--text-sec)', fontSize: 13, cursor: casesData.next ? 'pointer' : 'not-allowed', opacity: casesData.next ? 1 : 0.4 }}
              >
                Sau →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 2 – UPLOAD
      ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'upload' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '100%', maxWidth: 560 }}>

            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 22, color: 'var(--text-primary)', marginBottom: 6 }}>
                Upload Ảnh Y Tế
              </h1>
              <p style={{ color: 'var(--text-sec)', fontSize: 14 }}>
                Tải lên ảnh y tế của bạn. AI sẽ tự động phân tích và tạo 6 bước chẩn đoán.
              </p>
            </div>

            {/* Upload card */}
            <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${uploadFile ? 'var(--accent)' : 'var(--border-dim)'}`,
                  borderRadius: 8,
                  padding: '28px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: uploadFile ? 'color-mix(in srgb, var(--accent) 5%, transparent)' : 'transparent',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => { if (!uploadFile) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
                onMouseLeave={(e) => { if (!uploadFile) (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-dim)'; }}
              >
                <Upload size={28} color={uploadFile ? 'var(--accent)' : 'var(--text-muted)'} />
                {uploadFile ? (
                  <>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>✓ {uploadFile.name}</p>
                    <img src={URL.createObjectURL(uploadFile)} alt="preview" style={{ maxHeight: 160, borderRadius: 6, border: '1px solid var(--border-dim)', marginTop: 4 }} />
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Nhấp hoặc kéo thả ảnh</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>PNG, JPG – tối đa 5MB</p>
                  </>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} style={{ display: 'none' }} />

              {/* Case name */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-sec)', marginBottom: 6 }}>
                  Tên Case
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="VD: Viêm phổi phải – CT scan"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontSize: 13, outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border-dim)')}
                />
              </div>

              {/* Modality selector */}
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-sec)', marginBottom: 6 }}>
                  Loại Ảnh Y Tế
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[{ val: 'XRAY', label: 'X-Ray' }, { val: 'CT', label: 'CT Scan' }, { val: 'MRI', label: 'MRI' }, { val: 'ULTRASOUND', label: 'Ultrasound' }].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => setUploadModality(val)}
                      style={{
                        flex: 1,
                        padding: '6px 0',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 500,
                        border: uploadModality === val ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
                        backgroundColor: uploadModality === val ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                        color: uploadModality === val ? 'var(--accent)' : 'var(--text-sec)',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info note */}
              <div style={{ padding: '10px 12px', borderRadius: 6, backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Lightbulb size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.5 }}>
                  AI sẽ tự động phân tích ảnh và tạo 6 bước chẩn đoán: OBSERVE → DESCRIBE → INTERPRET → HYPOTHESIS → DDx → CONCLUSION.
                </p>
              </div>

              {/* Submit */}
              <button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadTitle.trim() || uploading}
                style={{
                  padding: '11px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: (!uploadFile || !uploadTitle.trim() || uploading) ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--accent)',
                  color: 'var(--primary-foreground)',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: (!uploadFile || !uploadTitle.trim() || uploading) ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
                onMouseEnter={(e) => { if (!(!uploadFile || !uploadTitle.trim() || uploading)) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
                onMouseLeave={(e) => { if (!(!uploadFile || !uploadTitle.trim() || uploading)) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
              >
                {uploading ? (
                  <>
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 14, height: 14, borderRadius: '50%', borderTop: '2px solid white', borderRight: '2px solid white', borderBottom: '2px solid transparent', borderLeft: '2px solid transparent' }} />
                    Đang xử lý...
                  </>
                ) : (
                  <><Upload size={15} /> Upload & Bắt Đầu Luyện Tập</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 3 – TRAINING  (exact DiagnosisSession format)
      ════════════════════════════════════════════════════════════════════════ */}
      {viewMode === 'training' && (
        <>
          {uploadProcessing && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-sec)' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border-dim)', borderTop: '3px solid var(--accent)' }}
              />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>AI đang phân tích ảnh...</p>
                <p style={{ fontSize: 12, color: 'var(--text-sec)' }}>Đang tạo 6 bước chẩn đoán, vui lòng chờ</p>
              </div>
            </div>
          )}

          {!uploadProcessing && caseLoading && !isUploadedCase && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-sec)' }}>
              Đang tải case...
            </div>
          )}

          {/* Loading state: Waiting for session data after upload */}
          {!uploadProcessing && isSessionLoading && !sessionData && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, color: 'var(--text-sec)' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border-dim)', borderTop: '3px solid var(--accent)' }}
              />
              <p style={{ fontSize: 13, color: 'var(--text-sec)' }}>Đang chuẩn bị session...</p>
            </div>
          )}

          {!uploadProcessing && (isUploadedCase ? !!uploadedCaseData : (!caseLoading && !!caseData)) && sessionData && !isSessionComplete && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Top case bar */}
              <motion.div
                style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border-dim)', backgroundColor: 'var(--bg-surface)' }}
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{caseTitle}</span>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, backgroundColor: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent)' }}>{caseModality}</span>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, backgroundColor: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent)' }}>{caseDifficulty}</span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => {
                    setViewMode('library');
                    setUploadedImage(null);
                    setUploadedCaseData(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text-sec)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                >
                  ← Thư Viện
                </button>
              </motion.div>

              {/* Main split content */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

                {/* LEFT – Image Viewer */}
                <motion.div
                  style={{ flexDirection: 'column', width: '100%', maxWidth: '55%', borderRight: '1px solid var(--border-dim)', display: 'flex' }}
                  initial={{ x: -28, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Clinical note */}
                  <motion.div style={{ padding: '8px 16px 0', flexShrink: 0 }} initial={{ x: -18 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.16 }}>
                    <div style={{ borderLeft: '3px solid var(--accent)', backgroundColor: 'color-mix(in srgb, var(--accent) 5%, transparent)', borderRadius: '0 6px 6px 0', padding: '8px 12px' }}>
                      <p style={{ fontSize: 11, color: 'var(--text-sec)', marginBottom: 2, fontWeight: 500, letterSpacing: '0.04em' }}>BỆNH SỬ</p>
                      <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{clinicalHistory || 'Đang tải lịch sử lâm sàng...'}</p>
                    </div>
                  </motion.div>

                  {/* Image */}
                  <motion.div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', backgroundColor: 'var(--bg-base)' }} initial={{ x: -12 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.22 }}>
                    {caseImage ? (
                      <img src={caseImage} alt="Medical Image" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', transform: `translateY(-20px) scale(${zoom})`, transition: 'transform 0.2s', filter: 'grayscale(20%) contrast(1.1)' }} />
                    ) : (
                      <div style={{ color: 'var(--text-sec)' }}>Đang tải hình ảnh...</div>
                    )}
                    {caseImage && (
                      <div style={{ position: 'absolute', bottom: 16, right: 16, backgroundColor: 'var(--bg-surface)', borderRadius: 8, border: '1px solid var(--border-dim)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {[{ Icon: ZoomIn, action: () => setZoom((z) => Math.min(z + 0.25, 3)) }, { Icon: ZoomOut, action: () => setZoom((z) => Math.max(z - 0.25, 0.5)) }, { Icon: Maximize2, action: () => setZoom(1) }].map(({ Icon, action }, i) => (
                          <button key={i} onClick={action} style={{ padding: '8px 10px', backgroundColor: 'transparent', border: 'none', borderBottom: i < 2 ? '1px solid var(--border-dim)' : 'none', color: 'var(--text-sec)', cursor: 'pointer' }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--accent) 13%, transparent)')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent')}
                          >
                            <Icon size={14} />
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </motion.div>

                {/* RIGHT – Chat */}
                <motion.div
                  style={{ flexDirection: 'column', flex: 1, minWidth: 0, backgroundColor: 'var(--bg-base)', display: 'flex' }}
                  initial={{ x: 28, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* Chat header */}
                  <motion.div className="hidden md:flex" style={{ alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border-dim)', backgroundColor: 'var(--bg-surface)', flexShrink: 0 }} initial={{ x: 18 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-primary)' }}>SARa AI</span>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 500, backgroundColor: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent)' }}>OpenAI</span>
                    </div>
                  </motion.div>

                  {/* Pipeline Stepper */}
                  <motion.div style={{ padding: '8px 16px', flexShrink: 0, borderBottom: '1px solid var(--border-dim)' }} initial={{ x: 14 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {STEPS.map((step, i) => (
                        <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, transition: 'all 0.3s', ...(i <= currentStep ? { backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)' } : { backgroundColor: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-dim)' }) }}>
                              {i < currentStep ? '✓' : i + 1}
                            </div>
                            <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.04em', color: i <= currentStep ? 'var(--accent)' : 'var(--text-muted)' }}>{step}</span>
                          </div>
                          {i < STEPS.length - 1 && (
                            <div style={{ width: 16, height: 1, backgroundColor: i < currentStep ? 'var(--accent)' : 'var(--border-dim)', margin: '0 1px', marginBottom: 18, transition: 'background-color 0.3s' }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Step chip */}
                  <motion.div style={{ padding: '6px 16px', flexShrink: 0 }} initial={{ x: 10 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.28 }}>
                    <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, letterSpacing: '0.04em', backgroundColor: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 27%, transparent)' }}>
                      Bước {currentStep + 1} – {currentStepName}
                    </span>
                  </motion.div>

                  {/* Chat messages */}
                  <motion.div style={{ flex: 1, overflowY: 'auto', padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: 6 }} initial={{ x: 8 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.34 }}>
                    {messages.map((msg) => (
                      <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} style={{ display: 'flex', justifyContent: msg.role === 'student' ? 'flex-end' : 'flex-start' }}>
                        {msg.role === 'ai' ? (
                          <div style={{ maxWidth: '88%', backgroundColor: 'var(--bg-surface)', borderRadius: 8, padding: '8px 10px', borderLeft: `3px solid ${msg.type === 'correct' ? 'var(--accent)' : 'var(--accent-dim)'}` }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-sec)' }}>SARa AI</span>
                              {msg.type === 'correct' && <span style={{ fontSize: 11 }}>✓</span>}
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{msg.content}</p>
                          </div>
                        ) : (
                          <div style={{ maxWidth: '82%', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderRadius: 8, padding: '8px 10px', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)' }}>
                            <p style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{msg.content}</p>
                          </div>
                        )}
                      </motion.div>
                    ))}
                    {isTyping && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                        <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: 8, padding: '8px 12px', borderLeft: '3px solid var(--accent)', display: 'flex', gap: 4, alignItems: 'center' }}>
                          {[0, 1, 2].map((i) => (
                            <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                          ))}
                        </div>
                      </motion.div>
                    )}
                    <div ref={chatEndRef} />
                  </motion.div>

                  {/* Input area */}
                  <motion.div style={{ padding: '8px 16px', flexShrink: 0, borderTop: '1px solid var(--border-dim)', backgroundColor: 'var(--bg-surface)' }} initial={{ y: 12 }} animate={{ y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <button style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 500, backgroundColor: 'transparent', border: '1px solid var(--border-dim)', color: 'var(--text-sec)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent-dim)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-dim)')}
                      >
                        <Lightbulb size={12} color="var(--accent-dim)" /> Gợi ý
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea
                        value={studentAnswer}
                        onChange={(e) => setStudentAnswer(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitAnswer(); } }}
                        placeholder="Nhập câu trả lời của bạn..."
                        rows={2}
                        style={{ flex: 1, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, resize: 'none', outline: 'none' }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border-dim)')}
                      />
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={submitting || studentAnswer.trim().length < 10}
                        style={{ padding: '0 14px', borderRadius: 8, backgroundColor: 'var(--accent)', border: 'none', color: 'var(--primary-foreground)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s', opacity: (submitting || studentAnswer.trim().length < 10) ? 0.5 : 1 }}
                        onMouseEnter={(e) => { if (!submitting) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)')}
                      >
                        <Send size={16} />
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          )}

          {/* Session complete */}
          {!caseLoading && !uploadProcessing && isSessionComplete && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ textAlign: 'center', maxWidth: 480, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 32 }}>
                <CheckCircle2 size={56} color="var(--success)" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>🎉 Hoàn Thành!</h3>
                <p style={{ fontSize: 14, color: 'var(--text-sec)', marginBottom: 24 }}>
                  Bạn đã hoàn thành case "{caseTitle}" với điểm{' '}
                  <strong style={{ color: 'var(--accent)' }}>{(sessionData.total_score * 100).toFixed(1)}%</strong>
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => {
                      setViewMode('library');
                      setUploadedImage(null);
                      setUploadedCaseData(null);
                    }}
                    style={{ flex: 1, padding: '10px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    ← Quay Lại Thư Viện
                  </button>
                  <button
                    onClick={() => {
                      setSessionId(null);
                      setSelectedCaseId(null);
                      setMessages([]);
                      setUploadedImage(null);
                      setUploadedCaseData(null);
                      setViewMode('upload');
                    }}
                    style={{ flex: 1, padding: '10px', borderRadius: 6, border: 'none', backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Upload Case Mới
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          FEEDBACK MODAL  (exact DiagnosisSession design)
      ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showFeedbackDialog && feedback && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'color-mix(in srgb, var(--bg-base) 75%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: 600, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 8, overflow: 'hidden', maxHeight: '90vh', overflowY: 'auto' }}
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border-dim)' }}>
                <span style={{ padding: '3px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, letterSpacing: '0.04em', backgroundColor: 'color-mix(in srgb, var(--accent) 13%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 27%, transparent)' }}>
                  {feedback.attempt.step_name}
                </span>
                <button onClick={() => setShowFeedbackDialog(false)} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '20px' }}>
                {/* Score ring */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 100, height: 100 }}>
                    <svg width="100" height="100" style={{ position: 'absolute' }}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-dim)" strokeWidth="7" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={feedback.passed ? 'var(--accent)' : 'var(--accent-dim)'} strokeWidth="7" strokeDasharray={`${feedback.attempt.score * 264} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
                    </svg>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: feedback.passed ? 'var(--accent)' : 'var(--accent-dim)', lineHeight: 1 }}>
                        {Math.round(feedback.attempt.score * 100)}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-sec)' }}>/100</span>
                    </div>
                  </div>
                </div>

                {/* Feedback content */}
                <div style={{ marginBottom: 16, padding: 12, borderRadius: 6, backgroundColor: feedback.passed ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'color-mix(in srgb, var(--accent-dim) 13%, transparent)', border: `1px solid ${feedback.passed ? 'color-mix(in srgb, var(--accent) 27%, transparent)' : 'color-mix(in srgb, var(--accent-dim) 27%, transparent)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    {feedback.passed ? <CheckCircle2 size={14} color="var(--accent)" /> : <AlertTriangle size={14} color="var(--accent-dim)" />}
                    <span style={{ fontWeight: 600, fontSize: 13, color: feedback.passed ? 'var(--accent)' : 'var(--accent-dim)' }}>
                      {feedback.passed ? '✓ Chính xác!' : '⚠ Cần cải thiện'}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6 }}>{feedback.attempt.feedback.content}</p>
                </div>

                {/* Errors */}
                {feedback.attempt.errors.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <AlertCircle size={13} color="var(--accent-dim)" />
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent-dim)' }}>Lỗi phát hiện</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {feedback.attempt.errors.map((err, i) => (
                        <span key={i} style={{ padding: '4px 10px', borderRadius: 4, fontSize: 12, backgroundColor: 'color-mix(in srgb, var(--accent-dim) 13%, transparent)', color: 'var(--accent-dim)', border: '1px solid color-mix(in srgb, var(--accent-dim) 20%, transparent)' }}>• {err}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Low score warning */}
                {feedback.attempt.score < 0.6 && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 16, padding: 12, borderRadius: 6, backgroundColor: 'color-mix(in srgb, #ff4757 13%, transparent)', border: '1px solid color-mix(in srgb, #ff4757 27%, transparent)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <AlertTriangle size={14} color="#ff4757" />
                      <span style={{ fontWeight: 600, fontSize: 13, color: '#ff4757' }}>Không đủ điểm để tiếp tục</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#ff4757', lineHeight: 1.5 }}>
                      Bạn cần đạt ít nhất <strong>60/100</strong> điểm để chuyển sang bước tiếp theo.
                    </p>
                  </motion.div>
                )}

                {/* Latency */}
                <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 6, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={13} color="var(--text-sec)" />
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-sec)' }}>Thời gian xử lý OpenAI API</p>
                    <p style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>{feedback.attempt.latency_ms}ms</p>
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={handleContinue}
                  disabled={feedback.attempt.score < 0.6}
                  style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', backgroundColor: feedback.attempt.score < 0.6 ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--accent)', color: feedback.attempt.score < 0.6 ? 'var(--text-muted)' : 'var(--primary-foreground)', fontSize: 14, fontWeight: 600, cursor: feedback.attempt.score < 0.6 ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onMouseEnter={(e) => { if (feedback.attempt.score >= 0.6) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
                  onMouseLeave={(e) => { if (feedback.attempt.score >= 0.6) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
                >
                  {feedback.attempt.score < 0.6 ? (
                    'Cần đạt 60 điểm để tiếp tục'
                  ) : currentStep < STEPS.length - 1 ? (
                    <>Tiếp tục → Bước {currentStep + 1} <ChevronRight size={16} /></>
                  ) : (
                    <>Xem kết quả cuối cùng <ChevronRight size={16} /></>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════════
          ANSWER PREVIEW MODAL - Show after upload (2 options: Show Answers or Practice)
      ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAnswerPreview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'color-mix(in srgb, var(--bg-base) 75%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: 500, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 12, overflow: 'hidden' }}
            >
              {/* Header */}
              <div style={{ padding: '24px 20px', textAlign: 'center', borderBottom: '1px solid var(--border-dim)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Tuyệt vời! 🎉
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-sec)', lineHeight: 1.5 }}>
                  Ảnh của bạn đã được tải lên thành công. Bây giờ bạn muốn làm gì?
                </p>
              </div>

              {/* Options */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Show Answers Option */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleShowAnswers}
                  disabled={loadingAnswers}
                  style={{
                    padding: '16px',
                    borderRadius: 8,
                    border: '1px solid var(--border-dim)',
                    backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)',
                    color: 'var(--text-primary)',
                    cursor: loadingAnswers ? 'not-allowed' : 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    opacity: loadingAnswers ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!loadingAnswers) {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--accent) 15%, transparent)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-dim)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--accent) 10%, transparent)';
                  }}
                >
                  {loadingAnswers ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} style={{ display: 'flex' }}>
                        <RefreshCw size={16} />
                      </motion.div>
                      Đang tải đáp án...
                    </>
                  ) : (
                    <>
                      <BookOpen size={16} />
                      Xem Đáp Án Tham Khảo
                    </>
                  )}
                </motion.button>

                {/* Practice Option */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleStartPractice}
                  style={{
                    padding: '16px',
                    borderRadius: 8,
                    border: 'none',
                    backgroundColor: 'var(--accent)',
                    color: 'var(--primary-foreground)',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'background-color 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)';
                  }}
                >
                  <PlayCircle size={16} />
                  Bắt Đầu Thực Hành
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════════
          ANSWER DETAILS MODAL - Carousel style with image on left
      ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAnswerDetails && stepAnswers && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'color-mix(in srgb, var(--bg-base) 75%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: 1000, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 12, overflow: 'hidden', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Header */}
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Đáp Án Tham Khảo - {stepAnswers.case_title}
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                    Phương thức: <strong>{mapModality(stepAnswers.case_modality)}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setShowAnswerDetails(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer', padding: 0 }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, backgroundColor: 'var(--border-dim)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    backgroundColor: 'var(--accent)',
                    width: `${((currentAnswerStep + 1) / STEPS.length) * 100}%`,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* Main content area - Two columns: image on left, carousel on right */}
              <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                
                {/* Left side - Image */}
                <div style={{ width: 300, backgroundColor: 'var(--bg-base)', borderRight: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, minHeight: 0 }}>
                  {uploadedImage ? (
                    <motion.img
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                      src={uploadedImage}
                      alt="Case image"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        borderRadius: 6,
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-sec)', fontSize: 13 }}>
                      <p>📷</p>
                      <p>Không có ảnh</p>
                    </div>
                  )}
                </div>

                {/* Right side - Content carousel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 28px', overflowY: 'auto', position: 'relative', minHeight: 0 }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentAnswerStep}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
                    >
                      {/* Step badge and title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent)',
                            color: 'var(--primary-foreground)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 16,
                            fontWeight: 700,
                          }}
                        >
                          {currentAnswerStep + 1}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                            {STEPS[currentAnswerStep]}
                          </p>
                          <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '2px 0 0 0' }}>
                            Bước {currentAnswerStep + 1} của {STEPS.length}
                          </p>
                        </div>
                      </div>

                      {/* Reference Answer */}
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          📝 Đáp Án Tham Khảo
                        </p>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--text-primary)',
                            lineHeight: 1.7,
                            backgroundColor: 'var(--bg-surface)',
                            padding: '12px 12px',
                            borderRadius: 6,
                            border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
                            minHeight: 70,
                          }}
                        >
                          {stepAnswers.answers[STEPS[currentAnswerStep]] || '(Chưa có đáp án)'}
                        </div>
                      </div>

                      {/* Template/Rubric */}
                      {stepAnswers.step_templates && stepAnswers.step_templates[currentAnswerStep] && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            🎯 Tiêu Chí Đánh Giá
                          </p>
                          <div
                            style={{
                              fontSize: 13,
                              color: 'var(--text-primary)',
                              lineHeight: 1.7,
                              backgroundColor: 'var(--bg-surface)',
                              padding: '12px 12px',
                              borderRadius: 6,
                              border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)',
                              minHeight: 50,
                            }}
                          >
                            {stepAnswers.step_templates[currentAnswerStep]}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer - Navigation */}
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-dim)', display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCurrentAnswerStep(Math.max(0, currentAnswerStep - 1))}
                  disabled={currentAnswerStep === 0}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: 6,
                    border: '1px solid var(--border-dim)',
                    backgroundColor: currentAnswerStep === 0 ? 'color-mix(in srgb, var(--border-dim) 50%, transparent)' : 'transparent',
                    color: currentAnswerStep === 0 ? 'var(--text-muted)' : 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: currentAnswerStep === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (currentAnswerStep > 0) {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-primary)';
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--border-dim) 30%, transparent)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-dim)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  ← Quay Lại
                </button>

                <button
                  onClick={() => setShowAnswerDetails(false)}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: 6,
                    border: '1px solid var(--border-dim)',
                    backgroundColor: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--text-sec)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--border-dim) 30%, transparent)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-dim)';
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                  }}
                >
                  Đóng
                </button>

                <button
                  onClick={() => {
                    if (currentAnswerStep < STEPS.length - 1) {
                      setCurrentAnswerStep(currentAnswerStep + 1);
                    }
                  }}
                  disabled={currentAnswerStep === STEPS.length - 1}
                  style={{
                    flex: 1,
                    padding: '11px',
                    borderRadius: 6,
                    border: 'none',
                    backgroundColor: currentAnswerStep === STEPS.length - 1 ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--accent)',
                    color: currentAnswerStep === STEPS.length - 1 ? 'var(--text-muted)' : 'var(--primary-foreground)',
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: currentAnswerStep === STEPS.length - 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (currentAnswerStep < STEPS.length - 1) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentAnswerStep < STEPS.length - 1) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)';
                    }
                  }}
                >
                  {currentAnswerStep === STEPS.length - 1 ? 'Bắt Đầu Thực Hành →' : 'Tiếp Theo'} {currentAnswerStep < STEPS.length - 1 && '→'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}