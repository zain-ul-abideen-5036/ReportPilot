import { linear, smoothPath, type Point } from "./scale";

export interface VitalTrendProps {
  values: Array<number | null>;
  good: number;
  poor: number;
  width?: number;
  height?: number;
  title: string;
}

/**
 * A Core Web Vital over 25 weeks against Google's thresholds. The "good"
 * band is shaded so pass/fail reads without a legend.
 */
export function VitalTrend({ values, good, poor, width = 220, height = 64, title }: VitalTrendProps) {
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return null;
  const top = Math.max(poor * 1.1, ...present) ;
  const x = linear([0, values.length - 1], [2, width - 2]);
  const y = linear([0, top], [height - 2, 2]);
  const points: Point[] = values.flatMap((v, i) => (v === null ? [] : [[x(i), y(v)] as Point]));
  const last = points[points.length - 1]!;
  const lastValue = present[present.length - 1]!;
  const tone = lastValue <= good ? "var(--chart-ok)" : lastValue <= poor ? "var(--chart-warn)" : "var(--chart-bad)";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title} style={{ display: "block", overflow: "visible" }}>
      <title>{title}</title>
      <rect x={0} y={y(good)} width={width} height={height - y(good)} fill="var(--chart-ok)" opacity={0.08} />
      <line x1={0} x2={width} y1={y(good)} y2={y(good)} stroke="var(--chart-ok)" strokeOpacity={0.5} strokeDasharray="2 3" />
      <line x1={0} x2={width} y1={y(poor)} y2={y(poor)} stroke="var(--chart-bad)" strokeOpacity={0.4} strokeDasharray="2 3" />
      <path d={smoothPath(points)} fill="none" stroke={tone} strokeWidth={1.75} strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.75} fill={tone} />
    </svg>
  );
}
