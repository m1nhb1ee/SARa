import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { SketchBorder } from "@/app/components/shared/SketchBorder";

export function ComingSoon() {
  const navigate = useNavigate();

  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{
        minHeight: "70vh",
        backgroundImage:
          "repeating-linear-gradient(transparent, transparent 31px, rgba(196,168,130,0.18) 31px, rgba(196,168,130,0.18) 32px)",
      }}
    >
      <div
        style={{
          position: "relative",
          width: 360,
          maxWidth: "90vw",
          backgroundColor: "var(--bg-surface)",
          padding: "40px 36px 30px",
          boxShadow: "var(--shadow-md)",
          textAlign: "center",
        }}
      >
        <SketchBorder id="coming-soon" color="var(--ink-secondary)" opacity={0.6} />

        {/* Red margin line — notebook motif */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 24,
            top: 0,
            bottom: 0,
            width: 1,
            backgroundColor: "rgba(181,106,82,0.22)",
            pointerEvents: "none",
          }}
        />

        {/* Big sketched 404 stamp */}
        <div
          style={{
            fontFamily: "var(--font-typewriter)",
            fontSize: 13,
            letterSpacing: "0.3em",
            color: "var(--ink-muted)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          trang chưa có
        </div>

        <div
          style={{
            fontFamily: "'Caveat', cursive",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1,
            color: "var(--ink)",
          }}
        >
          404
        </div>

        {/* pencil underline */}
        <svg width="120" height="6" style={{ display: "block", margin: "10px auto 18px" }}>
          <filter id="cs-ul">
            <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="7" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <line
            x1="5" y1="3" x2="115" y2="3"
            stroke="var(--accent-gold)" strokeWidth="1.5"
            filter="url(#cs-ul)" strokeLinecap="round" opacity="0.7"
          />
        </svg>

        <p
          style={{
            fontFamily: "'Lora', Georgia, serif",
            fontSize: 14,
            color: "var(--ink-secondary)",
            lineHeight: 1.6,
            marginBottom: 26,
          }}
        >
          Trang bạn tìm chưa tồn tại hoặc đang được phát triển.
          <br />
          Vui lòng quay lại sau nhé!
        </p>

        <button
          onClick={() => navigate("/")}
          style={{
            padding: "9px 20px",
            borderRadius: "var(--radius)",
            backgroundColor: "transparent",
            border: "1px solid var(--border-strong)",
            color: "var(--ink-body)",
            fontFamily: "var(--font-ui)",
            fontSize: 13,
            fontWeight: 500,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <ArrowLeft size={14} /> Về trang chủ
        </button>

        {/* Corner page number */}
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 14,
            fontFamily: "'Caveat', cursive",
            fontSize: 12,
            color: "rgba(139,99,85,0.4)",
          }}
        >
          p. 404
        </div>
      </div>
    </div>
  );
}
