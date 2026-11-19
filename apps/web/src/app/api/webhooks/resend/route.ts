import { parseDeliveryEvent, verifyWebhook } from "@reportpilot/integrations";
import { database } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resend delivery events (delivered, bounced, complained). Signed with
 * Svix; anything unsigned or stale is rejected. A bounce flags the client
 * contact so next month's run skips it, and raises an alert.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret || !process.env.DATABASE_URL) return Response.json({ error: "Webhooks are not configured" }, { status: 503 });
  const body = await req.text();
  const ok = verifyWebhook(secret, {
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
  }, body);
  if (!ok) return Response.json({ error: "Invalid signature" }, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event = parseDeliveryEvent(payload);
  if (!event) return Response.json({ ignored: true });
  const { db, repo } = await database();
  const result = await repo.applyDeliveryEvent(db, event);
  return Response.json(result);
}
