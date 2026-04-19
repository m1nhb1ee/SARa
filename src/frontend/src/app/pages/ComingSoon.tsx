import { useNavigate, useLocation } from "react-router";
import { Construction, ArrowLeft } from "lucide-react";

const labels: Record<string, string> = {
  "/library": "Tu on tap",
  "/image-qa": "Hoi dap anh",
};

export function ComingSoon() {
  const navigate = useNavigate();
  const location = useLocation();
  const name = labels[location.pathname] || "Tinh nang nay";

  return (
    <div
      className="flex flex-col items-center justify-center h-full min-h-[60vh]"
      style={{ color: "var(--text-primary)" }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "16px",
          backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <Construction size={28} color="var(--accent)" />
      </div>
      <h2 style={{ fontWeight: 700, fontSize: "22px", marginBottom: 8 }}>{name}</h2>
      <p style={{ color: "var(--text-sec)", fontSize: "14px", marginBottom: 24, textAlign: "center" }}>
        Tinh nang dang duoc phat trien. <br />Vui long quay lai sau!
      </p>
      <button
        onClick={() => navigate("/")}
        style={{
          padding: "9px 20px",
          borderRadius: "6px",
          backgroundColor: "transparent",
          border: "1px solid var(--border-dim)",
          color: "var(--text-sec)",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 8,
          transition: "border-color 0.5s, color 0.5s",
        }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--text-sec)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-dim)")}
      >
        <ArrowLeft size={14} /> Ve trang chu
      </button>
    </div>
  );
}


