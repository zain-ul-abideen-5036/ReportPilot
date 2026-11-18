import { useId } from "react";
import { areaPath, compactTick, linear, niceTicks, smoothPath, type Point } from "./scale";

export interface TrendSeries {
  name: string;
  values: number[];
  /** "primary" is the accent line with an area; "ghost" is a dashed comparison. */
  variant: "primary" | "secondary" | "ghost";
}

export interface TrendChartProps {
  series: TrendSeries[];
  /** One label per x position; only some are drawn. */
  labels: string[];
  width?: number;
  height?: number;
  /** How many x labels to show, evenly spaced. */
  labelCount?: number;
  formatTick?: (v: number) => string;
  title: string;
}

/**
 * Daily trend with an optional previous-period ghost line. The ghost is
 * aligned by day index, so "day 12 this month vs day 12 last month".
 */
export function TrendChart({
  series, labels, width = 640, height = 200, labelCount = 6, formatTick = compactTick, title,
}: TrendChartProps) {
  const gradient = `trend${useId().replace(/:/g, "")}`;
  const margin = { top: 12, right: 8, bottom: 24, left: 40 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const length = Math.max(...series.map((s) => s.values.length), labels.length, 2);
  const peak = Math.max(1, ...series.flatMap((s) => s.values));
  const { max, ticks } = niceTicks(peak, 4);
  const x = linear([0, length - 1], [margin.left, margin.left + innerW]);
  const y = linear([0, max], [margin.top + innerH, margin.top]);
  const baseline = margin.top + innerH;
  const every = Math.max(1, Math.round((length - 1) / (labelCount - 1)));

  const order = { ghost: 0, secondary: 1, primary: 2 } as const;
  const sorted = [...series].sort((a, b) => order[a.variant] - order[b.variant]);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title} style={{ display: "block" }}>
      <title>{title}</title>
      <defs>
        <linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--chart-line)" stopOpacity="0.14" />
          <stop offset="1" stopColor="var(--chart-line)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={margin.left} x2={margin.left + innerW} y1={y(t)} y2={y(t)}
            stroke="var(--chart-grid)" strokeWidth={1} strokeDasharray={t === 0 ? undefined : "2 4"}
          />
          <text x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={10} fill="var(--chart-label)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatTick(t)}
          </text>
        </g>
      ))}
      {labels.map((l, i) =>
        i % every === 0 || i === labels.length - 1 ? (
          <text key={`${l}-${i}`} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"} fontSize={10} fill="var(--chart-label)">
            {l}
          </text>
        ) : null,
      )}
      {sorted.map((s) => {
        const points: Point[] = s.values.map((v, i) => [x(i), y(v)]);
        const line = smoothPath(points);
        if (s.variant === "ghost") {
          return <path key={s.name} d={line} fill="none" stroke="var(--chart-ghost)" strokeWidth={1.25} strokeDasharray="3 3" />;
        }
        if (s.variant === "secondary") {
          return <path key={s.name} d={line} fill="none" stroke="var(--chart-secondary)" strokeWidth={1.5} />;
        }
        const last = points[points.length - 1];
        return (
          <g key={s.name}>
            <path d={areaPath(line, points, baseline)} fill={`url(#${gradient})`} />
            <path d={line} fill="none" stroke="var(--chart-line)" strokeWidth={2} strokeLinejoin="round" />
            {last && <circle cx={last[0]} cy={last[1]} r={3} fill="var(--chart-line)" stroke="var(--chart-bg)" strokeWidth={1.5} />}
          </g>
        );
      })}
    </svg>
  );
}
