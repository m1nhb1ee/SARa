import { useNavigate } from "react-router";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Flame, Target, TrendingUp, BookOpen, ChevronRight, ArrowRight } from "lucide-react";
import { motion } from "motion/react";

const radarData = [
  { step: "OBSERVE", thisWeek: 85, lastWeek: 72 },
  { step: "DESCRIBE", thisWeek: 75, lastWeek: 68 },
  { step: "INTERPRET", thisWeek: 70, lastWeek: 65 },
  { step: "HYPOTHESIS", thisWeek: 80, lastWeek: 74 },
  { step: "DDx", thisWeek: 60, lastWeek: 55 },
  { step: "CONCLUSION", thisWeek: 88, lastWeek: 80 },
];

const recentCases = [
  {
    name: "Vi�m ph?i thu? du?i ph?i",
    modality: "X-Ray",
    date: "08/04/2026",
    score: 82,
    weakStep: "DDx",
  },
  {
    name: "Tr�n d?ch m�ng ph?i tr�i",
    modality: "X-Ray",
    date: "06/04/2026",
    score: 70,
    weakStep: "INTERPRET",
  },
  {
    name: "Nh?i m�u n�o b�n c?u ph?i",
    modality: "CT",
    date: "04/04/2026",
    score: 75,
    weakStep: "DDx",
  },
  {
    name: "G�y xuong d�n tr�i",
    modality: "X-Ray",
    date: "02/04/2026",
    score: 90,
    weakStep: "HYPOTHESIS",
  },
  {
    name: "U ph?i ph?i",
    modality: "CT",
    date: "30/03/2026",
    score: 65,
    weakStep: "DDx",
  },
];

const statCards = [
  {
    icon: BookOpen,
    label: "Cases Completed",
    value: "12",
    color: "var(--accent)",
    bg: "color-mix(in srgb, var(--accent) 10%, transparent)",
  },
  {
    icon: Target,
    label: "Avg Score",
    value: "78/100",
    color: "var(--accent)",
    bg: "color-mix(in srgb, var(--accent) 10%, transparent)",
    mono: true,
  },
  {
    icon: TrendingUp,
    label: "Bước yếu nhất",
    value: "DDx",
    color: "var(--accent-dim)",
    bg: "color-mix(in srgb, var(--accent-dim) 10%, transparent)",
    badge: true,
  },
  {
    icon: Flame,
    label: "Streak",
    value: "5 ngày",
    color: "var(--success)",
    bg: "color-mix(in srgb, var(--success) 15%, transparent)",
  },
];

const scoreColor = (score: number) =>
  score >= 85 ? "var(--success)" : score >= 70 ? "var(--warning)" : "var(--error)";

const modalityStyle: Record<string, { color: string }> = {
  "X-Ray": { color: "var(--accent)" },
  CT: { color: "var(--success)" },
  MRI: { color: "var(--info)" },
};

