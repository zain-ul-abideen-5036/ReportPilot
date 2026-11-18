import type { Metadata } from "next";
import { ArrowRight, Plus } from "@phosphor-icons/react/dist/ssr";
import { formatPeriod } from "@reportpilot/core";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { CycleBand } from "@/components/dashboard/CycleBand";
import { Queue, type QueueItem } from "@/components/dashboard/Queue";
import { TimeSaved } from "@/components/dashboard/TimeSaved";
import { PortfolioTable } from "@/components/dashboard/PortfolioTable";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { currentUser, deliveryHistory, listAlerts, listAudit, listSites, now, period, statusCounts } from "@/lib/data";

export const metadata: Metadata = { title: "Overview" };

function greeting(d: Date) {
  const h = Number(d.toLocaleString("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function OverviewPage() {
  const rows = listSites();
  const counts = statusCounts();
  const alerts = listAlerts().filter((a) => a.state === "open");
  const waiting = rows.filter((r) => r.status === "in_review" || r.status === "draft" || r.status === "failed");

  const queue: QueueItem[] = [
    ...rows.filter((r) => r.status === "failed").map((row) => ({ kind: "report" as const, row })),
    ...alerts.filter((a) => a.severity === "critical").map((a) => ({ kind: "alert" as const, alert: a, row: a.row })),
    ...rows.filter((r) => r.status === "in_review").map((row) => ({ kind: "report" as const, row })),
    ...rows.filter((r) => r.status === "draft").map((row) => ({ kind: "report" as const, row })),
    ...alerts.filter((a) => a.severity === "warning").slice(0, 2).map((a) => ({ kind: "alert" as const, alert: a, row: a.row })),
  ];

  const date = now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" });

  return (
    <>
      <Topbar crumbs={[{ label: "Overview" }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader
          eyebrow={date}
          title={<>{greeting(now)}, {currentUser.name.split(" ")[0]}.</>}
          description={
            <>
              {waiting.length} {formatPeriod(period)} reports are waiting on you, and {alerts.length} alerts are open.
              {" "}Everything else is running on schedule.
            </>
          }
          actions={
            <>
              <ButtonLink href="/clients/new" variant="secondary"><Plus size={15} aria-hidden />Add client</ButtonLink>
              <ButtonLink href={`/reports/${waiting[0]?.site.id ?? ""}`} variant="primary">
                Start reviewing<ArrowRight size={15} aria-hidden />
              </ButtonLink>
            </>
          }
        />

        <CycleBand counts={counts} />

        <div className="mt-12 grid gap-x-12 gap-y-12 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="queue-heading">
            <SectionHeading id="queue-heading" title="Needs you" meta={`${queue.length} items`} />
            <Queue items={queue} />
          </section>
          <aside className="animate-enter [animation-delay:120ms]">
            <TimeSaved history={deliveryHistory} sites={rows.length} />
          </aside>
        </div>

        <section aria-labelledby="portfolio-heading" className="mt-14">
          <SectionHeading
            id="portfolio-heading"
            title="All sites"
            meta={`${rows.length} sites · ${formatPeriod(period)}`}
            action={<a href="/clients" className="text-small font-medium text-ink-3 hover:text-accent">Manage clients</a>}
          />
          <PortfolioTable rows={rows} />
        </section>

        <section aria-labelledby="activity-heading" className="mt-14 max-w-xl">
          <SectionHeading id="activity-heading" title="Recent activity" />
          <ActivityFeed entries={listAudit().slice(0, 6)} />
        </section>
      </div>
    </>
  );
}
