import { formatPeriodShort } from "@reportpilot/core";

interface Props {
  history: Array<{ period: string; onTime: number; late: number; manualMinutes: number }>;
  sites: number;
}

/**
 * The business case as a figure. Manual reporting is costed at 3 hours per
 * client (the middle of the 2–4 h range agencies report), against the
 * measured review time per report.
 */
export function TimeSaved({ history, sites }: Props) {
  const manualHours = 3;
  const last = history[history.length - 1]!;
  const savedHours = Math.round(sites * manualHours - (sites * last.manualMinutes) / 60);
  const max = Math.max(...history.map((h) => h.onTime + h.late));
  return (
    <div>
      <p className="text-small text-ink-3">Time saved this cycle</p>
      <p className="mt-1 font-display text-[3.25rem] leading-none tracking-[-0.03em] text-ink tnum">
        {savedHours}<span className="ml-1 text-title text-ink-3">hours</span>
      </p>
      <p className="mt-2 max-w-[34ch] text-small text-ink-2">
        {sites} reports at {last.manualMinutes} minutes of review each, against about {manualHours} hours each by hand.
      </p>
      <figure className="mt-6">
        <figcaption className="mb-2 flex items-center justify-between text-micro text-ink-3">
          <span>Delivered on schedule</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-accent" />On time</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-watch" />Late</span>
          </span>
        </figcaption>
        <div className="flex h-20 items-end gap-2" role="img" aria-label={history.map((h) => `${formatPeriodShort(h.period)}: ${h.onTime} on time, ${h.late} late`).join("; ")}>
          {history.map((h, i) => (
            <div key={h.period} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-16 w-full flex-col justify-end gap-px">
                {h.late > 0 && <div className="w-full rounded-t-[2px] bg-watch origin-bottom animate-[grow_600ms_var(--ease-standard)_both]" style={{ height: `${(h.late / max) * 100}%`, animationDelay: `${i * 50}ms` }} />}
                <div className={`w-full bg-accent origin-bottom animate-[grow_600ms_var(--ease-standard)_both] ${h.late ? "" : "rounded-t-[2px]"} ${i === history.length - 1 ? "opacity-50" : ""}`} style={{ height: `${(h.onTime / max) * 100}%`, animationDelay: `${i * 50}ms` }} />
              </div>
              <span className="text-micro text-ink-3">{formatPeriodShort(h.period)}</span>
            </div>
          ))}
        </div>
      </figure>
    </div>
  );
}
