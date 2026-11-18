import type { Metadata } from "next";
import { formatDuration } from "@reportpilot/core";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { AlertList, type AlertView } from "@/components/alerts/AlertList";
import { listAlerts, period } from "@/lib/data";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Alerts" };

const RULES = [
  { title: "Downtime", body: "Two failed checks 30 seconds apart. A page showing an error message counts as down." },
  { title: "SSL and domain", body: "Warning at 21 and 30 days before expiry, critical at 7 and 10." },
  { title: "Traffic drop", body: "Organic clicks down 20% or more week on week, compared on the same weekdays." },
  { title: "Speed regression", body: "A Core Web Vital worsens 20% or more across four weeks of field data." },
];

export default function AlertsPage() {
  const alerts: AlertView[] = listAlerts().map((a) => ({
    id: a.id,
    kind: a.kind,
    severity: a.severity,
    state: a.state,
    title: a.title,
    detail: a.detail,
    client: a.row.client.name,
    initials: a.row.client.initials,
    raised: timeAgo(a.raisedAt),
    resolvedIn: a.kind === "downtime" && a.resolvedAt ? formatDuration(a.raisedAt, a.resolvedAt) : null,
  }));
  const open = alerts.filter((a) => a.state === "open").length;
  return (
    <>
      <Topbar crumbs={[{ label: "Alerts" }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader
          eyebrow="Between reports"
          title="Alerts"
          description={`${open} open. Problems are caught when they happen, not at the end of the month. Alerts go to the account manager by email as they are raised.`}
        />
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0"><AlertList initial={alerts} /></div>
          <aside className="lg:pt-12">
            <h2 className="mb-3 text-small font-semibold text-ink">When an alert is raised</h2>
            <dl className="flex flex-col gap-4">
              {RULES.map((r) => (
                <div key={r.title}>
                  <dt className="text-small font-medium text-ink-2">{r.title}</dt>
                  <dd className="mt-0.5 text-small text-ink-3">{r.body}</dd>
                </div>
              ))}
            </dl>
          </aside>
        </div>
      </div>
    </>
  );
}
