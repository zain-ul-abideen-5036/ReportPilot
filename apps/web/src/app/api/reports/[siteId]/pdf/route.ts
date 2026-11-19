import { NextResponse } from "next/server";
import { formatPeriod } from "@reportpilot/core";
import { getSite } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Download the report as a PDF. In production the PDF is rendered once by
 * the pipeline and streamed from R2; in demo mode it is rendered on demand
 * by printing /print/[siteId] with the local Playwright Chromium.
 */
/*
 * Demo reports never change while the server runs, so each PDF is printed
 * once and served from memory after that. Concurrent requests for the same
 * report share one render.
 */
const rendered = new Map<string, Promise<Uint8Array>>();

export async function GET(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const row = getSite((await params).siteId);
  if (!row) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  try {
    let job = rendered.get(row.site.id);
    if (!job) {
      const { printUrlToPdf } = await import("@reportpilot/report/pdf");
      const origin = new URL(req.url).origin;
      job = printUrlToPdf(`${origin}/print/${row.site.id}`, { cookie: req.headers.get("cookie") ?? undefined });
      rendered.set(row.site.id, job);
      job.catch(() => rendered.delete(row.site.id));
    }
    const pdf = await job;
    const filename = `${row.client.name} - ${formatPeriod(row.report.period)}.pdf`.replace(/[^\w .&-]/g, "");
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${filename}"`,
        "cache-control": "private, max-age=300",
        "x-robots-tag": "noindex",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "PDF rendering is unavailable here. Run `npx playwright install chromium` and try again.", detail: (err as Error).message },
      { status: 503 },
    );
  }
}
