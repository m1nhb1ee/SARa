interface Props {
  id: string;
  color?: string;
  opacity?: number;
}

export function SketchBorder({ id, color = '#7A6248', opacity = 1 }: Props) {
  const fId = `skb-${id}`;
  return (
    <svg
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        opacity,
      }}
    >
      <defs>
        <filter id={fId} x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g filter={`url(#${fId})`}>
        <rect x="2" y="2" width="97%" height="97%" rx="2"
          fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.65" />
        <rect x="6" y="6" width="93%" height="93%" rx="2"
          fill="none" stroke={color} strokeWidth="0.8" strokeLinecap="round"
          strokeDasharray="8 4 15 5 10 3" opacity="0.32" />
      </g>
    </svg>
  );
}
