import { useMemo } from "react";
import { useNavigate } from "react-router";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip,
} from "recharts";
import { Flame, Target, TrendingUp, BookOpen, ChevronRight, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useMyStats, useSessions } from "@/api/hooks";
import { STEPS } from "@/constants/training";
import { scoreColor } from "@/constants/styles";

export function Performance() {
  const navigate = useNavigate();
  const { data: stats, loading: statsLoading } = useMyStats();
  const { data: sessionsData } = useSessions({ status: "COMPLETED" });

  const avgScore = stats ? Math.round((stats.average_score ?? 0) * 100) : 0;

  const accuracyByStep: Record<string, number> = stats?.accuracy_by_step ?? {};

  const weakestStep = useMemo(() => {
    const entries = Object.entries(accuracyByStep);
    if (!entries.length) return "–";
    return entries.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
  }, [accuracyByStep]);

  const radarData = STEPS.map((step) => ({
    step,
    score: accuracyByStep[step] != null ? Math.round(accuracyByStep[step] * 100) : 0,
  }));

  const recentSessions = (sessionsData?.results ?? []).slice(0, 5);

  const statCards = [
    {
      icon: BookOpen,
      label: "Cases Completed",
      value: statsLoading ? "…" : String(stats?.total_cases_completed ?? 0),
      color: "var(--accent)",
      bg: "color-mix(in srgb, var(--accent) 10%, transparent)",
    },
    {
      icon: Target,
      label: "Avg Score",
      value: statsLoading ? "…" : `${avgScore}/100`,
      color: "var(--accent)",
      bg: "color-mix(in srgb, var(--accent) 10%, transparent)",
      mono: true,
    },
    {
      icon: TrendingUp,
      label: "Bước yếu nhất",
      value: statsLoading ? "…" : weakestStep,
      color: "var(--accent-dim)",
      bg: "color-mix(in srgb, var(--accent-dim) 10%, transparent)",
      badge: true,
    },
    {
      icon: Flame,
      label: "Hoạt động cuối",
      value: stats?.last_activity
        ? new Date(stats.last_activity).toLocaleDateString("vi-VN")
        : "–",
      color: "var(--success)",
      bg: "color-mix(in srgb, var(--success) 15%, transparent)",
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid var(--border-dim)" }}>
        <div className="px-4 md:px-8 py-5 max-w-7xl mx-auto">
          <h1 style={{ fontWeight: 700, fontSize: 22 }}>Kết quả của tôi</h1>
          <p style={{ color: "var(--text-sec)", fontSize: 14, marginTop: 4 }}>
            Theo dõi tiến trình học tập và xác định điểm cần cải thiện
          </p>
        </div>
      </div>

      <div className="px-4 md:px-8 py-4 md:py-5 max-w-7xl mx-auto flex flex-col gap-4 md:gap-6">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-dim)", borderRadius: 8, padding: 20 }}
            >
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: 13, color: "var(--text-sec)" }}>{card.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: card.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <card.icon size={16} color={card.color} />
                </div>
              </div>
              {card.badge ? (
                <span style={{ padding: "4px 12px", borderRadius: 4, fontSize: 18, fontWeight: 700, backgroundColor: "color-mix(in srgb, var(--accent-dim) 10%, transparent)", color: "var(--accent-dim)", border: "1px solid color-mix(in srgb, var(--accent-dim) 20%, transparent)" }}>
                  {card.value}
                </span>
              ) : (
                <span style={{ fontSize: 26, fontWeight: 700, color: card.color, fontFamily: card.mono ? "'JetBrains Mono', monospace" : "inherit" }}>
                  {card.value}
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Chart + Suggestion row */}
        <div className="flex flex-col lg:flex-row gap-5 md:gap-6">
          {/* Radar Chart */}
          <div style={{ flex: 1, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-dim)", borderRadius: 8, padding: 16 }}>
            <h3 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Điểm theo từng bước</h3>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border-dim)" />
                  <PolarAngleAxis dataKey="step" tick={{ fill: "var(--text-sec)", fontSize: 11, fontFamily: "'Inter', sans-serif" }} />
                  <Radar name="Điểm" dataKey="score" stroke="var(--success)" fill="var(--success)" fillOpacity={0.25} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-dim)", borderRadius: 6, fontSize: 12, color: "var(--text-primary)" }}
                    formatter={(v: number) => [`${v}/100`, "Điểm"]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Suggestion Card */}
          <div style={{ flex: 1, backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-dim)", borderRadius: 8, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <h3 style={{ fontWeight: 600, fontSize: 15 }}>Gợi ý ôn tập</h3>
            {weakestStep !== "–" && (
              <div style={{ padding: "12px 14px", borderRadius: 8, backgroundColor: "color-mix(in srgb, var(--accent-dim) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-dim) 20%, transparent)", borderLeft: "3px solid var(--accent-dim)" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-dim)", marginBottom: 4 }}>
                  ⚠ Điểm yếu: {weakestStep}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-sec)", lineHeight: 1.6 }}>
                  Bạn hay mắc lỗi ở bước {weakestStep}. Thử luyện thêm các ca ở mức Intermediate để cải thiện.
                </p>
              </div>
            )}
            <button
              onClick={() => navigate("/")}
              style={{ padding: "10px 16px", borderRadius: 6, backgroundColor: "var(--accent)", border: "none", color: "var(--primary-foreground)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
            >
              Xem ca gợi ý <ArrowRight size={14} />
            </button>
            <div style={{ borderTop: "1px solid var(--border-dim)", paddingTop: 16 }}>
              <p style={{ fontSize: 12, color: "var(--text-sec)", marginBottom: 10, fontWeight: 500 }}>Mẹo cải thiện</p>
              {["Dùng cả bằng chứng hình ảnh và lâm sàng", "Sắp xếp theo độ khả năng & nguy hiểm", "Không loại trừ vội — hãy lập luận có căn cứ"].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <ChevronRight size={12} color="var(--accent)" style={{ marginTop: 3, flexShrink: 0 }} />
                  <p style={{ fontSize: 12, color: "var(--text-sec)", lineHeight: 1.5 }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Sessions Table */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.18 }}
          style={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-dim)", borderRadius: 8, overflow: "hidden" }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-dim)" }}>
            <h3 style={{ fontWeight: 600, fontSize: 15 }}>Lịch sử ca gần đây</h3>
          </div>
          {recentSessions.length === 0 ? (
            <p style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>
              Chưa có ca hoàn thành nào.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-base)" }}>
                    {["Case", "Ngày hoàn thành", "Điểm", ""].map((h, i) => (
                      <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--text-sec)", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentSessions.map((s: any, i: number) => {
                    const score = s.final_score ?? 0;
                    return (
                      <tr key={s.id} style={{ borderBottom: i < recentSessions.length - 1 ? "1px solid var(--border-dim)" : "none" }}>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-primary)" }}>{s.case_title ?? s.case_id}</td>
                        <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--text-sec)" }}>
                          {s.completed_at ? new Date(s.completed_at).toLocaleDateString("vi-VN") : "–"}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: scoreColor(score) }}>
                            {Math.round(score * 100)}/100
                          </span>
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <button
                            onClick={() => navigate(`/answer-key/${s.case_id}`)}
                            style={{ padding: "4px 12px", borderRadius: 4, fontSize: 12, fontWeight: 500, backgroundColor: "transparent", border: "1px solid var(--border-dim)", color: "var(--text-sec)", cursor: "pointer" }}
                          >
                            Xem lại
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
