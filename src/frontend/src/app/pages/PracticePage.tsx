/**
 * PracticePage - Upload & Training combined
 * - Tab "Upload": thiết kế sạch nhất quán với Dashboard
 * - Tab "Thực Hành": hoàn toàn theo DiagnosisSession (split layout + chat + modals)
 */
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, PlayCircle, X, Clock, CheckCircle2, RefreshCw, Lightbulb,
  BookOpen, AlertCircle, AlertTriangle, ZoomIn, ZoomOut, Maximize2, Send, ChevronRight,
} from 'lucide-react';
import { useCaseDetail, useCreateSession, useSessionDetail, useSubmitAnswer } from '@/api/hooks';

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ['OBSERVE', 'DESCRIBE', 'INTERPRET', 'HYPOTHESIS', 'DDx', 'CONCLUSION'];

type Modality = 'X-Ray' | 'CT' | 'MRI';
type ViewMode = 'upload' | 'training';

// ─── Mapping helpers ──────────────────────────────────────────────────────────

const mapModality = (m: string): Modality =>
  ({ XRAY: 'X-Ray', CT: 'CT', MRI: 'MRI' } as Record<string, Modality>)[m] ?? 'X-Ray';

interface Message {
  id: string;
  role: 'ai' | 'student';
  content: string;
  type?: 'question' | 'correct' | 'partial' | 'incorrect';
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

// ─── Component ────────────────────────────────────────────────────────────────

export function PracticePage() {
  const navigate = useNavigate();

  // ── View mode ──
  const [viewMode, setViewMode] = useState<ViewMode>('upload');

  // ── Upload state ──
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadModality, setUploadModality] = useState('XRAY');
  const [uploading, setUploading] = useState(false);
  const [uploadProcessing, setUploadProcessing] = useState(false);

