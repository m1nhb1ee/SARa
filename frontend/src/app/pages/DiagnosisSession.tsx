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
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const XRAY_IMG =
  "https://images.unsplash.com/photo-1616012480717-fd9867059ca0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=900";

const steps = ["OBSERVE", "DESCRIBE", "INTERPRET", "HYPOTHESIS", "DDx", "CONCLUSION"];

interface Message {
  id: string;
  role: "ai" | "student";
  content: string;
  type?: "question" | "correct" | "partial" | "incorrect";
}

const initialMessages: Message[] = [
  {
    id: "1",
    role: "ai",
    content:
      "H�y quan s�t k? h�nh ?nh. B?n nh?n th?y di?u g� b?t thu?ng ? v�ng thu? du?i ph?i ph?i? M� t? nh?ng g� b?n th?y.",
    type: "question",
  },
];

const stepResponses: Record<number, { ai: string; type: "correct" | "partial" | "incorrect" }> = {
  0: {
    ai: "T?t! B?n d� x�c d?nh d�ng v? tr�. B�y gi? h�y m� t? d?c di?m c?a b? t?n thuong � r� hay kh�ng r�?",
    type: "correct",
  },
  1: {
    ai: "B?n m� t? b? kh�ng r� l� d�ng hu?ng. H�y ti?p t?c � v�ng d?c n�y chi?m bao nhi�u ph?n c?a tru?ng ph?i? V� g�c su?n ho�nh c� b? xo� kh�ng?",
    type: "correct",
  },
  2: {
    ai: "D?a tr�n c�c d?c di?m m� t?, b?n di?n gi?i t?n thuong n�y l� g�? ��y l� d?u hi?u c?a t�nh tr?ng n�o?",
    type: "partial",
  },
  3: {
    ai: "Gi? thuy?t c?a b?n h?p l�. Li?t k� c�c nguy�n nh�n c� th? g�y ra h�nh ?nh n�y theo th? t? kh? nang.",
    type: "correct",
  },
  4: {
    ai: "T?t! B�y gi? h�y ph�n t�ch v� lo?i tr? t?ng nguy�n nh�n d?a tr�n l�m s�ng v� h�nh ?nh h?c.",
    type: "correct",
  },
};

const feedbackData: Record<number, { stepLabel: string; score: number; correct: string[]; improve: string[]; tip: string }> = {
  0: {
    stepLabel: "OBSERVE � Bu?c 1",
    score: 85,
    correct: ["X�c d?nh d�ng v? tr� t?n thuong", "Nh?n ra v�ng d?c tang �m", "Ph�t hi?n b?t thu?ng g�c du?i ph?i ph?i"],
    improve: ["Chua d? c?p d?n hi?u ?ng kh� ph? qu?n", "B? s�t d�nh gi� v�ng r?n ph?i"],
    tip: "Lu�n quan s�t theo nguy�n t?c ABCDE: Airway, Bones, Cardiac, Diaphragm, Edges c?a tru?ng ph?i.",
  },
  1: {
    stepLabel: "DESCRIBE � Bu?c 2",
    score: 75,
    correct: ["M� t? b? t?n thuong kh�ng r�", "Nh?n x�t d�ng v? d?c di?m d?c"],
    improve: ["Chua m� t? d? r� c?a b? t?n thuong d?y d?", "B? s�t d?c di?m ph�n b? bilateral/unilateral"],
    tip: "Khi m� t? t?n thuong, nh? c�c y?u t?: v? tr�, k�ch thu?c, h�nh d?ng, b?, m?t d? v� hi?u ?ng xung quanh.",
  },
  2: {
    stepLabel: "INTERPRET � Bu?c 3",
    score: 70,
    correct: ["Di?n gi?i d�ng hu?ng vi�m nhi?m", "Li�n k?t du?c v?i l�m s�ng"],
    improve: ["Chua ph�n bi?t du?c pattern consolidation vs ground glass", "Thi?u nh?n x�t v? air bronchogram sign"],
    tip: "Consolidation thu?ng g?p trong vi�m ph?i, trong khi ground glass opacity g?i � t?n thuong s?m ho?c interstitial.",
  },
  3: {
    stepLabel: "HYPOTHESIS � Bu?c 4",
    score: 80,
    correct: ["�ua ra gi? thuy?t vi�m ph?i ph� h?p", "C�n nh?c d?n lao ph?i"],
    improve: ["Chua x�t d?n kh? nang ung thu ph?i g�y t?c ngh?n sau", "Thi?u d? c?p d?n vi�m ph?i h�t (aspiration)"],
    tip: "Lu�n l?p danh s�ch ch?n do�n ph�n bi?t theo t?n su?t g?p v� m?c d? nguy hi?m (must not miss).",
  },
  4: {
    stepLabel: "DDx � Bu?c 5",
    score: 68,
    correct: ["Lo?i tr? d�ng tr�n d?ch m�ng ph?i", "Ph�n t�ch logic"],
    improve: ["L?p lu?n lo?i tr? Atelectasis chua d? can c?", "Chua d�ng ti�u ch� l�m s�ng d? h? tr? lo?i tr?"],
    tip: "�? lo?i tr? ch?n do�n, c?n d�ng c? b?ng ch?ng h�nh ?nh h?c V� l�m s�ng. M?t m�nh h�nh ?nh thu?ng kh�ng d?.",
  },
  5: {
    stepLabel: "CONCLUSION � Bu?c 6",
    score: 90,
    correct: ["K?t lu?n d�ng ch?n do�n vi�m ph?i thu? du?i ph?i", "�? xu?t hu?ng x? tr� ph� h?p", "Tr�nh b�y r� r�ng, logic"],
    improve: ["C� th? b? sung th�m g?i � c?n l�m s�ng x�c nh?n"],
    tip: "K?t lu?n ch?n do�n t?t c?n: ch?n do�n ch�nh + ch?n do�n ph�n bi?t c�n l?i + hu?ng x? tr� ti?p theo.",
  },
};

