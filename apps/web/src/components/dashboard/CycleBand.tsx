import Link from "next/link";
import type { ReportStatus } from "@reportpilot/demo";
import { STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/cn";

const FLOW: ReportStatus[] = ["collecting", "draft", "in_review", "approved", "sent"];

const TONE: Record<ReportStatus, string> = {
  collecting: "bg-ink-4/50",
  draft: "bg-ink-3",
  in_review: "bg-watch",
  approved: "bg-accent/60",
  sent: "bg-accent",
  failed: "bg-act",
};

/**
 * The month's reports as one bar, split by stage. Reads left to right as
 * the pipeline does, so "how far through the cycle are we" is the shape.
 */
export function CycleBand({ counts }: { counts: Record<ReportStatus, number> }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
  const order: ReportStatus[] = [...FLOW, "failed"];
  return (
    <section aria-labelledby="cycle-heading" className="animate-enter">
      <h2 id="cycle-heading" className="sr-only">Reporting cycle progress</h2>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {order.map((s) =>
          counts[s] > 0 ? (
            <div key={s} className={cn("h-full first:rounded-l-full last:rounded-r-full", TONE[s])} style={{ flexGrow: counts[s] }} title={`${STATUS_LABEL[s]}: ${counts[s]}`} />
          ) : null,
        )}
      </div>
      <ol className="mt-4 grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-6">
        {order.map((s, i) => (
          <li key={s}>
            <Link href={`/reports?status=${s}`} className="group block">
              <span className="flex items-center gap-1.5 text-small text-ink-3 group-hover:text-ink-2">
                <span className={cn("size-1.5 rounded-full", TONE[s])} aria-hidden />
                {s === "failed" ? STATUS_LABEL[s] : `${i + 1}. ${STATUS_LABEL[s]}`}
              </span>
              <span className={cn("mt-0.5 block font-display text-title tnum", counts[s] === 0 ? "text-ink-4" : "text-ink")}>
                {counts[s]}
                <span className="ml-1 font-sans text-small text-ink-4">/ {total}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
