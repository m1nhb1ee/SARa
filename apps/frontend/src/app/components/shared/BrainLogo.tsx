interface Props {
  size?: number;
  color?: string;
  filterId?: string;
  opacity?: number;
}

export function BrainLogo({ size = 48, color = '#3D2810', filterId = 'brain', opacity = 1 }: Props) {
  const fId = `logo-sketch-${filterId}`;
  const cx = size / 2;
  const r = size * 0.389;        // outer ring
  const rInner = size * 0.139;   // inner dashed ring
  const gap = size * 0.125;      // crosshair gap from center to ring edge
  const bk = size * 0.111;       // bracket arm length
  const bOff = size * 0.083;     // bracket inset from corner

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" style={{ opacity, display: 'block' }}>
      <defs>
        <filter id={fId} x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" seed="9" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={size * 0.017} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${fId})`}>
        {/* Outer ring */}
        <circle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={size * 0.022} opacity="0.9" />
        {/* Crosshair — top */}
        <line x1={cx} y1={cx - r} x2={cx} y2={cx - gap} stroke={color} strokeWidth={size * 0.017} strokeLinecap="round" opacity="0.7" />
        {/* bottom */}
        <line x1={cx} y1={cx + gap} x2={cx} y2={cx + r} stroke={color} strokeWidth={size * 0.017} strokeLinecap="round" opacity="0.7" />
        {/* left */}
        <line x1={cx - r} y1={cx} x2={cx - gap} y2={cx} stroke={color} strokeWidth={size * 0.017} strokeLinecap="round" opacity="0.7" />
        {/* right */}
        <line x1={cx + gap} y1={cx} x2={cx + r} y2={cx} stroke={color} strokeWidth={size * 0.017} strokeLinecap="round" opacity="0.7" />
        {/* Center dot */}
        <circle cx={cx} cy={cx} r={size * 0.031} fill={color} opacity="0.9" />
        {/* Inner dashed ring */}
        <circle cx={cx} cy={cx} r={rInner} stroke={color} strokeWidth={size * 0.011} strokeDasharray={`${size * 0.07} ${size * 0.04}`} opacity="0.35" />
        {/* Corner brackets */}
        <path d={`M${bOff},${bOff + bk} L${bOff},${bOff} L${bOff + bk},${bOff}`} stroke={color} strokeWidth={size * 0.019} strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        <path d={`M${size - bOff},${bOff + bk} L${size - bOff},${bOff} L${size - bOff - bk},${bOff}`} stroke={color} strokeWidth={size * 0.019} strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        <path d={`M${bOff},${size - bOff - bk} L${bOff},${size - bOff} L${bOff + bk},${size - bOff}`} stroke={color} strokeWidth={size * 0.019} strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
        <path d={`M${size - bOff},${size - bOff - bk} L${size - bOff},${size - bOff} L${size - bOff - bk},${size - bOff}`} stroke={color} strokeWidth={size * 0.019} strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
      </g>
    </svg>
  );
}