export function Performance() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "var(--bg-base)", color: "var(--text-primary)" }}
    >
      {/* Header */}
      <div
        className="px-8 py-5"
        style={{ borderBottom: "1px solid var(--border-dim)", backgroundColor: "var(--bg-surface)" }}
      >
        <h1 style={{ fontWeight: 700, fontSize: "22px" }}>Kết quả của tôi</h1>
        <p style={{ color: "var(--text-sec)", fontSize: "14px", marginTop: 4 }}>
          Theo dõi tiến trình học tập và xác định điểm cần cải thiện
        </p>
      </div>

      <div className="px-4 md:px-8 py-4 md:py-5 max-w-7xl mx-auto flex flex-col gap-4 md:gap-6">
        {/* Stat Cards � 2 cols on mobile, 4 on desktop */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {statCards.map((card, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.3 }}
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-dim)",
                borderRadius: "8px",
                padding: "20px",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <span style={{ fontSize: "13px", color: "var(--text-sec)" }}>{card.label}</span>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "8px",
                    backgroundColor: card.bg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <card.icon size={16} color={card.color} />
                </div>
              </div>
              {card.badge ? (
                <span
                  style={{
                    padding: "4px 12px",
                    borderRadius: "4px",
                    fontSize: "18px",
                    fontWeight: 700,
                    backgroundColor: "color-mix(in srgb, var(--accent-dim) 10%, transparent)",
                    color: "var(--accent-dim)",
                    border: "1px solid color-mix(in srgb, var(--accent-dim) 20%, transparent)",
                  }}
                >
                  {card.value}
                </span>
              ) : (
                <span
                  style={{
                    fontSize: "26px",
                    fontWeight: 700,
                    color: card.color,
                    fontFamily: card.mono ? "'JetBrains Mono', monospace" : "inherit",
                  }}
                >
                  {card.value}
                </span>
              )}
            </motion.div>
          ))}
        </div>

        {/* Chart + Suggestion row � stack on mobile */}
        <div className="flex flex-col lg:flex-row gap-5 md:gap-6">
          {/* Radar Chart */}
          <div
            style={{
              flex: 1,
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: "8px",
              padding: "16px",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontWeight: 600, fontSize: "15px" }}>Điểm theo từng bước</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "var(--accent)" }} />
                  <span style={{ fontSize: "12px", color: "var(--text-sec)" }}>Tuần này</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      backgroundColor: "transparent",
                      border: "2px dashed var(--text-muted)",
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "var(--text-sec)" }}>Tuần trước</span>
                </div>
              </div>
            </div>
            <div style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--border-dim)" />
                  <PolarAngleAxis
                    dataKey="step"
                    tick={{ fill: "var(--text-sec)", fontSize: 11, fontFamily: "'Inter', sans-serif" }}
                  />
                  <Radar
                    name="Tuần trước"
                    dataKey="lastWeek"
                    stroke="var(--text-muted)"
                    fill="var(--text-muted)"
                    fillOpacity={0.15}
                    strokeDasharray="4 4"
                  />
                  <Radar
                    name="Tuần này"
                    dataKey="thisWeek"
                    stroke="var(--success)"
                    fill="var(--success)"
                    fillOpacity={0.25}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-dim)",
                      borderRadius: 6,
                      fontSize: 12,
                      color: "var(--text-primary)",
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Suggestion Card */}
          <div
            style={{
              flex: 1,
              backgroundColor: "var(--bg-surface)",
              border: "1px solid var(--border-dim)",
              borderRadius: "8px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h3 style={{ fontWeight: 600, fontSize: "15px" }}>Gợi ý ôn tập</h3>

            {/* Alert */}
            <div
              style={{
                padding: "12px 14px",
                borderRadius: "8px",
                backgroundColor: "color-mix(in srgb, var(--accent-dim) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--accent-dim) 20%, transparent)",
                borderLeft: "3px solid var(--accent-dim)",
              }}
            >
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--accent-dim)", marginBottom: 4 }}>
                ⚠ Điểm yếu: DDx
              </p>
              <p style={{ fontSize: "13px", color: "var(--text-sec)", lineHeight: 1.6 }}>
                Bạn hay mắc lỗi ở bước DDx. Thử luyện các ca Intermediate về Chest để cải thiện.
              </p>
            </div>

            <button
              onClick={() => navigate("/")}
              style={{
                padding: "10px 16px",
                borderRadius: "6px",
                backgroundColor: "var(--accent)",
                border: "none",
                color: "var(--primary-foreground)",
                fontSize: "13px",
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
              Xem ca gợi ý <ArrowRight size={14} />
            </button>

            {/* Tips */}
            <div style={{ borderTop: "1px solid var(--border-dim)", paddingTop: 16 }}>
              <p style={{ fontSize: "12px", color: "var(--text-sec)", marginBottom: 10, fontWeight: 500 }}>
                Mẹo cải thiện DDx
              </p>
              {[
                "D�ng c? b?ng ch?ng h�nh ?nh V� l�m s�ng",
                "S?p x?p theo d? kh? nang & nguy hi?m",
                "Kh�ng lo?i tr? v?i � h�y l?p lu?n c� can c?",
              ].map((tip, i) => (
                <div key={i} className="flex items-start gap-2 mb-2">
                  <ChevronRight size={12} color="var(--accent)" style={{ marginTop: 3, flexShrink: 0 }} />
                  <p style={{ fontSize: "12px", color: "var(--text-sec)", lineHeight: 1.5 }}>{tip}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Cases Table � scrollable on mobile */}
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
          style={{
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-dim)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          <motion.div
            className="px-4 md:px-5 py-4"
            style={{ borderBottom: "1px solid var(--border-dim)" }}
            initial={{ y: 8 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.5, delay: 0.24 }}
          >
            <h3 style={{ fontWeight: 600, fontSize: "15px" }}>Lịch sử ca gần đây</h3>
          </motion.div>
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-dim)" }}>
                {["Tên ca", "Phương thức", "Ngày", "Điểm", "Bước yếu", ""].map((h, i) => (
                  <th
                    key={i}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--text-sec)",
                      letterSpacing: "0.04em",
                      backgroundColor: "var(--bg-base)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentCases.map((c, i) => (
                <motion.tr
                  key={i}
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.45, delay: 0.28 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    borderBottom: i < recentCases.length - 1 ? "1px solid var(--border-dim)" : "none",
                    transition: "background-color 0.5s",
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "color-mix(in srgb, var(--text-primary) 4%, transparent)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.backgroundColor = "transparent")}
                >
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: "var(--text-primary)" }}>
                    {c.name}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: modalityStyle[c.modality]?.color || "var(--text-sec)",
                        backgroundColor: `${modalityStyle[c.modality]?.color || "var(--text-sec)"}22`,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {c.modality}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: "13px", color: "var(--text-sec)" }}>{c.date}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: scoreColor(c.score),
                      }}
                    >
                      {c.score}/100
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 500,
                        backgroundColor: "color-mix(in srgb, var(--accent-dim) 10%, transparent)",
                        color: "var(--accent-dim)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {c.weakStep}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => navigate("/session/1")}
                      style={{
                        padding: "4px 12px",
                        borderRadius: "4px",
                        fontSize: "12px",
                        fontWeight: 500,
                        backgroundColor: "transparent",
                        border: "1px solid var(--border-dim)",
                        color: "var(--text-sec)",
                        cursor: "pointer",
                        transition: "border-color 0.5s, color 0.5s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)";
                        (e.currentTarget as HTMLElement).style.color = "var(--accent)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)";
                        (e.currentTarget as HTMLElement).style.color = "var(--text-sec)";
                      }}
                    >
                      Xem l?i
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

