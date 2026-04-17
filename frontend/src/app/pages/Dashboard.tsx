import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { CheckCircle2, Clock, PlayCircle, RefreshCw, Layers } from "lucide-react";
import { useCases, useSessions } from "@/api/hooks";

type Status = "Chưa làm" | "Đang làm" | "Hoàn thành";
type Difficulty = "Cơ bản" | "Trung bình" | "Nặng cao";
type Modality = "X-Ray" | "CT" | "MRI";

interface CaseCard {
  id: string;
  title: string;
  modality: Modality;
  difficulty: Difficulty;
  hint: string;
  status: Status;
  imageKey: string;
}

// Mapping functions
const mapModality = (modality: string): Modality => {
  const map: Record<string, Modality> = {
    XRAY: "X-Ray",
    CT: "CT",
    MRI: "MRI",
  };
  return map[modality] || "X-Ray";
};

const mapDifficulty = (difficulty: string): Difficulty => {
  const map: Record<string, Difficulty> = {
    BASIC: "Cơ bản",
    INTERMEDIATE: "Trung bình",
    ADVANCED: "Nặng cao",
  };
  return map[difficulty] || "Cơ bản";
};

const getImageKey = (modality: string): string => {
  const map: Record<string, string> = {
    XRAY: "body",
    CT: "ct",
    MRI: "head",
  };
  return map[modality] || "body";
};

