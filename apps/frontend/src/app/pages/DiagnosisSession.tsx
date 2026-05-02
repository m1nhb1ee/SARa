import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Send,
  Lightbulb,
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  LogOut,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useCaseDetail, useSessionDetail, useSubmitAnswer, useExitSession } from "@/api/hooks";
import styles from "@/styles/DiagnosisSession.module.css";
import { VolumeSliceViewer } from "@/app/components/shared/VolumeSliceViewer";
import type { CaseVolume } from "@/types";

const steps = ["OBSERVE", "DESCRIBE", "INTERPRET", "HYPOTHESIS", "DDx", "CONCLUSION"];

const QUESTION_PROMPTS: Record<number, string> = {
  0: "Bước 1: Quan sát kỹ hình ảnh. Bạn nhìn thấy những bất thường gì? Hãy xác định vùng bất thường mà bạn nhận thấy.",
  1: "Bước 2: Mô tả chi tiết các đặc điểm của tổn thương bạn quan sát thấy.",
  2: "Bước 3: Diễn giải ý nghĩa lâm sàn của các phát hiện này.",
  3: "Bước 4: Đưa ra giả thuyết chẩn đoán dự phòng.",
  4: "Bước 5: Phân tích các chẩn đoán phân biệt cần loại trừ.",
  5: "Bước 6: Đưa ra kết luận chẩn đoán cuối cùng.",
};

function buildMessagesFromAttempts(attempts: any[], currentStep: number): Message[] {
  const byStep: Record<number, any> = {};
  for (const a of attempts) {
    const idx = a.step_index;
    if (!byStep[idx] || a.attempt_number > byStep[idx].attempt_number) {
      byStep[idx] = a;
    }
  }

  const msgs: Message[] = [];
  for (let i = 0; i <= currentStep; i++) {
    msgs.push({ id: `resume-q-${i}`, role: "ai", type: "question", content: QUESTION_PROMPTS[i] ?? `Bước ${i + 1}: Tiếp tục.` });
    const attempt = byStep[i];
    if (attempt && i < currentStep) {
      msgs.push({ id: `resume-a-${i}`, role: "student", content: attempt.student_answer });
      const feedbackContent = typeof attempt.feedback === "string" ? attempt.feedback : attempt.feedback?.content ?? "";
      msgs.push({ id: `resume-f-${i}`, role: "ai", type: attempt.score >= 0.6 ? "correct" : "partial", content: feedbackContent });
    }
  }
  return msgs;
}

interface Message {
  id: string;
  role: "ai" | "student";
  content: string;
  type?: "question" | "correct" | "partial" | "incorrect";
}

interface FeedbackResult {
  attempt: {
    id: number;
    step_index: number;
    step_name: string;
    student_answer: string;
    score: number;
    errors: string[];
    feedback: {
      type: "error" | "hint" | "correct";
      content: string;
    };
    latency_ms: number;
  };
  passed: boolean;
  next_step?: number;
  session_complete?: boolean;
  hint?: string;
  message: string;
}

