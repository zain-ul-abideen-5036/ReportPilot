import { useId } from "react";
import { areaPath, linear, smoothPath, type Point } from "./scale";

export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  /** Flip the y axis for metrics where lower is better (average position). */
  invert?: boolean;
  /** CSS colour; defaults to the chart line token. */
  stroke?: string;
  fill?: boolean;
  label?: string;
}

/**
 * Thirteen months on a line, last point marked. Scaled to its own range:
 * a sparkline shows shape, the figure beside it shows magnitude.
 */
export function Sparkline({
  values, width = 120, height = 32, invert = false, stroke = "var(--chart-line)", fill = true, label,
}: SparklineProps) {
  if (values.length < 2) return null;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const x = linear([0, values.length - 1], [pad, width - pad]);
  const y = linear(invert ? [max, min] : [min, max], [height - pad, pad]);
  const points: Point[] = values.map((v, i) => [x(i), y(v)]);
  const line = smoothPath(points);
  const last = points[points.length - 1]!;
  const id = `spark${useId().replace(/:/g, "")}`;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ overflow: "visible", display: "block" }}
    >
      {fill && (
        <>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={stroke} stopOpacity="0.16" />
              <stop offset="1" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath(line, points, height)} fill={`url(#${id})`} />
        </>
      )}
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill={stroke} />
      <circle cx={last[0]} cy={last[1]} r={5} fill={stroke} opacity={0.14} />
    </svg>
  );
}
