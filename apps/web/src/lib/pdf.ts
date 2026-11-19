import "server-only";
import { createHash } from "node:crypto";
import { formatPeriod } from "@reportpilot/core";
import { printSignature } from "./auth/server";
import type { SiteRow } from "./data";

/*
 * PDFs are printed from /print/[siteId] with a short-lived signed URL, so
 * the headless browser needs no session. Each distinct version of a
 * report (its notes, status and version number) is printed once per
 * server and then served from memory; concurrent requests share a render.
 */
const rendered = new Map<string, Promise<Uint8Array>>();

export async function sitePdf(row: SiteRow, origin: string, cookie?: string): Promise<Uint8Array> {
  const key = createHash("sha256").update(`${row.site.id}|${row.version}|${row.status}|${row.notes}|${cookie ? "c" : ""}`).digest("hex");
  let job = rendered.get(key);
  if (!job) {
    const { printUrlToPdf } = await import("@reportpilot/report/pdf");
    const exp = Math.floor(Date.now() / 1000) + 300;
    const sig = await printSignature(row.site.id, exp);
    // Protected Vercel previews answer with a login screen; the automation bypass secret lets the print through.
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
    job = printUrlToPdf(`${origin}/print/${row.site.id}?exp=${exp}&sig=${encodeURIComponent(sig)}`, {
      cookie,
      headers: bypass ? { "x-vercel-protection-bypass": bypass } : {},
    });
    rendered.set(key, job);
    job.catch(() => rendered.delete(key));
    if (rendered.size > 200) rendered.delete(rendered.keys().next().value!);
  }
  return job;
}

export function pdfResponse(pdf: Uint8Array, row: SiteRow) {
  const filename = `${row.client.name} - ${formatPeriod(row.report.period)}.pdf`.replace(/[^\w .&-]/g, "");
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${filename}"`,
      "cache-control": "private, max-age=60",
      "x-robots-tag": "noindex",
    },
  });
}

export function pdfUnavailable(err: unknown) {
  return Response.json(
    { error: "PDF rendering is unavailable here. Run `npx playwright install chromium` and try again.", detail: (err as Error).message },
    { status: 503 },
  );
}

/** Only demo-state cookies are forwarded to the print page; never the session. */
export function demoCookie(header: string | null): string | undefined {
  const match = header?.split(/;\s*/).find((c) => c.startsWith("rp_demo="));
  return match;
}
