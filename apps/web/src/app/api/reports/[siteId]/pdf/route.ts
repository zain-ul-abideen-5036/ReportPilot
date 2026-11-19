import { getWorkspace } from "@/lib/data";
import { demoCookie, pdfResponse, pdfUnavailable, sitePdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Starting Chromium in a cold serverless function takes a few seconds.
export const maxDuration = 60;

/** The PDF for a signed-in member of the agency. Clients use /r/[token]/pdf. */
export async function GET(req: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const ws = await getWorkspace();
  const { siteId } = await params;
  const row = ws.sites.find((r) => r.site.id === siteId);
  if (!row) return Response.json({ error: "Report not found" }, { status: 404 });
  try {
    return pdfResponse(await sitePdf(row, new URL(req.url).origin, demoCookie(req.headers.get("cookie"))), row);
  } catch (err) {
    return pdfUnavailable(err);
  }
}