const difficultyStyle: Record<Difficulty, { bg: string; color: string }> = {
  "Cơ bản": { bg: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" },
  "Trung bình": { bg: "color-mix(in srgb, var(--warning) 15%, transparent)", color: "var(--warning)" },
  "Nặng cao": { bg: "color-mix(in srgb, var(--error) 15%, transparent)", color: "var(--error)" },
};

const statusStyle: Record<Status, { icon: any; color: string; label: string }> = {
  "Chưa làm": { icon: Clock, color: "var(--text-muted)", label: "Chưa làm" },
  "Đang làm": { icon: RefreshCw, color: "var(--warning)", label: "Đang làm" },
  "Hoàn thành": { icon: CheckCircle2, color: "var(--success)", label: "Hoàn thành" },
};

const modalityStyle: Record<Modality, { bg: string; color: string }> = {
  "X-Ray": { bg: "color-mix(in srgb, var(--info) 15%, transparent)", color: "var(--info)" },
  "CT": { bg: "color-mix(in srgb, var(--success) 15%, transparent)", color: "var(--success)" },
  "MRI": { bg: "color-mix(in srgb, var(--emphasis) 15%, transparent)", color: "var(--emphasis)" },
};

export function Dashboard() {
  const navigate = useNavigate();
  const { data: casesData, loading: casesLoading } = useCases();
  const { data: sessionsData } = useSessions();
  
  const [activeModality, setActiveModality] = useState<string>("Tất cả");
  const [activeDifficulty, setActiveDifficulty] = useState<string>("Tất cả");

  const modalityFilters = ["Tất cả", "X-Ray", "CT", "MRI"];
  const difficultyFilters = ["Tất cả", "Cơ bản", "Trung bình", "Nặng cao"];

  // Build status map from sessions
  const statusMap = useMemo(() => {
    const map: Record<number, Status> = {};
    if (sessionsData?.results) {
      sessionsData.results.forEach((session: any) => {
        map[session.case] = session.status === "COMPLETED" ? "Hoàn thành" : "Đang làm";
      });
    }
    return map;
  }, [sessionsData]);

  // Convert API cases to CaseCard format
  const cases: CaseCard[] = useMemo(() => {
    if (!casesData?.results) return [];
    return casesData.results.map((apiCase: any) => ({
      id: apiCase.id.toString(),
      title: apiCase.title,
      modality: mapModality(apiCase.modality),
      difficulty: mapDifficulty(apiCase.difficulty),
      hint: apiCase.clinical_history || apiCase.description,
      status: statusMap[apiCase.id] || ("Chưa làm" as Status),
      imageKey: getImageKey(apiCase.modality),
    }));
  }, [casesData, statusMap]);

  const filtered = cases.filter(
    (c) =>
      (activeModality === "Tất cả" || c.modality === activeModality) &&
      (activeDifficulty === "Tất cả" || c.difficulty === activeDifficulty)
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-3 md:mb-4">
        <h1 style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: "22px", color: "var(--text-primary)", marginBottom: "6px" }}>
          Case Study Library
        </h1>
        <p style={{ color: "var(--text-sec)", fontSize: "14px" }}>
          Chọn ca để bắt đầu luyện tập pipeline 6 bước
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 mb-4 md:mb-5 md:flex-row md:flex-wrap md:items-center md:gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: "var(--text-sec)", fontSize: "13px", marginRight: 4 }}>Phương thức:</span>
          <div className="flex gap-2 flex-wrap">
            {modalityFilters.map((m) => (
              <button
                key={m}
                onClick={() => setActiveModality(m)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "4px",
                  fontSize: "13px",
                  fontWeight: 500,
                  border: activeModality === m ? "1px solid var(--accent)" : "1px solid var(--border-dim)",
                  backgroundColor: activeModality === m ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                  color: activeModality === m ? "var(--accent)" : "var(--text-sec)",
                  cursor: "pointer",
                  transition: "all 0.5s",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: "var(--text-sec)", fontSize: "13px", marginRight: 4 }}>Độ khó:</span>
          <div className="flex gap-2 flex-wrap">
            {difficultyFilters.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDifficulty(d)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "4px",
                  fontSize: "13px",
                  fontWeight: 500,
                  border: activeDifficulty === d ? "1px solid var(--accent)" : "1px solid var(--border-dim)",
                  backgroundColor: activeDifficulty === d ? "color-mix(in srgb, var(--accent) 10%, transparent)" : "transparent",
                  color: activeDifficulty === d ? "var(--accent)" : "var(--text-sec)",
                  cursor: "pointer",
                  transition: "all 0.5s",
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Case Grid */}
      <div className="grid gap-3 md:gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
        {casesLoading ? (
          [1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} style={{ backgroundColor: "var(--bg-surface)", borderRadius: "8px", height: "280px", animation: "pulse 2s infinite" }}></div>
          ))
        ) : filtered.length > 0 ? (
          filtered.map((c) => {
            const StatusIcon = statusStyle[c.status].icon;
            return (
              <div
                key={c.id}
                style={{
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-dim)",
                  borderRadius: "8px",
                  overflow: "hidden",
                  transition: "border-color 0.2s, transform 0.2s",
                  cursor: "pointer",
                }}
              >
                {/* Thumbnail */}
                <div className="relative" style={{ height: 140, backgroundColor: "var(--bg-base)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div className={`img-${c.imageKey}`} style={{ width: "100%", height: "100%", opacity: 0.85 }} />
                  {/* Modality badge */}
                  <span style={{ position: "absolute", top: 10, right: 10, padding: "3px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, backgroundColor: modalityStyle[c.modality].bg, color: modalityStyle[c.modality].color, border: `1px solid ${modalityStyle[c.modality].color}44` }}>
                    {c.modality.toUpperCase()}
                  </span>
                  {/* Difficulty badge */}
                  <span style={{ position: "absolute", top: 10, left: 10, padding: "3px 10px", borderRadius: "4px", fontSize: "11px", fontWeight: 500, backgroundColor: difficultyStyle[c.difficulty].bg, color: difficultyStyle[c.difficulty].color, border: `1px solid ${difficultyStyle[c.difficulty].color}44` }}>
                    {c.difficulty}
                  </span>
                </div>

                {/* Content */}
                <div className="p-3">
                  <h3 style={{ fontWeight: 600, fontSize: "14px", color: "var(--text-primary)", marginBottom: "4px", lineHeight: 1.3 }}>
                    {c.title}
                  </h3>
                  <p style={{ fontSize: "12px", color: "var(--text-sec)", marginBottom: "8px", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {c.hint}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <StatusIcon size={13} color={statusStyle[c.status].color} />
                      <span style={{ fontSize: "12px", color: statusStyle[c.status].color, fontWeight: 500 }}>
                        {c.status}
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`/session/${c.id}`)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.5s",
                        ...(c.status === "Đang làm"
                          ? { backgroundColor: "transparent", border: "1px solid var(--warning)", color: "var(--warning)" }
                          : c.status === "Hoàn thành"
                          ? { backgroundColor: "transparent", border: "1px solid var(--success)", color: "var(--success)" }
                          : { backgroundColor: "var(--accent)", border: "1px solid var(--accent)", color: "var(--primary-foreground)" }),
                      }}
                    >
                      {c.status === "Đang làm" ? (
                        <span className="flex items-center gap-1.5">
                          <RefreshCw size={12} /> Tiếp tục
                        </span>
                      ) : c.status === "Hoàn thành" ? (
                        <span className="flex items-center gap-1.5">
                          <PlayCircle size={12} /> Làm lại
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <PlayCircle size={12} /> Bắt đầu
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20" style={{ color: "var(--text-muted)", gridColumn: "1/-1" }}>
            <Layers size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
            <p style={{ fontSize: "16px", fontWeight: 500 }}>Chưa có ca nào</p>
            <p style={{ fontSize: "13px", marginTop: 6 }}>
              Thử thay đổi bộ lọc để xem thêm ca học
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

