import { formatSignedNumber, formatSignedPct, trendOf, isImprovement, type Change, type Direction, type Light } from "@reportpilot/core";
import type { ReportContext } from "./types";

/** Running header and footer on every inner page. */
export function Page({ ctx, folio, children, className = "" }: { ctx: ReportContext; folio: number; children: React.ReactNode; className?: string }) {
  return (
    <section id={`page-${folio}`} className={`rp-page ${className}`} aria-label={`Page ${folio}`}>
      <div className="rp-runhead">
        <span>{ctx.client.name} · {ctx.monthLabel}</span>
        <span>{ctx.org.name}</span>
      </div>
      {children}
      <div className="rp-runfoot">
        <span>{ctx.org.footer}</span>
        <span className="rp-folio">{String(folio).padStart(2, "0")} / {String(ctx.pageCount).padStart(2, "0")}</span>
      </div>
    </section>
  );
}

export function Kicker({ index, children }: { index: string; children: React.ReactNode }) {
  return (
    <div className="rp-kicker">
      <b>{index}</b>
      <span>{children}</span>
    </div>
  );
}

const LIGHT_TEXT: Record<Light, string> = { good: "On track", watch: "Watch", act: "Act now", unknown: "No data" };

export function LightTile({ area, light, note }: { area: string; light: Light; note: string }) {
  return (
    <div className="rp-light">
      <div className="rp-light-top"><span>{area}</span></div>
      <div className={`rp-light-state rp-${light}`}>
        <span className="rp-dot" aria-hidden />
        {LIGHT_TEXT[light]}
      </div>
      <p className="rp-light-note">{note}</p>
    </div>
  );
}

/** A change, coloured by whether it is good for this metric. */
export function ChangeText({ change, direction = "higher-is-better", mode = "pct" }: { change: Change; direction?: Direction; mode?: "pct" | "abs" }) {
  if (change.previous === null) return <span className="rp-flat">n/a</span>;
  const good = isImprovement(change, direction);
  const t = trendOf(change);
  const arrow = t === "up" ? "↑" : t === "down" ? "↓" : "→";
  const cls = good === null ? "rp-flat" : good ? "rp-up" : "rp-down";
  const text = mode === "pct" ? formatSignedPct(change.pct) : formatSignedNumber(change.delta);
  return <span className={cls}>{arrow} {text}</span>;
}

export function Unavailable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rp-unavailable">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

/** Inline bar for share-of-total columns. */
export function ShareBar({ share, max = 1 }: { share: number; max?: number }) {
  return <span className="rp-bar" style={{ width: `${Math.max(2, (share / max) * 64)}px` }} aria-hidden />;
}
