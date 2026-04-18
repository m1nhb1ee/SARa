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

const steps = ["OBSERVE", "DESCRIBE", "INTERPRET", "HYPOTHESIS", "DDx", "CONCLUSION"];

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
  hint?: string;
  message: string;
}

export function DiagnosisSession() {
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId: string }>();
  
  // Fetch case details from API
  const { data: caseData, loading: caseLoading } = useCaseDetail(caseId ? parseInt(caseId) : null);
  
  // Session management
  const [sessionId, setSessionId] = useState<number | null>(null);
  const { data: sessionData, refetch: refetchSession } = useSessionDetail(sessionId);
  const { submitAnswer } = useSubmitAnswer();
  const { exitSession } = useExitSession();
  
  // UI state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<FeedbackResult | null>(null);
  const [shortAnswerError, setShortAnswerError] = useState<string | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<"image" | "chat">("image");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Create session on mount
  useEffect(() => {
    if (!caseId || sessionId) return;
    const create = async () => {
      const response = await fetch(`http://localhost:8000/api/v1/sessions/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ case: parseInt(caseId) })
      });
      if (response.ok) {
        const data = await response.json();
        setSessionId(data.id);
        // Initialize first message - OBSERVE step only, no DESCRIBE mixing
        const step = steps[0];
        setMessages([{
          id: "1",
          role: "ai",
          type: "question",
          content: `Bước 1: Quan sát kỹ hình ảnh. Bạn nhìn thấy những bất thường gì? Hãy xác định vùng bất thường mà bạn nhận thấy.`
        }]);
      }
    };
    create();
  }, [caseId, sessionId]);

  // Scroll to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const currentStep = sessionData?.current_step || 0;
  const stepName = steps[currentStep] || "UNKNOWN";
  const caseImage = caseData?.image_urls?.[0] || "";
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
      
      // Add AI feedback message
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        type: result.passed ? "correct" : "partial",
        content: result.attempt.feedback.content
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
    
    if (nextStepNum !== undefined && nextStepNum < steps.length) {
      const nextStepName = steps[nextStepNum];
      const questionPrompts: Record<number, string> = {
        0: "Bước 1: Quan sát kỹ hình ảnh. Bạn nhìn thấy những bất thường gì? Hãy xác định vùng bất thường.",
        1: "Bước 2: Mô tả chi tiết các đặc điểm của tổn thương bạn quan sát thấy.",
        2: "Bước 3: Diễn giải ý nghĩa lâm sàn của các phát hiện này.",
        3: "Bước 4: Đưa ra giả thuyết chẩn đoán dự phòng.",
        4: "Bước 5: Phân tích các chẩn đoán phân biệt cần loại trừ.",
        5: "Bước 6: Đưa ra kết luận chẩn đoán cuối cùng."
      };
      
      const nextMsg: Message = {
        id: Date.now().toString(),
        role: "ai",
        type: "question",
        content: questionPrompts[nextStepNum] || `Bước ${nextStepNum + 1}: Hãy tiếp tục với bước ${nextStepName}.`
      };
      setMessages((prev) => [...prev, nextMsg]);
      setActiveTab("chat");
    } else {
      navigate(`/answer-key/${caseId}`);
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
    return <div className="text-center py-12">Đang tải case...</div>;
  }

  if (!caseData) {
    return <div className="text-center py-12 text-red-500">Không tìm thấy case</div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: "var(--bg-base)" }}>
      {/* Top case bar */}
      <motion.div
        className="flex items-center gap-3 px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)" }}
        initial={{ x: -24, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>{caseData.title}</span>
        <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)" }}>{caseData.modality}</span>
        <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)" }}>{caseData.difficulty}</span>
        
        {/* Spacer */}
        <div style={{ flex: 1 }}></div>
        
        {/* Exit button */}
        <motion.button
          onClick={handleExitClick}
          disabled={isExiting}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 12px",
            borderRadius: "6px",
            border: "1px solid var(--border-dim)",
            background: "color-mix(in srgb, var(--danger) 8%, transparent)",
            color: "var(--danger)",
            cursor: isExiting ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 500,
            opacity: isExiting ? 0.6 : 1,
            transition: "all 0.2s"
          }}
        >
          <LogOut size={16} />
          Thoát
        </motion.button>
      </motion.div>

      {/* Mobile tab switcher */}
      <motion.div
        className="flex md:hidden shrink-0"
        style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)", padding: "4px 6px" }}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        {[{ key: "image", label: "🖼️ Hình ảnh" }, { key: "chat", label: "💬 Trả lời AI" }].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as "image" | "chat")}
            style={{
              flex: 1,
              padding: "10px",
              fontSize: "13px",
              fontWeight: activeTab === tab.key ? 600 : 500,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: activeTab === tab.key ? "var(--accent)" : "var(--text-sec)",
              borderBottom: "2px solid transparent",
              transition: "color 0.5s, font-weight 0.5s",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {activeTab === tab.key && (
              <motion.span
                layoutId="diagnosis-mobile-tab-indicator"
                transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute",
                  inset: 2,
                  borderRadius: 8,
                  backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                }}
              />
            )}
            <span style={{ position: "relative", zIndex: 1 }}>{tab.label}</span>
          </button>
        ))}
      </motion.div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL – Image Viewer */}
        <motion.div
          className={`flex-col ${activeTab === "image" ? "flex" : "hidden"} md:flex`}
          style={{
            width: "100%",
            maxWidth: "55%",
            borderRight: "1px solid var(--border-dim)",
          }}
          initial={{ x: -28, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Clinical Note */}
          <motion.div className="px-4 pt-2 shrink-0" initial={{ x: -18 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.16 }}>
            <div style={{ borderLeft: "3px solid var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)", borderRadius: "0 6px 6px 0", padding: "8px 12px" }}>
              <p style={{ fontSize: "11px", color: "var(--text-sec)", marginBottom: 2, fontWeight: 500, letterSpacing: "0.04em" }}>BỆNH SỬ</p>
              <p style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5 }}>
                {clinicalHistory || "Đang tải lịch sử lâm sàng..."}
              </p>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div className="flex-1 flex items-center justify-center overflow-hidden relative" style={{ backgroundColor: "var(--bg-base)" }} initial={{ x: -12 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.22 }}>
            {caseImage ? (
              <img
                src={caseImage}
                alt="Medical Image"
                style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", transform: `translateY(-20px) scale(${zoom})`, transition: "transform 0.2s", filter: "grayscale(20%) contrast(1.1)" }}
              />
            ) : (
              <div style={{ color: "var(--text-sec)" }}>Đang tải hình ảnh...</div>
            )}
            
            {/* Zoom controls */}
            {caseImage && (
              <div className="absolute bottom-4 right-4 flex flex-col gap-0" style={{ backgroundColor: "var(--bg-surface)", borderRadius: 8, border: "1px solid var(--border-dim)", overflow: "hidden" }}>
                {[{ icon: ZoomIn, action: () => setZoom((z) => Math.min(z + 0.25, 3)) }, { icon: ZoomOut, action: () => setZoom((z) => Math.max(z - 0.25, 0.5)) }, { icon: Maximize2, action: () => setZoom(1) }].map(({ icon: Icon, action }, i) => (
                  <button key={i} onClick={action} style={{ padding: "8px 10px", backgroundColor: "transparent", border: "none", borderBottom: i < 2 ? "1px solid var(--border-dim)" : "none", color: "var(--text-sec)", cursor: "pointer" }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "color-mix(in srgb, var(--accent) 13%, transparent)")}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </motion.div>

        {/* RIGHT PANEL – Chat */}
        <motion.div
          className={`flex-col ${activeTab === "chat" ? "flex" : "hidden"} md:flex`}
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: "var(--bg-base)",
          }}
          initial={{ x: 28, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Header */}
          <motion.div className="hidden md:flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)" }} initial={{ x: 18 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.18 }}>
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>SARa AI (API)</span>
              <span style={{ padding: "2px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: 500, backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)" }}>OpenAI</span>
            </div>
          </motion.div>

          {/* Pipeline Stepper */}
          <motion.div className="px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }} initial={{ x: 14 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.24 }}>
            <div className="flex items-center justify-between">
              {steps.map((step, i) => (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, transition: "all 0.3s", ...(i < currentStep ? { backgroundColor: "var(--accent)", color: "var(--primary-foreground)" } : i === currentStep ? { backgroundColor: "var(--accent)", color: "var(--primary-foreground)" } : { backgroundColor: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-dim)" }) }}>
                      {i < currentStep ? "✓" : i + 1}
                    </div>
                    <span style={{ fontSize: "8px", fontWeight: 500, letterSpacing: "0.04em", color: i <= currentStep ? "var(--accent)" : "var(--text-muted)" }}>
                      {step}
                    </span>
                  </div>
                  {i < steps.length - 1 && (
                    <div style={{ width: 16, height: 1, backgroundColor: i < currentStep ? "var(--accent)" : "var(--border-dim)", margin: "0 1px", marginBottom: 18, transition: "background-color 0.3s" }} />
                  )}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Step chip */}
          <motion.div className="px-4 py-1 shrink-0" initial={{ x: 10 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.28 }}>
            <span style={{ padding: "3px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, letterSpacing: "0.04em", backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 27%, transparent)" }}>
              Bước {currentStep + 1} – {stepName}
            </span>
          </motion.div>

          {/* Chat area */}
          <motion.div className="flex-1 overflow-y-auto px-4 py-1.5 flex flex-col gap-1.5" initial={{ x: 8 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.34 }}>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" ? (
                  <div style={{ maxWidth: "88%", backgroundColor: "var(--bg-surface)", borderRadius: "8px", padding: "8px 10px", borderLeft: `3px solid ${msg.type === "correct" ? "var(--accent)" : "var(--accent-dim)"}` }}>
                    <div className="flex items-center gap-1 mb-1">
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-sec)" }}>SARa AI</span>
                      {msg.type === "correct" && <span style={{ fontSize: "11px" }}>✓</span>}
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5 }}>{msg.content}</p>
                  </div>
                ) : (
                  <div style={{ maxWidth: "82%", backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", borderRadius: "8px", padding: "8px 10px", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}>
                    <p style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5 }}>{msg.content}</p>
                  </div>
                )}
              </motion.div>
            ))}
            {isTyping && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div style={{ backgroundColor: "var(--bg-surface)", borderRadius: "8px", padding: "8px 12px", borderLeft: "3px solid var(--accent)", display: "flex", gap: 4, alignItems: "center" }}>
                  {[0, 1, 2].map((i) => (
                    <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "var(--accent)" }} />
                  ))}
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </motion.div>

          {/* Input area */}
          <motion.div className="px-4 py-1.5 shrink-0" style={{ borderTop: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)" }} initial={{ y: 12 }} animate={{ y: 0 }} transition={{ duration: 0.5, delay: 0.4 }}>
            <div className="flex gap-2 mb-1">
              <button
                style={{ padding: "4px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 500, backgroundColor: "transparent", border: "1px solid var(--border-dim)", color: "var(--text-sec)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "color-mix(in srgb, var(--accent-dim) 40%, transparent)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)")}
              >
                <Lightbulb size={12} color="var(--accent-dim)" /> Gợi ý
              </button>
            </div>
            {/* Error message for short answer */}
            {shortAnswerError && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-2" style={{ padding: "8px 10px", borderRadius: "6px", backgroundColor: "color-mix(in srgb, #ff4757 13%, transparent)", border: "1px solid color-mix(in srgb, #ff4757 27%, transparent)", display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={13} color="#ff4757" />
                <span style={{ fontSize: "12px", color: "#ff4757", fontWeight: 500 }}>{shortAnswerError}</span>
              </motion.div>
            )}
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Nhập câu trả lời của bạn..."
                rows={2}
                style={{ flex: 1, backgroundColor: "var(--bg-base)", border: "1px solid var(--border-dim)", borderRadius: "8px", padding: "8px 10px", color: "var(--text-primary)", fontSize: "12px", resize: "none", outline: "none", fontFamily: "'Inter', sans-serif" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-dim)")}
              />
              <button
                onClick={handleSend}
                disabled={isTyping || !sessionId}
                style={{ padding: "0 14px", borderRadius: "8px", backgroundColor: "var(--accent)", border: "none", color: "var(--primary-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background-color 0.5s", opacity: isTyping ? 0.5 : 1 }}
                onMouseEnter={(e) => !isTyping && ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)")}
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* FEEDBACK MODAL */}
      <AnimatePresence>
        {showFeedback && lastFeedback && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, backgroundColor: "color-mix(in srgb, var(--bg-base) 75%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ width: "100%", maxWidth: 600, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-dim)", borderRadius: "8px", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                <span style={{ padding: "3px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 27%, transparent)" }}>{lastFeedback.attempt.step_name}</span>
                <button onClick={() => setShowFeedback(false)} style={{ background: "none", border: "none", color: "var(--text-sec)", cursor: "pointer" }}><X size={18} /></button>
              </div>

              <div className="px-5 py-5">
                {/* Score Ring */}
                <div className="flex justify-center mb-5">
                  <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
                    <svg width="100" height="100" style={{ position: "absolute" }}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-dim)" strokeWidth="7" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={lastFeedback.passed ? "var(--accent)" : "var(--accent-dim)"} strokeWidth="7" strokeDasharray={`${(lastFeedback.attempt.score) * 264} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
                    </svg>
                    <div className="flex flex-col items-center">
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "22px", fontWeight: 700, color: lastFeedback.passed ? "var(--accent)" : "var(--accent-dim)", lineHeight: 1 }}>{Math.round(lastFeedback.attempt.score * 100)}</span>
                      <span style={{ fontSize: "10px", color: "var(--text-sec)" }}>/100</span>
                    </div>
                  </div>
                </div>

                {/* Feedback */}
                <div className="mb-4" style={{ padding: "12px", borderRadius: "6px", backgroundColor: lastFeedback.passed ? "color-mix(in srgb, var(--accent) 13%, transparent)" : "color-mix(in srgb, var(--accent-dim) 13%, transparent)", border: `1px solid ${lastFeedback.passed ? "color-mix(in srgb, var(--accent) 27%, transparent)" : "color-mix(in srgb, var(--accent-dim) 27%, transparent)"}` }}>
                  <div className="flex items-center gap-2 mb-2">
                    {lastFeedback.passed ? (
                      <CheckCircle2 size={14} color="var(--accent)" />
                    ) : (
                      <AlertTriangle size={14} color="var(--accent-dim)" />
                    )}
                    <span style={{ fontWeight: 600, fontSize: "13px", color: lastFeedback.passed ? "var(--accent)" : "var(--accent-dim)" }}>
                      {lastFeedback.passed ? "✓ Chính xác!" : "⚠ Cần cải thiện"}
                    </span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.6 }}>
                    {lastFeedback.attempt.feedback.content}
                  </p>
                </div>

                {/* Errors */}
                {lastFeedback.attempt.errors.length > 0 && (
                  <div className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={13} color="var(--accent-dim)" />
                      <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--accent-dim)" }}>Lỗi phát hiện</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {lastFeedback.attempt.errors.map((error, i) => (
                        <span key={i} style={{ padding: "4px 10px", borderRadius: "4px", fontSize: "12px", backgroundColor: "color-mix(in srgb, var(--accent-dim) 13%, transparent)", color: "var(--accent-dim)", border: "1px solid color-mix(in srgb, var(--accent-dim) 20%, transparent)" }}>• {error}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Latency Info */}
                <div className="mb-5" style={{ padding: "10px 14px", borderRadius: "6px", backgroundColor: "var(--bg-base)", border: "1px solid var(--border-dim)", display: "flex", alignItems: "center", gap: 8 }}>
                  <Clock size={13} color="var(--text-sec)" />
                  <div>
                    <p style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-sec)" }}>Thời gian xử lý OpenAI API</p>
                    <p style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600 }}>{lastFeedback.attempt.latency_ms}ms</p>
                  </div>
                </div>

                {/* Low Score Warning */}
                {lastFeedback.attempt.score < 0.6 && (
                  <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mb-4" style={{ padding: "12px", borderRadius: "6px", backgroundColor: "color-mix(in srgb, #ff4757 13%, transparent)", border: "1px solid color-mix(in srgb, #ff4757 27%, transparent)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={14} color="#ff4757" />
                      <span style={{ fontWeight: 600, fontSize: "13px", color: "#ff4757" }}>⚠ Không đủ điểm để tiếp tục</span>
                    </div>
                    <p style={{ fontSize: "12px", color: "#ff4757", lineHeight: 1.5 }}>
                      Bạn cần đạt ít nhất <strong>60/100</strong> điểm để chuyển sang bước tiếp theo. Vui lòng cố gắng lại.
                    </p>
                  </motion.div>
                )}

                {/* CTA */}
                <button 
                  onClick={handleFeedbackContinue}
                  disabled={lastFeedback.attempt.score < 0.6}
                  className="flex items-center justify-center gap-2 w-full"
                  style={{ 
                    padding: "12px", 
                    borderRadius: "6px", 
                    backgroundColor: lastFeedback.attempt.score < 0.6 ? "color-mix(in srgb, var(--accent) 40%, transparent)" : "var(--accent)", 
                    border: "none", 
                    color: lastFeedback.attempt.score < 0.6 ? "var(--text-muted)" : "var(--primary-foreground)", 
                    fontSize: "14px", 
                    fontWeight: 600, 
                    cursor: lastFeedback.attempt.score < 0.6 ? "not-allowed" : "pointer", 
                    transition: "background-color 0.5s",
                    opacity: lastFeedback.attempt.score < 0.6 ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => { if (lastFeedback.attempt.score >= 0.6) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)"; }}
                  onMouseLeave={(e) => { if (lastFeedback.attempt.score >= 0.6) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)"; }}
                >
                  {lastFeedback.attempt.score < 0.6 ? (
                    <>Cần đạt 60 điểm để tiếp tục</>
                  ) : currentStep < steps.length - 1 ? (
                    <>Tiếp tục → Bước {currentStep + 1}: {steps[currentStep]} <ChevronRight size={16} /></>
                  ) : (
                    <>Xem kết quả cuối cùng <ChevronRight size={16} /></>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EXIT CONFIRMATION MODAL */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            onClick={handleCancelExit}
            style={{ 
              position: "fixed", 
              inset: 0, 
              backgroundColor: "color-mix(in srgb, var(--bg-base) 75%, transparent)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              zIndex: 60, 
              padding: 16
            }}
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 10 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              style={{ 
                width: "100%", 
                maxWidth: 400, 
                backgroundColor: "var(--bg-surface)", 
                border: "1px solid var(--border-dim)", 
                borderRadius: "12px", 
                overflow: "hidden"
              }}
            >
              {/* Modal Header */}
              <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                <div className="flex items-center gap-3 mb-2">
                  <div style={{ width: 40, height: 40, borderRadius: "8px", backgroundColor: "color-mix(in srgb, #ff4757 13%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <LogOut size={20} color="#ff4757" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>Thoát khỏi session?</h3>
                    <p style={{ fontSize: "12px", color: "var(--text-sec)", marginTop: 2 }}>Progress sẽ được lưu tự động</p>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="px-6 py-4">
                <div style={{ padding: "12px", borderRadius: "8px", backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)", border: "1px solid color-mix(in srgb, var(--accent) 15%, transparent)", marginBottom: 12 }}>
                  <p style={{ fontSize: "13px", color: "var(--text-primary)", lineHeight: 1.6 }}>
                    Bạn sẽ thoát khỏi luyện tập. Session hiện tại sẽ được lưu ở trạng thái <strong>chưa hoàn thành</strong> và bạn có thể quay lại tiếp tục vào lúc khác.
                  </p>
                </div>

                {/* Info */}
                <div style={{ padding: "10px", borderRadius: "6px", backgroundColor: "var(--bg-base)", border: "1px solid var(--border-dim)", marginBottom: 16 }}>
                  <p style={{ fontSize: "12px", color: "var(--text-sec)", marginBottom: 8 }}>
                    <span style={{ fontWeight: 600 }}>Thông tin session:</span>
                  </p>
                  <div style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                    <p>• Case: {caseData?.title}</p>
                    <p>• Bước hiện tại: {currentStep + 1} / {steps.length} ({stepName})</p>
                    <p>• Được lưu lúc: {new Date().toLocaleString('vi-VN')}</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex gap-3 px-6 py-4" style={{ borderTop: "1px solid var(--border-dim)", backgroundColor: "var(--bg-base)" }}>
                <button
                  onClick={handleCancelExit}
                  disabled={isExiting}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-dim)",
                    backgroundColor: "transparent",
                    color: "var(--text-primary)",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isExiting ? "not-allowed" : "pointer",
                    opacity: isExiting ? 0.6 : 1,
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => { if (!isExiting) (e.currentTarget as HTMLElement).style.backgroundColor = "color-mix(in srgb, var(--accent) 10%, transparent)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
                >
                  Tiếp tục luyện tập
                </button>

                <motion.button
                  onClick={handleConfirmExit}
                  disabled={isExiting}
                  whileHover={{ scale: isExiting ? 1 : 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    flex: 1,
                    padding: "10px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: isExiting ? "color-mix(in srgb, #ff4757 60%, transparent)" : "#ff4757",
                    color: "white",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: isExiting ? "not-allowed" : "pointer",
                    opacity: isExiting ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    transition: "all 0.2s"
                  }}
                >
                  {isExiting ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} style={{ width: 14, height: 14, borderRadius: "50%", borderTop: "2px solid white", borderRight: "2px solid white", borderBottom: "2px solid transparent", borderLeft: "2px solid transparent" }} />
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
