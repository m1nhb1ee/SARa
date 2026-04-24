import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { CheckCircle2, AlertTriangle, ChevronRight, Home, RotateCcw, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { apiClient } from "@/api/client";
import { STEPS, STEP_LABELS } from "@/constants/training";
import { scoreColor, scoreLabel } from "@/constants/styles";

export function AnswerKey() {
  const navigate = useNavigate();
  const { caseId } = useParams<{ caseId: string }>();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [answerKeyData, setAnswerKeyData] = useState<any>(null);
  const [sessionScore, setSessionScore] = useState<number | null>(null);

  useEffect(() => {
    if (!caseId) return;

    const load = async () => {
      setLoading(true);

      // Fetch case detail
      const caseRes = await apiClient.getCaseDetail(caseId as any);
      if (caseRes.error) { setError("Không tìm thấy case."); setLoading(false); return; }
      setCaseData(caseRes.data);

      // Find latest completed session for this case
      const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";
      const token = localStorage.getItem("sara_token") || "";
      const sessionRes = await fetch(
        `${API_BASE}/sessions/?case=${caseId}&status=COMPLETED`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!sessionRes.ok) { setError("Không tìm được session."); setLoading(false); return; }
      const sessionsJson = await sessionRes.json();
      const results: any[] = sessionsJson.results ?? sessionsJson;
      if (!results.length) { setError("Chưa có session nào hoàn thành cho case này."); setLoading(false); return; }

      const latestSession = results[0]; // ordered by started_at desc
      setSessionScore(latestSession.final_score);

      const keyRes = await apiClient.getAnswerKey(latestSession.id);
      if (keyRes.error) { setError("Không thể tải đáp án."); setLoading(false); return; }
      setAnswerKeyData(keyRes.data);
      setLoading(false);
    };

    load();
  }, [caseId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-3">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid var(--border-dim)", borderTop: "3px solid var(--accent)" }}
          />
          <span style={{ fontSize: 13, color: "var(--text-sec)" }}>Đang tải kết quả...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-4 text-center" style={{ maxWidth: 360 }}>
          <AlertTriangle size={40} color="var(--error)" />
          <p style={{ fontSize: 14, color: "var(--text-sec)" }}>{error}</p>
          <button
            onClick={() => navigate("/")}
            style={{ padding: "8px 20px", borderRadius: 6, backgroundColor: "var(--accent)", border: "none", color: "var(--primary-foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  const details: any[] = answerKeyData?.details ?? [];
  const answerKey: Record<string, any> = answerKeyData?.answer_key ?? {};
  const finalScore = sessionScore ?? answerKeyData?.your_score ?? 0;
  const finalScorePct = Math.round(finalScore * 100);

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-base)" }}>
        <div className="px-4 md:px-8 py-5 max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 22 }}>Kết quả & Đáp án</h1>
            <p style={{ color: "var(--text-sec)", fontSize: 13, marginTop: 4 }}>{caseData?.title}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/session/${caseId}`)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border-dim)", backgroundColor: "transparent", color: "var(--text-sec)", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)"; (e.currentTarget as HTMLElement).style.color = "var(--text-sec)"; }}
            >
              <RotateCcw size={14} /> Làm lại
            </button>
            <button
              onClick={() => navigate("/")}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 6, border: "none", backgroundColor: "var(--accent)", color: "var(--primary-foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              <Home size={14} /> Về trang chủ
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 py-6 max-w-4xl mx-auto flex flex-col gap-6">
        {/* Score summary */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-dim)", borderRadius: 8, padding: "24px 28px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}
        >
          {/* Ring */}
          <div className="relative flex items-center justify-center" style={{ width: 100, height: 100, flexShrink: 0 }}>
            <svg width="100" height="100" style={{ position: "absolute" }}>
              <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-dim)" strokeWidth="7" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke={scoreColor(finalScore)}
                strokeWidth="7"
                strokeDasharray={`${finalScore * 264} 264`}
                strokeLinecap="round"
                transform="rotate(-90 50 50)"
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            </svg>
            <div className="flex flex-col items-center">
              <Trophy size={14} color={scoreColor(finalScore)} style={{ marginBottom: 2 }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 22, fontWeight: 700, color: scoreColor(finalScore), lineHeight: 1 }}>{finalScorePct}</span>
              <span style={{ fontSize: 10, color: "var(--text-sec)" }}>/100</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ padding: "3px 12px", borderRadius: 4, fontSize: 13, fontWeight: 700, backgroundColor: `${scoreColor(finalScore)}22`, color: scoreColor(finalScore), border: `1px solid ${scoreColor(finalScore)}44` }}>
                {scoreLabel(finalScore)}
              </span>
              <span style={{ fontSize: 13, color: "var(--text-sec)" }}>{caseData?.modality} · {caseData?.difficulty}</span>
            </div>
            <p style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>{caseData?.title}</p>
            <p style={{ fontSize: 12, color: "var(--text-sec)", lineHeight: 1.5 }}>{caseData?.clinical_history}</p>
          </div>

          {/* Step mini scores */}
          <div className="flex gap-2 flex-wrap ml-auto">
            {STEPS.map((step, i) => {
              const detail = details.find((d: any) => d.step === step);
              const score = detail?.score ?? null;
              return (
                <div key={step} className="flex flex-col items-center gap-1">
                  <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: score !== null ? `${scoreColor(score)}22` : "var(--bg-base)", border: `2px solid ${score !== null ? scoreColor(score) : "var(--border-dim)"}` }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: score !== null ? scoreColor(score) : "var(--text-muted)" }}>
                      {score !== null ? Math.round(score * 100) : "–"}
                    </span>
                  </div>
                  <span style={{ fontSize: 8, fontWeight: 500, letterSpacing: "0.04em", color: "var(--text-sec)" }}>{step}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Step-by-step breakdown */}
        <div className="flex flex-col gap-3">
          <h2 style={{ fontSize: 16, fontWeight: 700 }}>Chi tiết từng bước</h2>

          {STEPS.map((step, i) => {
            const detail = details.find((d: any) => d.step === step);
            const ansKey = answerKey[step];
            const score = detail?.score ?? null;
            const passed = score !== null && score >= 0.6;

            return (
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-dim)", borderRadius: 8, overflow: "hidden" }}
              >
                {/* Step header */}
                <div
                  className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-base)" }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: score !== null ? `${scoreColor(score)}22` : "var(--bg-surface)", border: `2px solid ${score !== null ? scoreColor(score) : "var(--border-dim)"}`, flexShrink: 0 }}>
                    {score !== null ? (
                      passed ? <CheckCircle2 size={14} color={scoreColor(score)} /> : <AlertTriangle size={14} color={scoreColor(score)} />
                    ) : (
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{i + 1}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span style={{ fontWeight: 700, fontSize: 13, letterSpacing: "0.04em" }}>{step}</span>
                    <span style={{ fontSize: 12, color: "var(--text-sec)" }}>— {STEP_LABELS[step]}</span>
                  </div>
                  {score !== null && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: scoreColor(score), flexShrink: 0 }}>
                      {Math.round(score * 100)}/100
                    </span>
                  )}
                  {score === null && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Chưa thực hiện</span>
                  )}
                </div>

                <div className="px-4 py-3 flex flex-col gap-3">
                  {/* Feedback */}
                  {detail?.feedback && (
                    <div style={{ padding: "10px 12px", borderRadius: 6, backgroundColor: passed ? "color-mix(in srgb, var(--success) 8%, transparent)" : "color-mix(in srgb, var(--warning) 8%, transparent)", borderLeft: `3px solid ${passed ? "var(--success)" : "var(--warning)"}` }}>
                      <p style={{ fontSize: 12, color: "var(--text-sec)", marginBottom: 4, fontWeight: 600 }}>Nhận xét AI</p>
                      <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
                        {typeof detail.feedback === "string" ? detail.feedback : detail.feedback?.content ?? "–"}
                      </p>
                    </div>
                  )}

                  {/* Answer key */}
                  {ansKey && (
                    <div style={{ padding: "10px 12px", borderRadius: 6, backgroundColor: "color-mix(in srgb, var(--accent) 6%, transparent)", borderLeft: "3px solid var(--accent)" }}>
                      <p style={{ fontSize: 12, color: "var(--accent)", marginBottom: 4, fontWeight: 600 }}>Đáp án chuẩn</p>
                      <p style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
                        {typeof ansKey === "string" ? ansKey : ansKey.expected_finding ?? JSON.stringify(ansKey)}
                      </p>
                      {ansKey.clinical_explanation && (
                        <p style={{ fontSize: 12, color: "var(--text-sec)", marginTop: 6, lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 600 }}>Giải thích: </span>{ansKey.clinical_explanation}
                        </p>
                      )}
                    </div>
                  )}

                  {!detail?.feedback && !ansKey && (
                    <p style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>
                      Không có dữ liệu cho bước này.
                    </p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex gap-3 justify-center pb-8"
        >
          <button
            onClick={() => navigate("/cases")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 6, border: "1px solid var(--border-dim)", backgroundColor: "transparent", color: "var(--text-sec)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)"; (e.currentTarget as HTMLElement).style.color = "var(--text-sec)"; }}
          >
            Xem thêm cases <ChevronRight size={14} />
          </button>
          <button
            onClick={() => navigate("/performance")}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 6, border: "none", backgroundColor: "var(--accent)", color: "var(--primary-foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            <Trophy size={14} /> Xem kết quả tổng hợp
          </button>
        </motion.div>
      </div>
    </div>
  );
}
