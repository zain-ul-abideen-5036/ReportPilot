export interface UptimeStripProps {
  days: Array<{ day: string; uptimePct: number }>;
  width?: number;
  height?: number;
  title: string;
}

/**
 * One bar per day. Full days are quiet; days with downtime stand out by
 * colour *and* by being shorter, so the pattern survives greyscale print.
 */
export function UptimeStrip({ days, width = 560, height = 28, title }: UptimeStripProps) {
  const gap = 2;
  const barW = (width - gap * (days.length - 1)) / Math.max(days.length, 1);
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title} style={{ display: "block" }}>
      <title>{title}</title>
      {days.map((d, i) => {
        const down = d.uptimePct < 99.95;
        const severe = d.uptimePct < 99;
        const h = down ? height * (severe ? 0.55 : 0.75) : height;
        return (
          <rect
            key={d.day}
            x={i * (barW + gap)}
            y={height - h}
            width={barW}
            height={h}
            rx={1.5}
            fill={severe ? "var(--chart-bad)" : down ? "var(--chart-warn)" : "var(--chart-ok)"}
            opacity={down ? 1 : 0.55}
          >
            <title>{`${d.day}: ${d.uptimePct.toFixed(2)}% up`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