export function DiagnosisSession() {
  const navigate = useNavigate();
  const { caseId } = useParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isTyping, setIsTyping] = useState(false);
  const [feedbackStep, setFeedbackStep] = useState(0);
  const [activeTab, setActiveTab] = useState<"image" | "chat">("image");
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "student", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      const resp = stepResponses[currentStep];
      if (resp) {
        const aiMsg: Message = { id: (Date.now() + 1).toString(), role: "ai", content: resp.ai, type: resp.type };
        setMessages((prev) => [...prev, aiMsg]);
        setTimeout(() => { setFeedbackStep(currentStep); setShowFeedback(true); }, 800);
      }
    }, 1500);
  };

  const handleFeedbackContinue = () => {
    setShowFeedback(false);
    if (currentStep < steps.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      const nextQuestions: Record<number, string> = {
        1: "B�y gi? h�y m� t? chi ti?t hon v? d?c di?m t?n thuong: b?, m?t d?, v� c�c d?u hi?u d?c bi?t b?n quan s�t du?c.",
        2: "D?a tr�n m� t? c?a b?n, h�y di?n gi?i � t?n thuong n�y c� � nghia b?nh l� g�?",
        3: "T? di?n gi?i d�, b?n c� th? dua ra gi? thuy?t b?nh l� n�o? T?i sao?",
        4: "Li?t k� �t nh?t 3 ch?n do�n ph�n bi?t v� l?p lu?n lo?i tr? t?ng c�i.",
        5: "D?a tr�n to�n b? ph�n t�ch, h�y dua ra k?t lu?n ch?n do�n cu?i c�ng v� d? xu?t hu?ng x? tr�.",
      };
      const aiMsg: Message = { id: Date.now().toString(), role: "ai", content: nextQuestions[nextStep] || "H�y ti?p t?c bu?c ti?p theo.", type: "question" };
      setMessages((prev) => [...prev, aiMsg]);
      setActiveTab("chat");
    } else {
      navigate(`/answer-key/${caseId}`);
    }
  };

  const feedback = feedbackData[feedbackStep];
  const scoreColor = feedback?.score >= 90 ? "var(--accent)" : feedback?.score >= 60 ? "var(--accent-dim)" : "var(--accent-dim)";

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
        <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)" }}>Vi�m ph?i thu? du?i ph?i</span>
        <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)" }}>X-RAY</span>
        <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)" }}>Co b?n</span>
      </motion.div>

      {/* Mobile tab switcher */}
      <motion.div
        className="flex md:hidden shrink-0"
        style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)", padding: "4px 6px" }}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        {[{ key: "image", label: "??? H�nh ?nh" }, { key: "chat", label: "?? Socratic AI" }].map((tab) => (
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

        {/* LEFT PANEL � Image Viewer */}
        <motion.div
          className={`flex-col ${activeTab === "image" ? "flex" : "hidden"} md:flex`}
          style={{
            width: "100%",
            maxWidth: "55%",
            borderRight: "1px solid var(--border-dim)",
            animation: activeTab === "image" ? "tab-panel-slide-left 0.5s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
          }}
          initial={{ x: -28, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Clinical Note */}
          <motion.div className="px-4 pt-2 shrink-0" initial={{ x: -18 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.16 }}>
            <div style={{ borderLeft: "3px solid var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 5%, transparent)", borderRadius: "0 6px 6px 0", padding: "8px 12px" }}>
              <p style={{ fontSize: "11px", color: "var(--text-sec)", marginBottom: 2, fontWeight: 500, letterSpacing: "0.04em" }}>B?NH S?</p>
              <p style={{ fontSize: "12px", color: "var(--text-primary)", lineHeight: 1.5 }}>
                B?nh nh�n nam 45 tu?i, ho k�o d�i 2 tu?n, s?t nh? v? chi?u. B?ch c?u 12.5 � 10�/�L. SpO2 94%.
              </p>
            </div>
          </motion.div>

          {/* Image */}
          <motion.div className="flex-1 flex items-center justify-center overflow-hidden relative" style={{ backgroundColor: "var(--bg-base)" }} initial={{ x: -12 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.22 }}>
            <img
              src={XRAY_IMG}
              alt="Chest X-Ray"
              style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", transform: `translateY(-20px) scale(${zoom})`, transition: "transform 0.2s", filter: "grayscale(20%) contrast(1.1)" }}
            />
            {/* Zoom controls */}
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
          </motion.div>
        </motion.div>

        {/* RIGHT PANEL � Socratic AI */}
        <motion.div
          className={`flex-col ${activeTab === "chat" ? "flex" : "hidden"} md:flex`}
          style={{
            flex: 1,
            minWidth: 0,
            backgroundColor: "var(--bg-base)",
            animation: activeTab === "chat" ? "tab-panel-slide-right 0.5s cubic-bezier(0.22, 1, 0.36, 1)" : undefined,
          }}
          initial={{ x: 28, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Header � desktop only */}
          <motion.div className="hidden md:flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)" }} initial={{ x: 18 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.18 }}>
            <div className="flex items-center gap-2">
              <span style={{ fontWeight: 600, fontSize: "15px", color: "var(--text-primary)" }}>Socratic AI</span>
              {/* <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "10px", fontWeight: 500, backgroundColor: "var(--border-dim)", color: "var(--text-sec)" }}>Powered by Claude</span> */}
            </div>
          </motion.div>

          {/* Pipeline Stepper */}
          <motion.div className="px-4 py-2 shrink-0" style={{ borderBottom: "1px solid var(--border-dim)" }} initial={{ x: 14 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.24 }}>
            <div className="flex items-center justify-between">
              {steps.map((step, i) => (
                <div key={step} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                  <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 700, transition: "all 0.3s", ...(i < currentStep ? { backgroundColor: "var(--accent)", color: "var(--primary-foreground)" } : i === currentStep ? { backgroundColor: "var(--accent)", color: "var(--primary-foreground)" } : { backgroundColor: "transparent", color: "var(--text-muted)", border: "1px solid var(--border-dim)" }) }}>
                      {i < currentStep ? "?" : i + 1}
                    </div>
                    <span style={{ fontSize: "8px", fontWeight: 500, letterSpacing: "0.04em", color: i <= currentStep ? (i < currentStep ? "var(--accent)" : "var(--accent)") : "var(--text-muted)" }}>
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
              Bu?c {currentStep + 1} � {steps[currentStep]}
            </span>
          </motion.div>

          {/* Chat area */}
          <motion.div className="flex-1 overflow-y-auto px-4 py-1.5 flex flex-col gap-1.5" initial={{ x: 8 }} animate={{ x: 0 }} transition={{ duration: 0.5, delay: 0.34 }}>
            {messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex ${msg.role === "student" ? "justify-end" : "justify-start"}`}>
                {msg.role === "ai" ? (
                  <div style={{ maxWidth: "88%", backgroundColor: "var(--bg-surface)", borderRadius: "8px", padding: "8px 10px", borderLeft: `3px solid ${msg.type === "correct" ? "var(--accent)" : msg.type === "partial" ? "var(--accent-dim)" : msg.type === "incorrect" ? "var(--accent-dim)" : "var(--accent)"}` }}>
                    <div className="flex items-center gap-1 mb-1">
                      <span style={{ fontSize: "10px", fontWeight: 600, color: "var(--text-sec)" }}>SARa AI</span>
                      {msg.type === "correct" && <span style={{ fontSize: "11px" }}>?</span>}
                      {msg.type === "partial" && <span style={{ fontSize: "11px" }}>??</span>}
                      {msg.type === "incorrect" && <span style={{ fontSize: "11px" }}>?</span>}
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
                <Lightbulb size={12} color="var(--accent-dim)" /> ?? G?i �
              </button>
            </div>
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder="Nh?p c�u tr? l?i c?a b?n..."
                rows={2}
                style={{ flex: 1, backgroundColor: "var(--bg-base)", border: "1px solid var(--border-dim)", borderRadius: "8px", padding: "8px 10px", color: "var(--text-primary)", fontSize: "12px", resize: "none", outline: "none", fontFamily: "'Inter', sans-serif" }}
                onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border-dim)")}
              />
              <button
                onClick={handleSend}
                style={{ padding: "0 14px", borderRadius: "8px", backgroundColor: "var(--accent)", border: "none", color: "var(--primary-foreground)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background-color 0.5s" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)")}
              >
                <Send size={16} />
              </button>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* On mobile, when showing image tab, show a "Go to Chat" floating button */}
      {activeTab === "image" && (
        <div className="flex md:hidden fixed bottom-4 right-4 z-40">
          <button
            onClick={() => setActiveTab("chat")}
            style={{ padding: "10px 18px", borderRadius: "24px", backgroundColor: "var(--accent)", border: "none", color: "var(--primary-foreground)", fontSize: "13px", fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px color-mix(in srgb, var(--accent) 40%, transparent)", display: "flex", alignItems: "center", gap: 8 }}
          >
            ?? Tr? l?i AI
          </button>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      <AnimatePresence>
        {showFeedback && feedback && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: "fixed", inset: 0, backgroundColor: "color-mix(in srgb, var(--bg-base) 75%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} style={{ width: "100%", maxWidth: 600, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-dim)", borderRadius: "8px", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-dim)" }}>
                <span style={{ padding: "3px 12px", borderRadius: "4px", fontSize: "12px", fontWeight: 600, letterSpacing: "0.04em", backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 27%, transparent)" }}>{feedback.stepLabel}</span>
                <button onClick={() => setShowFeedback(false)} style={{ background: "none", border: "none", color: "var(--text-sec)", cursor: "pointer" }}><X size={18} /></button>
              </div>

              <div className="px-5 py-5">
                {/* Score Ring */}
                <div className="flex justify-center mb-5">
                  <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
                    <svg width="100" height="100" style={{ position: "absolute" }}>
                      <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-dim)" strokeWidth="7" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="7" strokeDasharray={`${(feedback.score / 100) * 264} 264`} strokeLinecap="round" transform="rotate(-90 50 50)" />
                    </svg>
                    <div className="flex flex-col items-center">
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "22px", fontWeight: 700, color: scoreColor, lineHeight: 1 }}>{feedback.score}</span>
                      <span style={{ fontSize: "10px", color: "var(--text-sec)" }}>/100</span>
                    </div>
                  </div>
                </div>

                {/* Correct */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 size={13} color="var(--accent)" />
                    <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--accent)" }}>L�m d�ng</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {feedback.correct.map((item, i) => (
                      <span key={i} style={{ padding: "4px 10px", borderRadius: "4px", fontSize: "12px", backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)", color: "var(--accent)", border: "1px solid color-mix(in srgb, var(--accent) 20%, transparent)" }}>{item}</span>
                    ))}
                  </div>
                </div>

                {/* Improve */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={13} color="var(--accent-dim)" />
                    <span style={{ fontWeight: 600, fontSize: "13px", color: "var(--accent-dim)" }}>C?n c?i thi?n</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {feedback.improve.map((item, i) => (
                      <span key={i} style={{ padding: "4px 10px", borderRadius: "4px", fontSize: "12px", backgroundColor: "color-mix(in srgb, var(--accent-dim) 13%, transparent)", color: "var(--accent-dim)", border: "1px solid color-mix(in srgb, var(--accent-dim) 20%, transparent)" }}>{item}</span>
                    ))}
                  </div>
                </div>

                {/* Tip */}
                <div className="mb-5" style={{ padding: "10px 14px", borderRadius: "6px", backgroundColor: "var(--bg-base)", border: "1px solid var(--border-dim)" }}>
                  <div className="flex items-center gap-2 mb-1">
                    <BookOpen size={12} color="var(--text-sec)" />
                    <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--text-sec)" }}>Gợi ý học thêm</span>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--text-sec)", lineHeight: 1.6, fontStyle: "italic" }}>{feedback.tip}</p>
                </div>

                {/* CTA */}
                <button onClick={handleFeedbackContinue} className="flex items-center justify-center gap-2 w-full"
                  style={{ padding: "12px", borderRadius: "6px", backgroundColor: "var(--accent)", border: "none", color: "var(--primary-foreground)", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "background-color 0.5s" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)")}
                >
                  {currentStep < steps.length - 1 ? <>Ti?p t?c ? Bu?c {currentStep + 2}: {steps[currentStep + 1]} <ChevronRight size={16} /></> : <>Xem k?t qu? cu?i c�ng <ChevronRight size={16} /></>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


