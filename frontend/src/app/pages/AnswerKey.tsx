import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Timer,
  Target,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion } from "motion/react";

const XRAY_IMG =
  "https://images.unsplash.com/photo-1616012480717-fd9867059ca0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=900";

const pipelineSteps = [
  {
    step: "OBSERVE",
    score: 85,
    answer:
      "Tang d? m? d?ng nh?t v�ng thu? du?i ph?i ph?i, b? kh�ng r�, xo� g�c su?n ho�nh ph?i. C� air bronchogram sign. Kh�ng th?y t?n thuong b�n tr�i. Tim v� xuong trong gi?i h?n b�nh thu?ng.",
  },
  {
    step: "DESCRIBE",
    score: 75,
    answer:
      "��m m? consolidation k�ch thu?c ~8�6cm, b? kh�ng d?u, m?t d? kh�ng d?ng nh?t. Ph�n b? trong ph?i ph?i (lobar pattern). Kh�ng th?y t?n thuong d?ng hang hay v�i ho�.",
  },
  {
    step: "INTERPRET",
    score: 70,
    answer:
      "H�nh ?nh consolidation thu? du?i ph?i ph?i v?i air bronchogram sign, c�ng b?nh s? ho s?t ? g?i � qu� tr�nh vi�m nhi?m c?p t�nh. Lo?i tr? t?n thuong �c t�nh do thi?u b? da cung.",
  },
  {
    step: "HYPOTHESIS",
    score: 80,
    answer:
      "1. Vi�m ph?i c?ng d?ng (CAP) � kh? nang cao nh?t\n2. Lao ph?i � c?n lo?i tr?\n3. Ung thu ph?i t?c ngh?n sau � �t kh? nang\n4. Vi�m ph?i h�t (aspiration) � c?n h?i th�m b?nh s?",
  },
  {
    step: "DDx",
    score: 68,
    answer:
      "Atelectasis ?: kh�ng c� d?u hi?u t?p thu?, d?y trung th?t. Tr�n d?ch MP ?: kh�ng c� du?ng Damoiseau, g�c su?n ho�nh c�n r� b�n ph?i. TB: c?n x�t nghi?m d?m, nhung v? tr� thu? du?i �t g?p.",
  },
  {
    step: "CONCLUSION",
    score: 90,
    answer:
      "Vi�m ph?i thu? du?i ph?i ph?i (Community-Acquired Pneumonia). �? xu?t: kh�ng sinh theo kinh nghi?m, x�t nghi?m d?m + c?y m�u, ki?m tra l?i X-quang sau 4-6 tu?n di?u tr?.",
  },
];

const ddxExcluded = [
  { name: "Atelectasis", reason: "Kh�ng c� d?u hi?u x?p thu?, trung th?t kh�ng b? k�o l?ch" },
  { name: "Pleural Effusion", reason: "Kh�ng c� du?ng Damoiseau, g�c su?n ho�nh c�n r�" },
  { name: "Tuberculosis", reason: "V? tr� thu? du?i kh�ng di?n h�nh, kh�ng c� hang ho?c v�i ho�" },
];

