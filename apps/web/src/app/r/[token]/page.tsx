import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DownloadSimple, LockSimple } from "@phosphor-icons/react/dist/ssr";
import { formatPeriod } from "@reportpilot/core";
import { ReportDocument, PAGE_COUNT } from "@reportpilot/report";
import { ScaledDocument } from "@/components/review/ScaledDocument";
import { sharedReport } from "@/lib/data";

/**
 * The client's web version. No account needed: the URL carries a random
 * 128-bit token that expires after 90 days and can be revoked from the
 * review page. Served with noindex headers (see next.config.ts) and
 * noindex metadata.
 */

export const metadata: Metadata = {
  title: "Monthly report",
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function SharedReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const hit = await sharedReport(token);
  if (!hit) notFound();
  const { row, org } = hit;
  const expires = row.shareExpiresAt
    ? new Date(row.shareExpiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  return (
    <div className="min-h-dvh bg-sunken">
      <header className="sticky top-0 z-(--z-sticky) border-b border-line bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[900px] items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: org.primary }}>{org.initials}</span>
            <span className="min-w-0">
              <span className="block truncate text-small font-medium text-ink">{row.client.name}</span>
              <span className="block truncate text-micro text-ink-3">{formatPeriod(row.report.period)} · from {org.name}</span>
            </span>
          </div>
          <a href={`/r/${token}/pdf`} className="press inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-small font-medium text-white" style={{ background: org.primary }}>
            <DownloadSimple size={14} aria-hidden />PDF
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-[900px] px-3 py-6 sm:px-6 sm:py-10">
        <ScaledDocument pages={PAGE_COUNT} gap={24}>
          <div className="[&_.rp-page]:rounded-[3px] [&_.rp-page]:shadow-sheet">
            <ReportDocument
              gap={24}
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
        <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-micro text-ink-3">
          <LockSimple size={12} aria-hidden />Private link for {row.client.name}.{expires && ` Expires ${expires}.`}
        </p>
      </main>
    </div>
  );
}
