import type { Metadata } from "next";
import Link from "next/link";
import { ArrowClockwise, CheckCircle, CircleNotch, Clock, Heartbeat, Pulse, WarningOctagon, CalendarCheck } from "@phosphor-icons/react/dist/ssr";
import { STAGES, type Stage } from "@reportpilot/demo";
import { formatPeriod } from "@reportpilot/core";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { Monogram } from "@/components/ui/Monogram";
import { listRuns, period } from "@/lib/data";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Pipeline" };

const STAGE_LABEL: Record<Stage, string> = {
  plan: "Plan", collect: "Collect", calculate: "Calculate", insights: "Insights",
  narrative: "Narrative", render: "Render", review: "Review", deliver: "Deliver",
};

type Cell = "done" | "running" | "failed" | "waiting" | "pending";

function cells(stage: Stage, status: string): Cell[] {
  const at = STAGES.indexOf(stage);
  return STAGES.map((_, i) => {
    if (i < at) return "done";
    if (i > at) return "pending";
    if (status === "succeeded") return "done";
    if (status === "running") return "running";
    if (status === "failed") return "failed";
    return "waiting";
  });
}

const CELL: Record<Cell, { cls: string; label: string }> = {
  done: { cls: "bg-accent", label: "Done" },
  running: { cls: "bg-accent/40 animate-pulse", label: "Running" },
  failed: { cls: "bg-act", label: "Failed" },
  waiting: { cls: "bg-watch", label: "Waiting" },
  pending: { cls: "bg-line", label: "Not started" },
};

const JOBS = [
  { icon: Pulse, name: "Uptime checks", where: "Cloudflare Workers cron", schedule: "Every 5 minutes", last: "3 min ago", detail: "2,304 checks today, 0 failures in the last hour" },
  { icon: CalendarCheck, name: "Weekly snapshot", where: "GitHub Actions", schedule: "Mondays 05:00", last: "3 days ago", detail: "PageSpeed median of 3, CrUX history, sitemaps, URL Inspection" },
  { icon: ArrowClockwise, name: "Monthly reports", where: "GitHub Actions + Playwright", schedule: "3rd of the month, 06:00", last: "16 days ago", detail: "Next run 3 Dec. Retries daily until Search Console marks the month final" },
];

export default function PipelinePage() {
  const runs = listRuns();
  const failed = runs.filter((r) => r.status === "failed");
  return (
    <>
      <Topbar crumbs={[{ label: "Pipeline" }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader
          eyebrow={`${formatPeriod(period)} cycle`}
          title="Pipeline"
          description="Every stage writes its result to the database, so a failed run resumes where it stopped. One source failing never blocks the others."
        />

        <section aria-labelledby="matrix-heading" className="min-w-0">
          <SectionHeading id="matrix-heading" title="Stages by site" meta={`${runs.length} runs`} />
          <div className="relative overflow-x-auto rounded-lg bg-raised shadow-raised">
            <table className="w-full min-w-[720px] text-left text-small">
              <thead>
                <tr className="border-b border-line text-ink-3">
                  <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Site</th>
                  {STAGES.map((s, i) => (
                    <th key={s} scope="col" className="px-1 py-2.5 text-center font-medium">
                      <span className="mr-0.5 font-display text-ink-4 italic">{i}</span> {STAGE_LABEL[s]}
                    </th>
                  ))}
                  <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-medium">Attempts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {runs.map((r) => (
                  <tr key={r.id}>
                    <td className="py-3 pr-3 pl-5">
                      <Link href={`/reports/${r.siteId}`} className="flex items-center gap-2.5 hover:text-accent">
                        <Monogram name={r.row.client.name} initials={r.row.client.initials} size="sm" />
                        <span className="truncate font-medium text-ink">{r.row.client.name}</span>
                      </Link>
                    </td>
                    {cells(r.stage, r.status).map((c, i) => (
                      <td key={STAGES[i]} className="px-1 py-3">
                        <span title={`${STAGE_LABEL[STAGES[i]!]}: ${CELL[c].label}`} className={cn("mx-auto block h-1.5 w-full max-w-14 rounded-full", CELL[c].cls)}>
                          <span className="sr-only">{STAGE_LABEL[STAGES[i]!]}: {CELL[c].label}</span>
                        </span>
                      </td>
                    ))}
                    <td className="py-3 pr-5 pl-3 text-right tnum text-ink-2">
                      {r.attempts}
                      {r.status === "failed" && <WarningOctagon size={13} weight="fill" className="ml-1 inline text-act" aria-label="failed" />}
                      {r.status === "running" && <CircleNotch size={13} className="ml-1 inline animate-spin text-accent" aria-label="running" />}
                      {r.status === "succeeded" && <CheckCircle size={13} weight="fill" className="ml-1 inline text-good" aria-label="succeeded" />}
                      {r.status === "waiting" && <Clock size={13} className="ml-1 inline text-watch" aria-label="waiting" />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-micro text-ink-3">
            {(Object.keys(CELL) as Cell[]).map((c) => (
              <span key={c} className="flex items-center gap-1.5"><span className={cn("h-1.5 w-4 rounded-full", CELL[c].cls.replace(" animate-pulse", ""))} />{CELL[c].label}</span>
            ))}
          </p>
        </section>

        {failed.length > 0 && (
          <section aria-labelledby="errors-heading" className="mt-12">
            <SectionHeading id="errors-heading" title="Errors" meta="after three attempts with exponential backoff" />
            {failed.map((r) => (
              <div key={r.id} className="rounded-lg bg-act-soft/60 p-4">
                <p className="text-small font-medium text-act">{r.row.client.name} · {STAGE_LABEL[r.stage]}</p>
                <p className="mt-1 font-mono text-[12px] leading-5 break-words text-ink-2">{r.error}</p>
              </div>
            ))}
          </section>
        )}

        <section aria-labelledby="jobs-heading" className="mt-12">
          <SectionHeading id="jobs-heading" title="Scheduled jobs" action={
            <span className="flex items-center gap-1.5 text-small text-good"><Heartbeat size={14} weight="fill" aria-hidden />Heartbeats healthy</span>
          } />
          <ul className="divide-y divide-line">
            {JOBS.map((j) => (
              <li key={j.name} className="grid grid-cols-1 gap-x-6 gap-y-1 py-4 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,2fr)]">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 items-center justify-center rounded-md bg-accent-soft text-accent"><j.icon size={16} aria-hidden /></span>
                  <div>
                    <p className="font-medium text-ink">{j.name}</p>
                    <p className="text-micro text-ink-3">{j.where}</p>
                  </div>
                </div>
                <div className="text-small text-ink-2 sm:pt-1">{j.schedule}<span className="block text-micro text-ink-3">last run {j.last}</span></div>
                <p className="text-small text-ink-3 sm:pt-1">{j.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