export function DiagnosisSession() {
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId: string }>();

  // Fetch case details from API
  const { data: caseData, loading: caseLoading } = useCaseDetail(caseId ?? null);

  // Session management
  const [sessionId, setSessionId] = useState<string | null>(null);
  const { data: sessionData, refetch: refetchSession } = useSessionDetail(sessionId);
  const { submitAnswer } = useSubmitAnswer();
  const { exitSession } = useExitSession();

  // UI state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<FeedbackResult | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [shortAnswerError, setShortAnswerError] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<"image" | "chat">("image");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Create or resume session on mount
  useEffect(() => {
    if (!caseId || sessionId) return;
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    const token = localStorage.getItem('sara_token') || '';
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    const initSession = async () => {
      // Check for an existing resumable session (PAUSED or IN_PROGRESS) for this case
      const listRes = await fetch(`${API_BASE}/sessions/?case=${caseId}`, { headers });
      if (listRes.ok) {
        const listData = await listRes.json();
        const resumable = (listData.results as any[] ?? []).find(
          (s: any) => s.status === 'ABANDONED' || s.status === 'IN_PROGRESS'
        );
        if (resumable) {
          const detailRes = await fetch(`${API_BASE}/sessions/${resumable.id}/`, { headers });
          if (detailRes.ok) {
            const detail = await detailRes.json();
            // Reactivate ABANDONED session (no-op if already IN_PROGRESS)
            await fetch(`${API_BASE}/sessions/${resumable.id}/resume/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...headers },
            });
            setSessionId(detail.id);
            setMessages(buildMessagesFromAttempts(detail.step_attempts ?? [], detail.current_step ?? 0));
            return;
          }
        }
      }

      // No resumable session — create a new one
      const createRes = await fetch(`${API_BASE}/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ case_id: caseId }),
      });
      if (createRes.ok) {
        const data = await createRes.json();
        setSessionId(data.id);
        setMessages([{ id: "1", role: "ai", type: "question", content: QUESTION_PROMPTS[0] }]);
      }
    };

    initSession();
  }, [caseId, sessionId]);

  // Scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const currentStep = sessionData?.current_step || 0;
  const stepName = steps[currentStep] || "UNKNOWN";
  const caseImages: CaseVolume[] = caseData?.images ?? [];
  const legacyUrl: string = caseData?.image_urls?.[0] ?? '';
  const clinicalHistory = caseData?.clinical_history || "";

  const handleSend = async () => {
    setShortAnswerError(null);
    const trimmedInput = input.trim();

    if (!trimmedInput || !sessionId) return;

    // Validate minimum answer length
    const MIN_ANSWER_LENGTH = 10;
    if (trimmedInput.length < MIN_ANSWER_LENGTH) {
      setShortAnswerError(`Câu trả lời quá ngắn. Vui lòng nhập ít nhất ${MIN_ANSWER_LENGTH} ký tự.`);
      return;
    }

    // Add user message
    const userMsg: Message = { id: Date.now().toString(), role: "student", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    // Call API to submit answer
    const result = await submitAnswer(sessionId, input) as FeedbackResult | null;
    setIsTyping(false);

    if (result) {
      setLastFeedback(result);

      // Add AI feedback message — backend returns feedback as string, not {type,content}
      const feedbackContent = typeof result.attempt.feedback === 'string'
        ? result.attempt.feedback
        : result.attempt.feedback?.content ?? '';
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        type: result.passed ? "correct" : "partial",
        content: feedbackContent,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // Show feedback modal
      setShowFeedback(true);

      // Refetch session to get updated step - wait for it to complete if passed
      if (result.passed || result.attempt.score >= 0.6) {
        // Use next_step from response or refetch after delay
        if (result.next_step !== undefined) {
          // Backend returned next_step, we can use it immediately
          console.log(`Backend provided next_step: ${result.next_step}`);
        }
        // Still refetch to ensure sync
        setTimeout(() => refetchSession(), 300);
      }
    }
  };

  const handleFeedbackContinue = async () => {
    // Check if score is too low to advance
    if (lastFeedback && lastFeedback.attempt.score < 0.6) {
      return; // Don't allow advancing if score < 60
    }

    setShowFeedback(false);

    // Wait for next step data - use result.next_step from API if available
    let nextStepNum = lastFeedback?.next_step;

    if (nextStepNum === undefined) {
      // Fallback: refetch session to get updated step
      await new Promise(resolve => setTimeout(resolve, 200));
      await refetchSession();
      // After refetch, sessionData should be updated in component state
      // But we need to check if current_step exists in the updated data
      nextStepNum = sessionData?.current_step;
    }

    // Session complete — show completion popup instead of navigating
    if (lastFeedback?.session_complete) {
      await refetchSession();
      setShowCompletion(true);
      return;
    }

    if (nextStepNum !== undefined && nextStepNum < steps.length) {
      const nextStepName = steps[nextStepNum];
      const nextMsg: Message = {
        id: Date.now().toString(),
        role: "ai",
        type: "question",
        content: QUESTION_PROMPTS[nextStepNum] || `Bước ${nextStepNum + 1}: Hãy tiếp tục với bước ${nextStepName}.`
      };
      setMessages((prev) => [...prev, nextMsg]);
      setActiveTab("chat");
    }
  };

  const handleExitClick = () => {
    setShowExitModal(true);
  };

  const handleConfirmExit = async () => {
    if (!sessionId) return;

    setIsExiting(true);
    const result = await exitSession(sessionId);
    setIsExiting(false);

    if (result) {
      // Exit was successful, navigate to sessions list
      navigate('/');
    }
  };

  const handleCancelExit = () => {
    setShowExitModal(false);
  };

  if (caseLoading) {
    return <div className={styles.loadingState}>Đang tải case...</div>;
  }

  if (!caseData) {
    return <div className={styles.errorState}>Không tìm thấy case</div>;
  }

  return (
    <div className={styles.session}>
      {/* ── TOP CASE BAR ── */}
      <motion.div
        className={styles.topBar}
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className={styles.caseTitle}>{caseData.title}</span>
        <span className={styles.badge}>{caseData.modality}</span>
        <span className={styles.badge}>{caseData.difficulty}</span>

        <div className={styles.topBarSpacer} />

        <motion.button
          onClick={handleExitClick}
          disabled={isExiting}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className={styles.exitBtn}
        >
          <LogOut size={14} />
          Thoát
        </motion.button>
      </motion.div>

      {/* ── MOBILE TAB SWITCHER ── */}
      <motion.div
        className={styles.mobileTabs}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        {[{ key: "image", label: "Hình ảnh" }, { key: "chat", label: "Trả lời AI" }].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "image" | "chat")}
            className={`${styles.mobileTab} ${activeTab === tab.key ? styles.mobileTabActive : styles.mobileTabInactive}`}
          >
            {activeTab === tab.key && (
              <motion.span
                layoutId="diagnosis-mobile-tab-indicator"
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={styles.mobileTabIndicator}
              />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>{tab.label}</span>
          </button>
        ))}
      </motion.div>

      {/* ── MAIN CONTENT ── */}
      <div className={styles.mainContent}>

        {/* ── LEFT PANEL – Image Viewer ── */}
        <motion.div
          className={`${styles.leftPanel} ${activeTab !== "image" ? styles.leftPanelHidden : ""}`}
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Corner fold effect — matches design template */}
          <div className={styles.pageCornerFold} />

          {/* Case #xxx stamp */}
          <motion.div
            className={styles.caseStampRow}
            initial={{ x: -8, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.16 }}
          >
            <span className={styles.caseStampLabel}>
              Case #{(caseId ?? '').slice(0, 8).toUpperCase()}
            </span>
          </motion.div>

          {/* Image Area — fills remaining space as a square */}
          <motion.div
            className={styles.imageArea}
            initial={{ x: -8 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className={styles.imageMount}>
              <div className={styles.imageCornerTL} />
              <div className={styles.imageCornerTR} />
              <div className={styles.imageCornerBL} />
              <div className={styles.imageCornerBR} />
              {(caseImages.length > 0 || legacyUrl) ? (
                <>
                  <VolumeSliceViewer
                    images={caseImages}
                    legacyUrl={legacyUrl}
                    zoom={zoom}
                    imgClassName={styles.medicalImage}
                  />
                  <div className={styles.zoomControls}>
                    {[
                      { icon: ZoomIn,    action: () => setZoom((z) => Math.min(z + 0.25, 3)) },
                      { icon: ZoomOut,   action: () => setZoom((z) => Math.max(z - 0.25, 0.5)) },
                      { icon: Maximize2, action: () => setZoom(1) },
                    ].map(({ icon: Icon, action }, i) => (
                      <button key={i} onClick={action} className={styles.zoomBtn}>
                        <Icon size={14} />
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <p className={styles.imagePlaceholder}>[ Đang tải hình ảnh... ]</p>
              )}
            </div>
          </motion.div>

          {/* Clinical History — fixed at bottom, full width */}
          <div className={styles.imageCaption}>
            <div className={styles.imageCaptionLabel}>Clinical History</div>
            <p className={styles.imageCaptionText}>
              {clinicalHistory || 'Loading clinical history...'}
            </p>
          </div>
        </motion.div>

        {/* ── RIGHT PANEL – Chat ── */}
        <motion.div
          className={`${styles.rightPanel} ${activeTab !== "chat" ? styles.rightPanelHidden : ""}`}
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Panel Header */}
          <motion.div
            className={styles.panelHeader}
            initial={{ x: 12 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className={styles.panelHeaderTitle}>SARa AI</span>
              <span className={styles.panelHeaderBadge}>OpenAI</span>
            </div>
          </motion.div>

          {/* Pipeline Stepper */}
          <motion.div
            className={styles.stepper}
            initial={{ x: 10 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
          >
            <div className={styles.stepperTrack}>
              {steps.map((step, i) => (
                <div key={step} style={{ display: "flex", alignItems: "center" }}>
                  <div className={styles.stepItem}>
                    <div className={
                      i < currentStep
                        ? styles.stepCircleDone
                        : i === currentStep
                          ? styles.stepCircleActive
                          : styles.stepCircleIdle
                    }>
                      {i < currentStep ? "✓" : i + 1}
                    </div>
                    <span className={`${styles.stepLabel} ${i <= currentStep ? styles.stepLabelActive : styles.stepLabelIdle}`}>
                      {step}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div className={i < currentStep ? styles.stepConnectorDone : styles.stepConnectorIdle} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Step Chip */}
          <motion.div
            className={styles.stepChip}
            initial={{ x: 8 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.5, delay: 0.28 }}
          >
            <span className={styles.stepChipInner}>
              Bước {currentStep + 1} – {stepName}
            </span>
          </motion.div>

          {/* Chat Area */}
          <motion.div
            className={styles.chatArea}
            initial={{ x: 6 }}
            animate={{ x: 0 }}
            transition={{ duration: 0.5, delay: 0.34 }}
          >
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className={msg.role === "student" ? styles.studentMessageWrapper : styles.aiMessageWrapper}
              >
                {msg.role === "ai" ? (
                  <div className={`${styles.aiMessage} ${msg.type === "correct" ? styles.aiMessageCorrect : ""}`}>
                    <div className={styles.aiMessageHeader}>
                      <span className={styles.aiMessageAuthor}>Dr. AI's Notes</span>
                      {msg.type === "correct" && <span style={{ fontSize: 11 }}>✓</span>}
                    </div>
                    <p className={styles.aiMessageText}>{msg.content}</p>
                  </div>
                ) : (
                  <div className={styles.studentMessage}>
                    <p className={styles.studentMessageText}>{msg.content}</p>
                  </div>
                )}
              </motion.div>
            ))}

            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.typingWrapper}>
                <div className={styles.typingBubble}>
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      className={styles.typingDot}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </motion.div>

          {/* Input Area */}
          <motion.div
            className={styles.inputArea}
            initial={{ y: 12 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <div className={styles.inputToolbar}>
              <button className={styles.hintButton}>
                <Lightbulb size={12} />
                Gợi ý
              </button>
            </div>

            {shortAnswerError && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className={styles.shortAnswerError}
              >
                <AlertTriangle size={13} color="#A93226" />
                <span className={styles.shortAnswerErrorText}>{shortAnswerError}</span>
              </motion.div>
            )}

            <div className={styles.inputRow}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Ghi chú quan sát của bạn..."
                rows={3}
                className={styles.textarea}
              />
              <button
                onClick={handleSend}
                disabled={isTyping || !sessionId}
                className={styles.sendButton}
              >
                <Send size={14} />
                Submit Diagnosis
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── FEEDBACK MODAL ── */}
      <AnimatePresence>
        {showFeedback && lastFeedback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.modalOverlay}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 8 }}
              className={styles.feedbackCard}
            >
              {/* Modal Header */}
              <div className={styles.feedbackCardHeader}>
                <span className={styles.feedbackStepChip}>{lastFeedback.attempt.step_name}</span>
                <button onClick={() => setShowFeedback(false)} className={styles.feedbackCloseBtn}>
                  <X size={18} />
                </button>
              </div>

              <div className={styles.feedbackBody}>
                {/* Score Ring */}
                <div className={styles.scoreRingWrapper}>
                  <div className={styles.scoreRingInner}>
                    <svg width="100" height="100" className={styles.scoreRingSvg}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="#C4A882" strokeWidth="6" />
                      <circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke={lastFeedback.passed ? "#C0392B" : "#C4A882"}
                        strokeWidth="6"
                        strokeDasharray={`${lastFeedback.attempt.score * 264} 264`}
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                    </svg>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span className={`${styles.scoreValue} ${lastFeedback.passed ? styles.scoreValuePassed : styles.scoreValueFailed}`}>
                        {Math.round(lastFeedback.attempt.score * 100)}
                      </span>
                      <span className={styles.scoreUnit}>/100</span>
                    </div>
                  </div>
                </div>

                {/* Feedback Sticky Note */}
                <div className={`${styles.feedbackStickyNote} ${lastFeedback.passed ? styles.feedbackStickyNotePassed : styles.feedbackStickyNoteFailed}`}>
                  <div className={styles.feedbackNoteHeader}>
                    {lastFeedback.passed
                      ? <CheckCircle2 size={14} color="#7D9B76" />
                      : <AlertTriangle size={14} color="#C4A882" />
                    }
                    <span className={`${styles.feedbackNoteTitle} ${lastFeedback.passed ? styles.feedbackNoteTitlePassed : styles.feedbackNoteTitleFailed}`}>
                      {lastFeedback.passed ? "Dr. AI's Notes — Correct!" : "Dr. AI's Notes — Need Improvement"}
                    </span>
                  </div>
                  <p className={styles.feedbackNoteText}>{typeof lastFeedback.attempt.feedback === 'string' ? lastFeedback.attempt.feedback : lastFeedback.attempt.feedback?.content}</p>
                </div>

                {/* Errors */}
                {lastFeedback.attempt.errors.length > 0 && (
                  <div className={styles.feedbackErrors}>
                    <div className={styles.feedbackErrorsHeader}>
                      <AlertTriangle size={13} color="#A93226" />
                      <span className={styles.feedbackErrorsTitle}>Errors</span>
                    </div>
                    <div className={styles.feedbackErrorTags}>
                      {lastFeedback.attempt.errors.map((error, i) => (
                        <span key={i} className={styles.feedbackErrorTag}>• {error}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Latency */}
                <div className={styles.feedbackLatency}>
                  <Clock size={13} color="#6B4C3B" />
                  <div>
                    <p className={styles.feedbackLatencyLabel}>Thời gian xử lý OpenAI API</p>
                    <p className={styles.feedbackLatencyValue}>{lastFeedback.attempt.latency_ms}ms</p>
                  </div>
                </div>

                {/* Low Score Warning */}
                {lastFeedback.attempt.score < 0.6 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={styles.feedbackLowScoreWarning}
                  >
                    <div className={styles.feedbackLowScoreHeader}>
                      <AlertTriangle size={14} color="#C0392B" />
                      <span className={styles.feedbackLowScoreTitle}>Không đủ điểm để tiếp tục</span>
                    </div>
                    <p className={styles.feedbackLowScoreText}>
                      Bạn cần đạt ít nhất <strong>60/100</strong> điểm để chuyển sang bước tiếp theo. Vui lòng cố gắng lại.
                    </p>
                  </motion.div>
                )}

                {/* CTA */}
                <button
                  onClick={handleFeedbackContinue}
                  disabled={lastFeedback.attempt.score < 0.6}
                  className={`${styles.continueButton} ${lastFeedback.attempt.score < 0.6 ? styles.continueButtonDisabled : styles.continueButtonEnabled}`}
                >
                  {lastFeedback.attempt.score < 0.6 ? (
                    <>Cần đạt 60 điểm để tiếp tục</>
                  ) : currentStep < steps.length - 1 ? (
                    <>Tiếp tục → Bước {currentStep + 1}: {steps[currentStep]} <ChevronRight size={15} /></>
                  ) : (
                    <>Xem kết quả cuối cùng <ChevronRight size={15} /></>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COMPLETION MODAL ── */}
      <AnimatePresence>
        {showCompletion && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.exitModalOverlay}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className={styles.exitModalCard}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className={styles.exitModalHeader}>
                <div className={styles.exitModalHeaderRow}>
                  <div className={`${styles.exitModalIcon}`} style={{ background: 'rgba(125,155,118,0.15)', border: '1px solid #7D9B76' }}>
                    <CheckCircle2 size={20} color="#7D9B76" />
                  </div>
                  <div>
                    <h3 className={styles.exitModalTitle}>Hoàn thành!</h3>
                    <p className={styles.exitModalSubtitle}>{caseData?.title}</p>
                  </div>
                </div>
              </div>

              {/* Body — score */}
              <div className={styles.exitModalBody}>
                <div className={styles.exitModalNote} style={{ textAlign: 'center', padding: '20px 12px', transform: 'rotate(0deg)' }}>
                  <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--vj-faded)', marginBottom: 8 }}>
                    Điểm trung bình
                  </div>
                  <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 48, fontWeight: 700, color: 'var(--vj-ink)', lineHeight: 1 }}>
                    {sessionData?.final_score != null
                      ? Math.round(sessionData.final_score * 100)
                      : '—'}
                  </div>
                  <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: 'var(--vj-faded)', marginTop: 4 }}>
                    / 100
                  </div>
                </div>

                <div className={styles.exitModalInfo} style={{ marginTop: 14 }}>
                  <div className={styles.exitModalInfoLabel}>Kết quả</div>
                  <div className={styles.exitModalInfoDetails}>
                    {steps.map((s, i) => (
                      <span key={s} style={{ display: 'inline-block', marginRight: 6 }}>
                        <span style={{ color: 'var(--vj-terracotta)' }}>✓</span> {s}{i < steps.length - 1 ? ' ·' : ''}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={styles.exitModalFooter}>
                <button
                  onClick={() => { setShowCompletion(false); navigate('/'); }}
                  className={styles.exitModalCancelBtn}
                >
                  Về trang chính
                </button>
                <button
                  onClick={() => { setShowCompletion(false); navigate(`/answer-key/${caseId}`); }}
                  className={styles.exitModalConfirmBtn}
                >
                  Xem đáp án chi tiết
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EXIT CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancelExit}
            className={styles.exitModalOverlay}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className={styles.exitModalCard}
            >
              {/* Header */}
              <div className={styles.exitModalHeader}>
                <div className={styles.exitModalHeaderRow}>
                  <div className={styles.exitModalIcon}>
                    <LogOut size={20} color="#A93226" />
                  </div>
                  <div>
                    <h3 className={styles.exitModalTitle}>Thoát khỏi session?</h3>
                    <p className={styles.exitModalSubtitle}>Progress sẽ được lưu tự động</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className={styles.exitModalBody}>
                <div className={styles.exitModalNote}>
                  <p className={styles.exitModalNoteText}>
                    Bạn sẽ thoát khỏi luyện tập. Session hiện tại sẽ được lưu ở trạng thái{" "}
                    <strong>chưa hoàn thành</strong> và bạn có thể quay lại tiếp tục vào lúc khác.
                  </p>
                </div>

                <div className={styles.exitModalInfo}>
                  <p className={styles.exitModalInfoLabel}>Thông tin session</p>
                  <div className={styles.exitModalInfoDetails}>
                    <p>• Case: {caseData?.title}</p>
                    <p>• Bước hiện tại: {currentStep + 1} / {steps.length} ({stepName})</p>
                    <p>• Được lưu lúc: {new Date().toLocaleString('vi-VN')}</p>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={styles.exitModalFooter}>
                <button
                  onClick={handleCancelExit}
                  disabled={isExiting}
                  className={styles.exitModalCancelBtn}
                >
                  Tiếp tục luyện tập
                </button>

                <motion.button
                  onClick={handleConfirmExit}
                  disabled={isExiting}
                  whileHover={{ scale: isExiting ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={styles.exitModalConfirmBtn}
                >
                  {isExiting ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity }}
                        style={{ width: 14, height: 14, borderRadius: "50%", borderTop: "2px solid #F5EDD6", borderRight: "2px solid #F5EDD6", borderBottom: "2px solid transparent", borderLeft: "2px solid transparent" }}
                      />
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <LogOut size={14} />
                      Thoát và lưu
                    </>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
