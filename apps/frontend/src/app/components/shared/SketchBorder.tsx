import { useRef, useEffect, useState } from 'react';

interface Props {
  id: string;
  color?: string;
  opacity?: number;
}

export function SketchBorder({ id, color = '#7A6248', opacity = 1 }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const fId = `skb-${id}`;

  useEffect(() => {
    const parent = svgRef.current?.parentElement;
    if (!parent) return;
    const measure = () => setSize({ w: parent.offsetWidth, h: parent.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  const m = 3; // px margin beyond the card border

  return (
    <svg
      ref={svgRef}
      aria-hidden
      style={{
        position: 'absolute',
        top: size ? -m : 0,
        left: size ? -m : 0,
        width: size ? size.w + m * 2 : '100%',
        height: size ? size.h + m * 2 : '100%',
        pointerEvents: 'none',
        overflow: 'visible',
        opacity,
        zIndex: 0,
      }}
    >
      {size && (
        <>
          <defs>
            <filter id={fId} x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="4" seed="3" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <g filter={`url(#${fId})`}>
            {/* Outer contour — traces the card's border */}
            <rect
              x={m} y={m}
              width={size.w} height={size.h}
              rx={2}
              fill="none" stroke={color} strokeWidth="1.5"
              strokeLinecap="round" opacity="0.65"
            />
            {/* Inner dashed pass — double-line pencil feel */}
            <rect
              x={m + 4} y={m + 4}
              width={Math.max(size.w - 8, 0)} height={Math.max(size.h - 8, 0)}
              rx={2}
              fill="none" stroke={color} strokeWidth="0.8"
              strokeLinecap="round" strokeDasharray="8 4 15 5 10 3"
              opacity="0.32"
            />
          </g>
        </>
      )}
    </svg>
  );
}
