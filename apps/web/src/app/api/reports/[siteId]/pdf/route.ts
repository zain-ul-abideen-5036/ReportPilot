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
export async function GET(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const row = getSite((await params).siteId);
  if (!row) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  try {
    const { printUrlToPdf } = await import("@reportpilot/report/pdf");
    const origin = new URL(req.url).origin;
    const pdf = await printUrlToPdf(`${origin}/print/${row.site.id}`, { cookie: req.headers.get("cookie") ?? undefined });
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