export function AnswerKey() {
  const navigate = useNavigate();
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({ 0: true });

  const toggleStep = (i: number) => {
    setOpenSteps((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  const avgScore = Math.round(
    pipelineSteps.reduce((sum, s) => sum + s.score, 0) / pipelineSteps.length
  );

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Header */}
      <div
        className="px-4 md:px-8 py-4 md:py-5 flex flex-wrap items-center gap-2 md:gap-4"
        style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)" }}
      >
        <h1 style={{ fontWeight: 700, fontSize: "20px" }}>K?t qu? ca h?c</h1>
        <span style={{ color: "var(--text-sec)", fontSize: "15px" }}>–</span>
        <span style={{ color: "var(--text-sec)", fontSize: "14px" }}>Viêm phổi thứ dưới phải</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 px-4 md:px-8 py-6 md:py-8 max-w-7xl mx-auto">
        {/* LEFT � Image with annotations */}
        <div className="flex flex-col gap-4 lg:w-[45%]">
          <div
            style={{
              position: "relative",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--border-dim)",
              backgroundColor: "var(--bg-base)",
            }}
          >
            <img
              src={XRAY_IMG}
              alt="Annotated X-Ray"
              style={{ width: "100%", objectFit: "cover", filter: "grayscale(20%) contrast(1.1)" }}
            />
            {/* Annotation overlay */}
            <div
              style={{
                position: "absolute",
                top: "40%",
                right: "25%",
                border: "2px solid var(--error)",
                borderRadius: 4,
                width: 120,
                height: 80,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: -22,
                  left: 0,
                  backgroundColor: "var(--error)",
                  color: "#FFFFFF",
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "3px 3px 0 0",
                  whiteSpace: "nowrap",
                }}
              >
                Consolidation
              </span>
            </div>
            <div
              style={{
                position: "absolute",
                bottom: "18%",
                right: "20%",
                border: "2px solid var(--error)",
                borderRadius: 4,
                width: 80,
                height: 40,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  bottom: -22,
                  left: 0,
                  backgroundColor: "var(--accent-dim)",
                  color: "#FFFFFF",
                  fontSize: "10px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "0 0 3px 3px",
                  whiteSpace: "nowrap",
                }}
              >
                Air bronchogram
              </span>
            </div>
          </div>

          {/* Session Summary */}
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h3 style={{ fontWeight: 600, fontSize: "14px", marginBottom: 12, color: "var(--text-primary)" }}>
              T?ng k?t phi�n h?c
            </h3>
            <div className="flex flex-wrap gap-3">
              {[
                { icon: Timer, label: "Thời gian: 18 phút", color: "var(--text-sec)" },
                {
                  icon: Target,
                  label: `�i?m trung b�nh: ${avgScore}/100`,
                  color: avgScore >= 80 ? "var(--accent)" : "var(--accent-dim)",
                },
                { icon: TrendingUp, label: "+12 so v?i ca tru?c", color: "var(--accent)" },
              ].map(({ icon: Icon, label, color }, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2"
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-base)",
                    border: "1px solid var(--border-dim)",
                  }}
                >
                  <Icon size={13} color={color} />
                  <span style={{ fontSize: "12px", color, fontFamily: "'JetBrains Mono', monospace" }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* DDx Excluded */}
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <h3 style={{ fontWeight: 600, fontSize: "14px", marginBottom: 12, color: "var(--text-primary)" }}>
              DDx du?c lo?i tr?
            </h3>
            <div className="flex flex-col gap-2">
              {ddxExcluded.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3"
                  style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-base)",
                    border: "1px solid var(--border-dim)",
                  }}
                >
                  <XCircle size={14} color="var(--error)" style={{ marginTop: 2, shrink: 0 }} />
                  <div>
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "var(--text-primary)" }}>
                      {item.name}
                    </span>
                    <p style={{ fontSize: "12px", color: "var(--text-sec)", marginTop: 2 }}>{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT � Diagnosis + Pipeline Accordion */}
        <div className="flex flex-col gap-5 flex-1">
          {/* Diagnosis */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid color-mix(in srgb, var(--accent) 27%, transparent)",
              borderRadius: "8px",
              padding: "20px",
            }}
          >
            <p style={{ fontSize: "12px", color: "var(--text-sec)", fontWeight: 500, letterSpacing: "0.04em", marginBottom: 8 }}>
              CH?N �O�N CH�NH X�C
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <span
                style={{
                  padding: "6px 16px",
                  borderRadius: "6px",
                  fontSize: "16px",
                  fontWeight: 700,
                  backgroundColor: "color-mix(in srgb, var(--accent) 13%, transparent)",
                  color: "var(--accent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 27%, transparent)",
                }}
              >
                Vi�m ph?i thu? du?i ph?i � Pneumonia
              </span>
              <CheckCircle2 size={20} color="var(--accent)" />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <span style={{ fontSize: "13px", color: "var(--text-sec)" }}>Độ chính xác bác sĩ:</span>
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "15px",
                  fontWeight: 600,
                  color: "var(--success)",
                }}
              >
                94%
              </span>
            </div>
          </motion.div>

          {/* Pipeline Accordion */}
          <div
            style={{
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--border-dim)" }}>
              <h3 style={{ fontWeight: 600, fontSize: "14px" }}>Ph�n t�ch theo pipeline</h3>
            </div>
            {pipelineSteps.map((s, i) => {
              const scoreColor =
                s.score >= 85 ? "var(--success)" : s.score >= 70 ? "var(--warning)" : "var(--error)";
              return (
                <div key={i} style={{ borderBottom: i < pipelineSteps.length - 1 ? "1px solid var(--border-dim)" : "none" }}>
                  <button
                    className="w-full flex items-center justify-between px-5 py-3"
                    onClick={() => toggleStep(i)}
                    style={{
                      backgroundColor: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--text-primary)",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        style={{
                          padding: "2px 10px",
                          borderRadius: "4px",
                          fontSize: "11px",
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                          backgroundColor: "color-mix(in srgb, var(--emphasis) 15%, transparent)",
                          color: "var(--emphasis)",
                        }}
                      >
                        {s.step}
                      </span>
                      <span
                        style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: "13px",
                          fontWeight: 600,
                          color: scoreColor,
                        }}
                      >
                        {s.score}/100
                      </span>
                    </div>
                    {openSteps[i] ? (
                      <ChevronUp size={15} color="var(--text-sec)" />
                    ) : (
                      <ChevronDown size={15} color="var(--text-sec)" />
                    )}
                  </button>
                  {openSteps[i] && (
                    <div className="px-5 pb-4">
                      <p style={{ fontSize: "13px", color: "var(--text-sec)", lineHeight: 1.7, whiteSpace: "pre-line" }}>
                        {s.answer}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* CTA Row */}
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => navigate("/")}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: "6px",
                backgroundColor: "transparent",
                border: "1px solid var(--border-dim)",
                color: "var(--text-sec)",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "border-color 0.5s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--text-sec)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)")}
            >
              <ChevronLeft size={15} /> V? thu vi?n
            </button>
            <button
              onClick={() => navigate("/session/1")}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: "6px",
                backgroundColor: "transparent",
                border: "1px solid var(--accent)",
                color: "var(--accent)",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background-color 0.5s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "color-mix(in srgb, var(--accent) 10%, transparent)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
            >
              <RefreshCw size={14} /> L�m l?i ca n�y
            </button>
            <button
              onClick={() => navigate("/session/3")}
              style={{
                flex: 1,
                padding: "11px",
                borderRadius: "6px",
                backgroundColor: "var(--accent)",
                border: "1px solid var(--accent)",
                color: "var(--primary-foreground)",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "background-color 0.5s",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent-hover)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "var(--accent)")}
            >
              Ca ti?p theo <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

