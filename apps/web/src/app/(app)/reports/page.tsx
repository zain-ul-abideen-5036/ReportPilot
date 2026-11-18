import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText } from "@phosphor-icons/react/dist/ssr";
import { formatPeriod, prettyUrl } from "@reportpilot/core";
import type { ReportStatus } from "@reportpilot/demo";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Monogram } from "@/components/ui/Monogram";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusLight } from "@/components/ui/StatusLight";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { STATUS_ORDER, listSites, period, statusCounts } from "@/lib/data";
import { STATUS_HINT, STATUS_LABEL } from "@/lib/status";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Reports" };

const GROUP_ORDER: ReportStatus[] = ["failed", "in_review", "draft", "collecting", "approved", "sent"];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const filter = STATUS_ORDER.includes(status as ReportStatus) ? (status as ReportStatus) : null;
  const rows = listSites();
  const counts = statusCounts();
  const groups = GROUP_ORDER.filter((s) => !filter || s === filter)
    .map((s) => ({ status: s, rows: rows.filter((r) => r.status === s) }))
    .filter((g) => g.rows.length > 0);

  return (
    <>
      <Topbar crumbs={[{ label: "Reports" }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader
          eyebrow="Monthly cycle"
          title={`${formatPeriod(period)} reports`}
          description="Generated on the 3rd of each month once Search Console marks the month final. Nothing reaches a client until someone approves it, unless auto-send is on."
        />

        <nav aria-label="Filter by status" className="-mx-1 mb-8 flex gap-1 overflow-x-auto border-b border-line pb-px [scrollbar-width:none]">
          {[null, ...GROUP_ORDER].map((s) => {
            const active = filter === s;
            const n = s ? counts[s] : rows.length;
            return (
              <Link
                key={s ?? "all"}
                href={s ? `/reports?status=${s}` : "/reports"}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative shrink-0 px-3 pt-1 pb-2.5 text-small transition-colors duration-(--duration-fast)",
                  active ? "font-medium text-ink" : "text-ink-3 hover:text-ink",
                )}
              >
                {s ? STATUS_LABEL[s] : "All"} <span className="tnum text-ink-4">{n}</span>
                <span aria-hidden className={cn("absolute inset-x-3 -bottom-px h-0.5 origin-center bg-accent transition-transform duration-(--duration-fast)", active ? "scale-x-100" : "scale-x-0")} />
              </Link>
            );
          })}
        </nav>

        {groups.length === 0 ? (
          <EmptyState icon={<FileText size={32} />} title={`No ${STATUS_LABEL[filter!].toLowerCase()} reports`} action={<ButtonLink href="/reports" size="sm">Show all reports</ButtonLink>}>
            Reports move through this state during the monthly cycle. Check back after the 3rd.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-10">
            {groups.map((g) => (
              <section key={g.status} aria-labelledby={`g-${g.status}`} className="animate-enter">
                <div className="mb-3 flex items-baseline gap-3">
                  <h2 id={`g-${g.status}`} className="text-body font-semibold text-ink">{STATUS_LABEL[g.status]}</h2>
                  <span className="text-small text-ink-3">{STATUS_HINT[g.status]}</span>
                </div>
                <ul className="stagger grid gap-3 md:grid-cols-2">
                  {g.rows.map((row) => (
                    <li key={row.site.id}>
                      <Link href={`/reports/${row.site.id}`} className="group press flex h-full flex-col rounded-lg bg-raised p-5 shadow-raised hover:shadow-sheet">
                        <div className="flex items-start gap-3">
                          <Monogram name={row.client.name} initials={row.client.initials} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-ink">{row.client.name}</p>
                            <p className="truncate text-small text-ink-3">{prettyUrl(row.site.url)} · {row.manager.name}</p>
                          </div>
                          <StatusBadge status={row.status} />
                        </div>
                        <p className="mt-4 line-clamp-2 font-display text-[1.0625rem] leading-6 text-ink-2">{row.narrative.summary}</p>
                        <div className="mt-auto flex items-center justify-between pt-5">
                          <span className="flex gap-1">
                            <StatusLight light={row.report.status.search} area="Search" />
                            <StatusLight light={row.report.status.speed} area="Speed" />
                            <StatusLight light={row.report.status.reliability} area="Reliability" />
                          </span>
                          <span className="flex items-center gap-1 text-small font-medium text-ink-3 group-hover:text-accent">
                            Open report
                            <ArrowRight size={14} className="transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
