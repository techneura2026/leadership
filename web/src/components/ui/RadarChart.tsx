'use client';

export interface RadarAxis {
  key: string;
  label: string;
  value: number; // 0–100
}

interface RadarChartProps {
  axes: RadarAxis[];
  size?: number;
  className?: string;
}

const COLORS = {
  fill: 'rgba(59, 130, 246, 0.25)',
  stroke: 'rgb(59, 130, 246)',
  grid: '#e5e7eb',
  axis: '#d1d5db',
  label: '#374151',
  ring: '#f3f4f6',
};

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function polygonPoints(cx: number, cy: number, r: number, n: number, startAngle = 0) {
  return Array.from({ length: n }, (_, i) => {
    const p = polarToCartesian(cx, cy, r, startAngle + (i * 360) / n);
    return `${p.x},${p.y}`;
  }).join(' ');
}

export function RadarChart({ axes, size = 300, className }: RadarChartProps) {
  const n = axes.length;
  if (n < 3) return null;

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.33;
  const labelR = size * 0.46;
  const rings = [0.25, 0.5, 0.75, 1];

  // Score polygon — each axis value 0-100 → fraction of outerR
  const scorePoints = axes
    .map((axis, i) => {
      const r = ((axis.value / 100) * outerR);
      const p = polarToCartesian(cx, cy, r, (i * 360) / n);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size*2}
      height={size}
      className={className}
      aria-label="Big Five personality radar chart"
    >
      {/* Reference rings */}
      {rings.map((fraction) => (
        <polygon
          key={fraction}
          points={polygonPoints(cx, cy, outerR * fraction, n)}
          fill={fraction === 1 ? COLORS.ring : 'none'}
          stroke={COLORS.grid}
          strokeWidth={1}
        />
      ))}

      {/* Axis lines from center to each vertex */}
      {axes.map((_, i) => {
        const p = polarToCartesian(cx, cy, outerR, (i * 360) / n);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke={COLORS.axis}
            strokeWidth={1}
          />
        );
      })}

      {/* Score polygon */}
      <polygon
        points={scorePoints}
        fill={COLORS.fill}
        stroke={COLORS.stroke}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Score dots */}
      {axes.map((axis, i) => {
        const r = (axis.value / 100) * outerR;
        const p = polarToCartesian(cx, cy, r, (i * 360) / n);
        return (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={COLORS.stroke}
            stroke="white"
            strokeWidth={1.5}
          />
        );
      })}

      {/* Axis labels */}
      {axes.map((axis, i) => {
        const angle = (i * 360) / n;
        const p = polarToCartesian(cx, cy, labelR, angle);

        let textAnchor: 'middle' | 'start' | 'end' = 'middle';
        // Simple quadrant-based anchor
        const normAngle = ((angle % 360) + 360) % 360;
        if (normAngle > 15 && normAngle < 165) textAnchor = 'middle'; // bottom half
        else if (normAngle >= 165 && normAngle < 195) textAnchor = 'middle'; // bottom
        else if (normAngle >= 195 && normAngle < 345) textAnchor = 'middle'; // top half
        // More precise:
        if (normAngle > 20 && normAngle <= 160) textAnchor = 'start';
        if (normAngle > 200 && normAngle <= 340) textAnchor = 'end';

        return (
          <text
            key={i}
            x={p.x}
            y={p.y}
            textAnchor={textAnchor}
            dominantBaseline="middle"
            fontSize={size * 0.042}
            fontWeight={500}
            fill={COLORS.label}
          >
            {axis.label}
          </text>
        );
      })}

      {/* Ring % labels (right side axis) */}
      {rings.slice(0, 3).map((fraction) => {
        const p = polarToCartesian(cx, cy, outerR * fraction, 0);
        return (
          <text
            key={fraction}
            x={p.x + 3}
            y={p.y}
            fontSize={size * 0.032}
            fill="#9ca3af"
            dominantBaseline="middle"
          >
            {Math.round(fraction * 100)}
          </text>
        );
      })}
    </svg>
  );
}
