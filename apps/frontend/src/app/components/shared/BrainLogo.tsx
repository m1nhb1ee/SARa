interface Props {
  size?: number;
  color?: string;
  filterId?: string;
  opacity?: number;
}

export function BrainLogo({ size = 48, color = '#4A3020', filterId = 'brain', opacity = 1 }: Props) {
  const fId = `brain-sketch-${filterId}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 56 52"
      fill="none"
      style={{ opacity, display: 'block' }}
    >
      <defs>
        <filter id={fId} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="4" seed="6" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>

      <g filter={`url(#${fId})`} stroke={color} strokeLinecap="round" strokeLinejoin="round" fill="none">

        {/* ── Left hemisphere outline ── */}
        <path
          d="M28 7 C24 5 17 5 13 9 C9 13 8 19 9 25 C10 30 13 35 17 39 C20 42 24 44 28 44"
          strokeWidth="1.8"
        />

        {/* ── Right hemisphere outline ── */}
        <path
          d="M28 7 C32 5 39 5 43 9 C47 13 48 19 47 25 C46 30 43 35 39 39 C36 42 32 44 28 44"
          strokeWidth="1.8"
        />

        {/* ── Bottom join / corpus callosum hint ── */}
        <path d="M22 44 C24 46 28 47 28 47 C28 47 32 46 34 44" strokeWidth="1.4" />

        {/* ── Center longitudinal fissure ── */}
        <line x1="28" y1="7" x2="28" y2="44" strokeWidth="0.9" strokeDasharray="3.5 2.5" opacity="0.7" />

        {/* ── Left sulci (gyri folds) ── */}
        <path d="M11 17 C14 13 18 15 17 20 C16 25 12 24 11 28" strokeWidth="1.1" />
        <path d="M10 30 C13 26 17 28 16 33 C15 37 12 37 12 41" strokeWidth="1.1" />
        <path d="M18 9 C21 6 25 7 26 10" strokeWidth="1" opacity="0.8" />

        {/* ── Right sulci (gyri folds) ── */}
        <path d="M45 17 C42 13 38 15 39 20 C40 25 44 24 45 28" strokeWidth="1.1" />
        <path d="M46 30 C43 26 39 28 40 33 C41 37 44 37 44 41" strokeWidth="1.1" />
        <path d="M38 9 C35 6 31 7 30 10" strokeWidth="1" opacity="0.8" />

      </g>
    </svg>
  );
}