  // ── Training state ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [studentAnswer, setStudentAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [zoom, setZoom] = useState(1);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Uploaded case data ──
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadedCaseData, setUploadedCaseData] = useState<any>(null);
  // sessionId tách riêng để tránh stale closure khi đọc từ uploadedCaseData
  const [sessionId, setSessionId] = useState<number | null>(null);
  const sessionIdRef = useRef<number | null>(null);

  // ── Answer preview modals ──
  const [showAnswerPreview, setShowAnswerPreview] = useState(false);
  const [showAnswerDetails, setShowAnswerDetails] = useState(false);
  const [stepAnswers, setStepAnswers] = useState<any>(null);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [currentAnswerStep, setCurrentAnswerStep] = useState(0);

  // ── API ──
  const { data: caseData, loading: caseLoading } = useCaseDetail(uploadedCaseData?.created_case?.id);
  const { createSession } = useCreateSession();
  const { data: sessionData, loading: sessionLoading, refetch: refetchSession } = useSessionDetail(sessionId);
  const { submitAnswer } = useSubmitAnswer();

  // ── Derived ──
  const isSessionLoading = !!sessionId && sessionLoading;
  const currentStep = sessionData?.current_step ?? 0;
  const currentStepName = STEPS[currentStep] ?? 'OBSERVE';
  const isSessionComplete = sessionData?.status === 'COMPLETED';

  const caseImage = uploadedImage
    || (uploadedCaseData?.created_case?.image_urls?.[0])
    || (caseData?.image_urls?.[0] ?? '');
  const caseTitle = uploadedCaseData?.created_case?.title || uploadedCaseData?.title || (caseData?.title || '');
  const caseModality = uploadedCaseData?.created_case?.modality || uploadedCaseData?.modality || (caseData?.modality || '');
  const caseDifficulty = uploadedCaseData?.created_case?.difficulty || uploadedCaseData?.difficulty || (caseData?.difficulty || '');
  const clinicalHistory = (uploadedCaseData?.created_case?.clinical_history || uploadedCaseData?.clinical_history || caseData?.clinical_history) ?? '';

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Handlers ──

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

        // Create session — lưu vào state riêng + ref để tránh stale closure
        if (data.created_case) {
          try {
            const sessionRes = await createSession(data.created_case.id);
            if (sessionRes) {
              setSessionId(sessionRes.id);
              sessionIdRef.current = sessionRes.id;
              setUploadedCaseData((prev: any) => ({ ...prev, session_id: sessionRes.id }));
            } else {
              console.error('Failed to create session - no response');
            }
          } catch (createErr) {
            console.error('Error creating session:', createErr);
          }
        }

        setUploadFile(null);
        setUploadTitle('');
        setMessages([{
          id: '1',
          role: 'ai',
          type: 'question',
          content: 'Bước 1: Quan sát kỹ hình ảnh. Bạn nhìn thấy những bất thường gì? Hãy xác định vùng bất thường mà bạn nhận thấy.',
        }]);

        setTimeout(() => {
          setUploadProcessing(false);
          setShowAnswerPreview(true);  // ✅ Hiện popup chọn: Xem đáp án / Thực hành
        }, 500);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadProcessing(false);
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
    setCurrentAnswerStep(0);
    // Dùng ref để đảm bảo luôn có giá trị mới nhất, tránh stale closure
    const sid = sessionIdRef.current ?? sessionId ?? uploadedCaseData?.session_id;
    if (sid) {
      await fetchStepAnswers(sid);
    } else {
      console.error('handleShowAnswers: không tìm thấy session_id');
    }
  };

  const handleStartPractice = () => {
    setShowAnswerPreview(false);
    setShowAnswerDetails(false);
    setCurrentAnswerStep(0);
    setViewMode('training');
  };

  const handleSubmitAnswer = async () => {
    const sid = sessionIdRef.current ?? sessionId ?? uploadedCaseData?.session_id;
    if (!sid || studentAnswer.trim().length < 10) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'student', content: studentAnswer };
    setMessages((p) => [...p, userMsg]);
    setStudentAnswer('');
    setSubmitting(true);
    setIsTyping(true);

    const result = (await submitAnswer(uploadedCaseData.session_id, userMsg.content)) as FeedbackResult | null;
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
    } else {
      const targetCaseId = uploadedCaseData?.created_case?.id ?? uploadedCaseData?.id;
      navigate(`/answer-key/${targetCaseId}`);
    }
  };

  // ── Shared style helpers ──

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

      {/* ── Tab Bar ── */}
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
        <button style={tabBtn(viewMode === 'upload')} onClick={() => setViewMode('upload')}>
          <Upload size={14} /> Upload Ảnh
        </button>
        <button
          style={{ ...tabBtn(viewMode === 'training'), opacity: !uploadedCaseData ? 0.45 : 1, cursor: !uploadedCaseData ? 'not-allowed' : 'pointer' }}
          onClick={() => uploadedCaseData && setViewMode('training')}
          disabled={!uploadedCaseData}
        >
          <PlayCircle size={14} /> Thực Hành
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════════
          TAB 1 – UPLOAD
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
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>{uploadFile.name}</p>
                    <img src={URL.createObjectURL(uploadFile)} alt="preview" style={{ maxHeight: 160, borderRadius: 6, border: '1px solid var(--border-dim)', marginTop: 4 }} />
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>Chọn hoặc kéo ảnh vào đây</p>
                    <p style={{ fontSize: 12, color: 'var(--text-sec)' }}>PNG, JPG, GIF hoặc WEBP (tối đa 10MB)</p>
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
                  {[{ val: 'XRAY', label: 'X-Ray' }, { val: 'CT', label: 'CT Scan' }, { val: 'MRI', label: 'MRI' }, { val: 'ULTRASOUND', label: 'Khác' }].map(({ val, label }) => (
                    <button
                      key={val}
                      onClick={() => setUploadModality(val)}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: uploadModality === val ? '1px solid var(--accent)' : '1px solid var(--border-dim)',
                        backgroundColor: uploadModality === val ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                        color: uploadModality === val ? 'var(--accent)' : 'var(--text-sec)',
                        fontSize: 13,
                        fontWeight: 500,
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
          TAB 2 – TRAINING
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

          {!uploadProcessing && (!!uploadedCaseData && sessionData && !isSessionComplete) && (
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
                    setViewMode('upload');
                    setUploadedImage(null);
                    setUploadedCaseData(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-dim)', background: 'transparent', color: 'var(--text-sec)', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
                >
                  ← Upload Ảnh Khác
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
                      <p style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.4 }}>{clinicalHistory || 'Lịch sử lâm sàng không có'}</p>
                    </div>
                  </motion.div>

                  {/* Image */}
                  <motion.div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', backgroundColor: 'var(--bg-base)' }} initial={{ x: -12 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.22 }}>
                    {caseImage ? (
                      <img src={caseImage} alt="Medical Image" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', transform: `translateY(-20px) scale(${zoom})`, transition: 'transform 0.2s', filter: 'grayscale(20%) contrast(1.1)' }} />
                    ) : (
                      <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>Đang tải ảnh...</p>
                    )}
                    {caseImage && (
                      <div style={{ position: 'absolute', bottom: 12, left: 12, display: 'flex', gap: 8, backgroundColor: 'rgba(0, 0, 0, 0.6)', padding: '6px 12px', borderRadius: 6 }}>
                        <button onClick={() => setZoom(Math.max(0.5, zoom - 0.2))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>− Zoom Out</button>
                        <span style={{ color: 'white', fontSize: 11, alignSelf: 'center' }}>{(zoom * 100).toFixed(0)}%</span>
                        <button onClick={() => setZoom(Math.min(3, zoom + 0.2))} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>+ Zoom In</button>
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
                  <motion.div style={{ alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--border-dim)', backgroundColor: 'var(--bg-surface)', flexShrink: 0, display: 'flex' }} initial={{ x: 18 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Tương tác</span>
                    </div>
                  </motion.div>

                  {/* Pipeline Stepper */}
                  <motion.div style={{ padding: '8px 16px', flexShrink: 0, borderBottom: '1px solid var(--border-dim)' }} initial={{ x: 14 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {STEPS.map((step, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              backgroundColor: i <= currentStep ? 'var(--accent)' : 'var(--border-dim)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 10,
                              fontWeight: 700,
                              color: i <= currentStep ? 'var(--primary-foreground)' : 'var(--text-muted)',
                            }}
                          >
                            {i + 1}
                          </div>
                          {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, backgroundColor: i < currentStep ? 'var(--accent)' : 'var(--border-dim)', margin: '0 4px' }} />}
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
                      <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'ai' ? 'flex-start' : 'flex-end', marginBottom: 8 }}>
                        <div
                          style={{
                            maxWidth: '85%',
                            padding: '8px 12px',
                            borderRadius: msg.role === 'ai' ? '8px 12px 12px 0' : '12px 8px 0 12px',
                            backgroundColor: msg.role === 'ai' ? 'var(--bg-surface)' : 'var(--accent)',
                            color: msg.role === 'ai' ? 'var(--text-primary)' : 'var(--primary-foreground)',
                            fontSize: 13,
                            lineHeight: 1.4,
                            wordWrap: 'break-word',
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div style={{ display: 'flex', gap: 4, padding: '8px 12px' }}>
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 0.6, delay: i * 0.1, repeat: Infinity }}
                            style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--accent)' }}
                          />
                        ))}
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </motion.div>

                  {/* Input area */}
                  <motion.div style={{ padding: '8px 16px', flexShrink: 0, borderTop: '1px solid var(--border-dim)', backgroundColor: 'var(--bg-surface)' }} initial={{ y: 12 }} animate={{ y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <textarea
                        value={studentAnswer}
                        onChange={(e) => setStudentAnswer(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) handleSubmitAnswer(); }}
                        placeholder="Nhập câu trả lời của bạn..."
                        rows={2}
                        style={{ flex: 1, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, resize: 'none', outline: 'none' }}
                        onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
                        onBlur={(e) => (e.target.style.borderColor = 'var(--border-dim)')}
                      />
                      <button
                        onClick={handleSubmitAnswer}
                        disabled={submitting || studentAnswer.trim().length < 10}
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          border: 'none',
                          backgroundColor: (submitting || studentAnswer.trim().length < 10) ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--accent)',
                          color: 'var(--primary-foreground)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: (submitting || studentAnswer.trim().length < 10) ? 'not-allowed' : 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        Gửi
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </div>
          )}

          {/* Session complete */}
          {!uploadProcessing && isSessionComplete && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
              <div style={{ textAlign: 'center', maxWidth: 480, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 8, padding: 32 }}>
                <CheckCircle2 size={56} color="var(--success)" style={{ margin: '0 auto 16px' }} />
                <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Hoàn Thành!</h3>
                <p style={{ fontSize: 14, color: 'var(--text-sec)', marginBottom: 24 }}>
                  Bạn đã hoàn thành case "{caseTitle}" với điểm{' '}
                  <strong style={{ color: 'var(--accent)' }}>{(sessionData?.total_score * 100).toFixed(1)}%</strong>
                </p>
                <button
                  onClick={() => {
                    setViewMode('upload');
                    setUploadedImage(null);
                    setUploadedCaseData(null);
                    setMessages([]);
                  }}
                  style={{ width: '100%', padding: '10px', borderRadius: 6, border: 'none', backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  Upload Case Mới
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════════
          FEEDBACK MODAL
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
                  Bước {feedback.attempt.step_index + 1} – {feedback.attempt.step_name}
                </span>
                <button onClick={() => setShowFeedbackDialog(false)} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer' }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '20px' }}>
                {/* Score */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: '50%',
                        backgroundColor: feedback.passed ? 'color-mix(in srgb, var(--success) 13%, transparent)' : 'color-mix(in srgb, var(--accent-dim) 13%, transparent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `2px solid ${feedback.passed ? 'var(--success)' : 'var(--accent-dim)'}`,
                        fontSize: 44,
                        fontWeight: 700,
                        color: feedback.passed ? 'var(--success)' : 'var(--accent-dim)',
                      }}
                    >
                      {(feedback.attempt.score * 100).toFixed(0)}
                    </div>
                  </div>
                </div>

                {/* Message */}
                <div style={{ marginBottom: 16, padding: 12, borderRadius: 6, backgroundColor: feedback.passed ? 'color-mix(in srgb, var(--accent) 13%, transparent)' : 'color-mix(in srgb, var(--accent-dim) 13%, transparent)', border: `1px solid ${feedback.passed ? 'color-mix(in srgb, var(--accent) 27%, transparent)' : 'color-mix(in srgb, var(--accent-dim) 27%, transparent)'}` }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: feedback.passed ? 'var(--success)' : 'var(--accent-dim)', marginBottom: 6 }}>
                    {feedback.passed ? 'Chính xác!' : feedback.attempt.score >= 0.6 ? 'Tốt' : 'Chưa đúng'}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-sec)', lineHeight: 1.5 }}>
                    {feedback.attempt.feedback.content}
                  </p>
                </div>

                {/* Errors */}
                {feedback.attempt.errors.length > 0 && (
                  <div style={{ marginBottom: 16, padding: 12, borderRadius: 6, backgroundColor: 'color-mix(in srgb, var(--error) 5%, transparent)', border: '1px solid color-mix(in srgb, var(--error) 15%, transparent)' }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--error)', marginBottom: 8 }}>Cần cải thiện:</p>
                    <ul style={{ fontSize: 12, color: 'var(--text-sec)', paddingLeft: 16, lineHeight: 1.6 }}>
                      {feedback.attempt.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Retry hint */}
                {feedback.attempt.score < 0.6 && (
                  <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 6, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <RefreshCw size={13} color="var(--accent)" />
                    <p style={{ fontSize: 12, color: 'var(--text-sec)' }}>Hãy thử lại và cải thiện câu trả lời của bạn</p>
                  </div>
                )}

                {/* Time */}
                <div style={{ marginBottom: 20, padding: '10px 14px', borderRadius: 6, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Clock size={13} color="var(--text-sec)" />
                  <p style={{ fontSize: 12, color: 'var(--text-sec)' }}>Thời gian: {feedback.attempt.latency_ms}ms</p>
                </div>

                {/* Continue */}
                <button
                  onClick={handleContinue}
                  disabled={feedback.attempt.score < 0.6}
                  style={{ width: '100%', padding: 12, borderRadius: 6, border: 'none', backgroundColor: feedback.attempt.score < 0.6 ? 'color-mix(in srgb, var(--accent) 40%, transparent)' : 'var(--accent)', color: feedback.attempt.score < 0.6 ? 'var(--text-muted)' : 'var(--primary-foreground)', fontSize: 14, fontWeight: 600, cursor: feedback.attempt.score < 0.6 ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onMouseEnter={(e) => { if (feedback.attempt.score >= 0.6) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
                  onMouseLeave={(e) => { if (feedback.attempt.score >= 0.6) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
                >
                  {feedback.attempt.score < 0.6 ? 'Hãy thử lại' : 'Tiếp tục →'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ════════════════════════════════════════════════════════════════════════
          ANSWER PREVIEW MODAL - Sau upload: chọn Xem đáp án / Thực hành
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
              <div style={{ padding: '24px 20px', textAlign: 'center', borderBottom: '1px solid var(--border-dim)' }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                  Tuyệt vời! 🎉
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text-sec)', lineHeight: 1.5 }}>
                  Ảnh đã được tải lên và AI đã tạo xong 6 bước chẩn đoán. Bạn muốn làm gì tiếp theo?
                </p>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Xem đáp án */}
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleShowAnswers}
                  disabled={loadingAnswers}
                  style={{ padding: '16px', borderRadius: 8, border: '1px solid var(--border-dim)', backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--text-primary)', cursor: loadingAnswers ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loadingAnswers ? 0.6 : 1, transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { if (!loadingAnswers) { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--accent) 18%, transparent)'; } }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-dim)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--accent) 10%, transparent)'; }}
                >
                  {loadingAnswers ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }}><RefreshCw size={16} /></motion.div> Đang tải đáp án...</>
                  ) : (
                    <><BookOpen size={16} /> Xem Đáp Án Tham Khảo</>
                  )}
                </motion.button>

                {/* Thực hành */}
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  onClick={handleStartPractice}
                  style={{ padding: '16px', borderRadius: 8, border: 'none', backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'background-color 0.2s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
                >
                  <PlayCircle size={16} /> Bắt Đầu Thực Hành
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════════════════════
          ANSWER DETAILS MODAL - Carousel 6 bước, ảnh bên trái
      ════════════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showAnswerDetails && stepAnswers && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, backgroundColor: 'color-mix(in srgb, var(--bg-base) 75%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16 }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: -20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              style={{ width: '100%', maxWidth: 1000, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-dim)', borderRadius: 12, overflow: 'hidden', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            >
              {/* Header */}
              <div style={{ padding: '20px', borderBottom: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                    Đáp Án Tham Khảo — {stepAnswers.case_title}
                  </h2>
                  <p style={{ fontSize: 12, color: 'var(--text-sec)' }}>
                    Phương thức: <strong>{mapModality(stepAnswers.case_modality)}</strong>
                  </p>
                </div>
                <button onClick={() => setShowAnswerDetails(false)} style={{ background: 'none', border: 'none', color: 'var(--text-sec)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ height: 4, backgroundColor: 'var(--border-dim)' }}>
                <div style={{ height: '100%', backgroundColor: 'var(--accent)', width: `${((currentAnswerStep + 1) / STEPS.length) * 100}%`, transition: 'width 0.3s ease' }} />
              </div>

              {/* Body: image left + carousel right */}
              <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>
                {/* Image */}
                <div style={{ width: 300, backgroundColor: 'var(--bg-base)', borderRight: '1px solid var(--border-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
                  {uploadedImage ? (
                    <img src={uploadedImage} alt="Case" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 }} />
                  ) : (
                    <p style={{ color: 'var(--text-sec)', fontSize: 13, textAlign: 'center' }}>📷 Không có ảnh</p>
                  )}
                </div>

                {/* Carousel */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 28px', overflowY: 'auto', minHeight: 0 }}>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentAnswerStep}
                      initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
                      transition={{ duration: 0.3 }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
                    >
                      {/* Step badge */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700 }}>
                          {currentAnswerStep + 1}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{STEPS[currentAnswerStep]}</p>
                          <p style={{ fontSize: 11, color: 'var(--text-sec)', margin: '2px 0 0 0' }}>Bước {currentAnswerStep + 1} / {STEPS.length}</p>
                        </div>
                      </div>

                      {/* Reference answer */}
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          📝 Đáp Án Tham Khảo
                        </p>
                        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, backgroundColor: 'var(--bg-base)', padding: '12px', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', minHeight: 70 }}>
                          {stepAnswers.answers?.[STEPS[currentAnswerStep]] || '(Chưa có đáp án)'}
                        </div>
                      </div>

                      {/* Rubric */}
                      {stepAnswers.step_templates?.[currentAnswerStep] && (
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-sec)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            🎯 Tiêu Chí Đánh Giá
                          </p>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.7, backgroundColor: 'var(--bg-base)', padding: '12px', borderRadius: 6, border: '1px solid color-mix(in srgb, var(--success) 20%, transparent)', minHeight: 50 }}>
                            {stepAnswers.step_templates[currentAnswerStep]}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>

              {/* Footer navigation */}
              <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border-dim)', display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setCurrentAnswerStep(Math.max(0, currentAnswerStep - 1))}
                  disabled={currentAnswerStep === 0}
                  style={{ flex: 1, padding: '11px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'transparent', color: currentAnswerStep === 0 ? 'var(--text-muted)' : 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: currentAnswerStep === 0 ? 'not-allowed' : 'pointer', opacity: currentAnswerStep === 0 ? 0.5 : 1, transition: 'all 0.2s' }}
                >
                  ← Quay Lại
                </button>
                <button
                  onClick={() => setShowAnswerDetails(false)}
                  style={{ flex: 1, padding: '11px', borderRadius: 6, border: '1px solid var(--border-dim)', backgroundColor: 'transparent', color: 'var(--text-primary)', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }}
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    if (currentAnswerStep < STEPS.length - 1) {
                      setCurrentAnswerStep(currentAnswerStep + 1);
                    } else {
                      setShowAnswerDetails(false);
                      handleStartPractice();
                    }
                  }}
                  style={{ flex: 1, padding: '11px', borderRadius: 6, border: 'none', backgroundColor: 'var(--accent)', color: 'var(--primary-foreground)', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.2s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent-hover)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--accent)'; }}
                >
                  {currentAnswerStep < STEPS.length - 1 ? 'Tiếp Theo →' : 'Bắt Đầu Thực Hành →'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}