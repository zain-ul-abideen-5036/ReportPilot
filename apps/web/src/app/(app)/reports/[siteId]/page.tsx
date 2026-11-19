import type { Metadata } from "next";
import { formatPeriod, prettyUrl } from "@reportpilot/core";
import { ReportDocument, PAGE_COUNT } from "@reportpilot/report";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Monogram } from "@/components/ui/Monogram";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScaledDocument } from "@/components/review/ScaledDocument";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { ReviewLayout } from "@/components/review/ReviewLayout";
import { findSite, getWorkspace } from "@/lib/data";
import { timeAgo } from "@/lib/time";

export async function generateMetadata({ params }: { params: Promise<{ siteId: string }> }): Promise<Metadata> {
  const ws = await getWorkspace();
  const { siteId } = await params;
  const row = ws.sites.find((r) => r.site.id === siteId);
  return { title: row ? `${row.client.name} · ${formatPeriod(ws.period)}` : "Report" };
}

const FAILURE_NOTE = "PageSpeed collection failed after three attempts. You can approve with the speed section marked unavailable, or wait for the next retry.";

const SECTIONS = ["Cover", "Summary", "Search", "Opportunities", "Speed", "Uptime", "Next steps", "Appendix"];
const GAP = 28;

export default async function ReviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const ws = await getWorkspace();
  const { period, org } = ws;
  const row = findSite(ws, (await params).siteId);

  return (
    <>
      <Topbar crumbs={[{ label: "Reports", href: "/reports" }, { label: row.client.name }]} period={period} />
      <div className="pt-8">
        <PageHeader
          eyebrow={
            <span className="flex flex-wrap items-center gap-2">
              <Monogram name={row.client.name} initials={row.client.initials} size="sm" />
              <span>{prettyUrl(row.site.url)}</span>
              <span className="text-ink-4">·</span>
              <span>Generated {timeAgo(row.generatedAt)}</span>
            </span>
          }
          title={<>{row.client.name}, <em className="text-ink-3">{formatPeriod(period)}</em></>}
          actions={<StatusBadge status={row.status} />}
        />
        <ReviewLayout
          pageNav={
            <nav aria-label="Report pages" className="mb-3 flex gap-1 overflow-x-auto pb-1 text-small [scrollbar-width:none]">
              {SECTIONS.map((s, i) => (
                <a key={s} href={`#page-${i + 1}`} className="press shrink-0 rounded-md px-2.5 py-1 text-ink-3 hover:bg-sunken hover:text-ink">
                  <span className="mr-1 font-display italic text-ink-4">{String(i + 1).padStart(2, "0")}</span>{s}
                </a>
              ))}
            </nav>
          }
          preview={
            <ScaledDocument pages={PAGE_COUNT} gap={GAP}>
              <div className="[&_.rp-page]:shadow-sheet [&_.rp-page]:rounded-[3px]">
                <ReportDocument
                  gap={GAP}
                  report={row.report}
                  narrative={row.narrative}
                  org={{ name: org.name, primary: org.primary, accent: org.accent, footer: org.footer, initials: org.initials, logoUrl: org.logoUrl }}
                  client={{ name: row.client.name, logoUrl: row.client.logoUrl }}
                  preparedBy={row.manager.name}
                  managerNotes={row.notes || null}
                  generatedAt={row.generatedAt}
                />
              </div>
            </ScaledDocument>
          }
          panel={
            <ReviewPanel
              key={row.reportId}
              siteId={row.site.id}
              clientId={row.client.id}
              status={row.status}
              findings={row.report.findings}
              contact={row.client.contact}
              narrativeSource={row.narrative.source}
              aiEnabled={row.client.aiEnabled}
              autoSend={row.client.autoSend}
              shareHref={row.shareToken ? `/r/${row.shareToken}` : null}
              pdfHref={`/api/reports/${row.site.id}/pdf`}
              version={row.version}
              notes={row.notes}
              canEdit={ws.user.role !== "viewer"}
              demo={ws.mode === "demo"}
              deliveryStatus={row.deliveryStatus}
              failureNote={row.status === "failed" ? FAILURE_NOTE : null}
            />
          }
        />
      </div>
    </>
  );
}
