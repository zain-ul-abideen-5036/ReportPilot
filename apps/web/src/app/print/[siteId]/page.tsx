import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportDocument } from "@reportpilot/report";
import { getSession, verifyPrintSignature } from "@/lib/auth/server";
import { siteForPrint } from "@/lib/data";

/**
 * Bare report for Chromium to print. No app chrome, white page, A4
 * geometry. Readable with a signed-in session or a five-minute signed URL
 * from the PDF routes; anyone else gets a 404.
 */

export const metadata: Metadata = { robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PrintPage({ params, searchParams }: { params: Promise<{ siteId: string }>; searchParams: Promise<{ exp?: string; sig?: string }> }) {
  const { siteId } = await params;
  const { exp, sig } = await searchParams;
  const session = await getSession();
  if (!session && !(await verifyPrintSignature(siteId, exp, sig))) notFound();
  const hit = await siteForPrint(siteId);
  if (!hit || (session && !session.demo && hit.org.id !== session.org)) notFound();
  const { row, org } = hit;
  return (
    <div style={{ background: "#fff" }}>
      <style>{"@page{size:A4;margin:0}html,body{background:#fff!important;margin:0}"}</style>
      <ReportDocument
        report={row.report}
        narrative={row.narrative}
        org={{ name: org.name, primary: org.primary, accent: org.accent, footer: org.footer, initials: org.initials, logoUrl: org.logoUrl }}
        client={{ name: row.client.name, logoUrl: row.client.logoUrl }}
        preparedBy={row.manager.name}
        managerNotes={row.notes || null}
        generatedAt={row.generatedAt}
      />
    </div>
  );
}
