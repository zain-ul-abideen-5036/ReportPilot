import { sharedReport } from "@/lib/data";
import { demoCookie, pdfResponse, pdfUnavailable, sitePdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** The client's PDF download: the same token rules as the web version (expiry, revocation). */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const hit = await sharedReport((await params).token);
  if (!hit) return Response.json({ error: "This link has expired or been revoked." }, { status: 404 });
  try {
    const res = pdfResponse(await sitePdf(hit.row, new URL(req.url).origin, demoCookie(req.headers.get("cookie"))), hit.row);
    res.headers.set("referrer-policy", "no-referrer");
    return res;
  } catch (err) {
    return pdfUnavailable(err);
  }
}
