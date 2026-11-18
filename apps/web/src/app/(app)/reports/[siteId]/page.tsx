import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatPeriod, prettyUrl } from "@reportpilot/core";
import { ReportDocument, PAGE_COUNT } from "@reportpilot/report";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Monogram } from "@/components/ui/Monogram";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ScaledDocument } from "@/components/review/ScaledDocument";
import { ReviewPanel } from "@/components/review/ReviewPanel";
import { ReviewLayout } from "@/components/review/ReviewLayout";
import { getSite, listSites, now, org, period, shareToken } from "@/lib/data";
import { timeAgo } from "@/lib/time";

export function generateStaticParams() {
  return listSites().map((r) => ({ siteId: r.site.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ siteId: string }> }): Promise<Metadata> {
  const row = getSite((await params).siteId);
  return { title: row ? `${row.client.name} · ${formatPeriod(period)}` : "Report" };
}

const SAMPLE_NOTES: Record<string, string> = {
  site_harlow: "October was about the implants page. We rewrote it in September and it is now the second-biggest source of new patient enquiries.\n\nIn November we will tackle the titles on the treatment pages, which Google shows often but which few people click.",
  site_pennine: "The drop in clicks lines up with Google's core update in the second week of October, which hit category pages across outdoor retail. Competitors saw the same pattern. We are reviewing the walking boots collection first.",
};

const SECTIONS = ["Cover", "Summary", "Search", "Opportunities", "Speed", "Uptime", "Next steps", "Appendix"];
const GAP = 28;

export default async function ReviewPage({ params }: { params: Promise<{ siteId: string }> }) {
  const row = getSite((await params).siteId);
  if (!row) notFound();
  const notes = SAMPLE_NOTES[row.site.id] ?? "";

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
              <span>Generated {timeAgo(new Date(now.getTime() - 16 * 86_400_000).toISOString())}</span>
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
                  org={{ name: org.name, primary: org.primary, accent: org.accent, footer: org.footer, initials: "NF" }}
                  client={{ name: row.client.name }}
                  preparedBy={row.manager.name}
                  managerNotes={notes || null}
                  generatedAt={new Date(now.getTime() - 16 * 86_400_000).toISOString()}
                />
              </div>
            </ScaledDocument>
          }
          panel={
            <ReviewPanel
              initialStatus={row.status}
              findings={row.report.findings}
              contact={row.client.contact}
              narrativeSource={row.narrative.source}
              aiEnabled={row.client.aiEnabled}
              autoSend={row.client.autoSend}
              shareHref={`/r/${shareToken(row.site.id)}`}
              pdfHref={`/api/reports/${row.site.id}/pdf`}
              version={row.status === "sent" ? 3 : 2}
              initialNotes={notes}
            />
          }
        />
      </div>
    </>
  );
}
