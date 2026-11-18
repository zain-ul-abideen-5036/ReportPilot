import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportDocument } from "@reportpilot/report";
import { getSite, now, org } from "@/lib/data";

/** Bare report for Chromium to print. No app chrome, white page, A4 geometry. */

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function PrintPage({ params }: { params: Promise<{ siteId: string }> }) {
  const row = getSite((await params).siteId);
  if (!row) notFound();
  return (
    <div style={{ background: "#fff" }}>
      <style>{"@page{size:A4;margin:0}html,body{background:#fff!important;margin:0}"}</style>
      <ReportDocument
        report={row.report}
        narrative={row.narrative}
        org={{ name: org.name, primary: org.primary, accent: org.accent, footer: org.footer, initials: "NF" }}
        client={{ name: row.client.name }}
        preparedBy={row.manager.name}
        generatedAt={new Date(now.getTime() - 16 * 86_400_000).toISOString()}
      />
    </div>
  );
}
