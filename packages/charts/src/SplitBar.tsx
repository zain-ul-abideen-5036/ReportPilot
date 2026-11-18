export interface SplitBarProps {
  parts: Array<{ label: string; value: number }>;
  height?: number;
  title: string;
}

const TONES = ["var(--chart-line)", "var(--chart-secondary)", "var(--chart-ghost)", "var(--chart-grid)"];

/**
 * A single stacked bar for shares (devices, branded vs non-branded).
 * Easier to compare than a donut and it fits in a table row.
 */
export function SplitBar({ parts, height = 8, title }: SplitBarProps) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  let offset = 0;
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" width="100%" height={height} role="img" aria-label={title} style={{ display: "block", borderRadius: height / 2, overflow: "hidden" }}>
      <title>{title}</title>
      {parts.map((p, i) => {
        const w = (p.value / total) * 100;
        const rect = <rect key={p.label} x={offset} y={0} width={Math.max(0, w - 0.4)} height={height} fill={TONES[i % TONES.length]} />;
        offset += w;
        return rect;
      })}
    </svg>
  );
}

export const splitTone = (index: number) => TONES[index % TONES.length]!;
