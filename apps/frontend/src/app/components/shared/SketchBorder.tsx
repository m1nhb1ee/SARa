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

  const m = 6; // margin beyond card border so jitter can overflow

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
            <filter id={fId} x="-8%" y="-8%" width="116%" height="116%">
              {/* Strong fractal noise for pronounced jitter */}
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.025"
                numOctaves="5"
                seed="7"
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale="8"
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          </defs>

          <g filter={`url(#${fId})`}>
            {/* Outer contour — thick, fully opaque */}
            <rect
              x={m} y={m}
              width={size.w} height={size.h}
              rx={2}
              fill="none"
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="1"
            />
            {/* Second pass — offset, dashed, for double pencil-stroke feel */}
            <rect
              x={m + 4} y={m + 4}
              width={Math.max(size.w - 8, 0)} height={Math.max(size.h - 8, 0)}
              rx={2}
              fill="none"
              stroke={color}
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="12 5 20 6 10 4"
              opacity="0.55"
            />
          </g>
        </>
      )}
    </svg>
  );
}
