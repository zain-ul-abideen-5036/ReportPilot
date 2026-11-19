import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Resend: sending, and the webhook that tells us what happened next.
 * Webhooks are signed with Svix (the scheme Resend uses): HMAC-SHA256 over
 * "id.timestamp.body" with the base64 secret after the "whsec_" prefix.
 */

export interface OutgoingEmail {
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: string }>;
  headers?: Record<string, string>;
}

export type Sender = (email: OutgoingEmail) => Promise<{ id: string }>;

export function resendSender(apiKey: string, fetcher: typeof fetch = fetch): Sender {
  return async (email) => {
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: email.from, to: email.to, reply_to: email.replyTo, subject: email.subject,
        html: email.html, text: email.text, attachments: email.attachments, headers: email.headers,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { id?: unknown };
    if (typeof body.id !== "string") throw new Error("Resend: response had no message id");
    return { id: body.id };
  };
}

/** Five minutes either side, as Svix recommends, to stop replayed requests. */
const TOLERANCE_S = 5 * 60;

export function signWebhook(secret: string, id: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

export function verifyWebhook(
  secret: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  now: Date = new Date(),
): boolean {
  if (!headers.id || !headers.timestamp || !headers.signature) return false;
  const ts = Number(headers.timestamp);
  if (!Number.isFinite(ts) || Math.abs(now.getTime() / 1000 - ts) > TOLERANCE_S) return false;
  const expected = Buffer.from(signWebhook(secret, headers.id, ts, body).slice(3));
  // The header can carry several space-separated signatures during secret rotation.
  return headers.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export type DeliveryEventType = "delivered" | "bounced" | "complained" | "delayed";

export interface DeliveryEvent {
  type: DeliveryEventType;
  emailId: string;
  to: string[];
  at: string;
}

/** Narrow a Resend webhook payload to the events we act on; anything else is ignored. */
export function parseDeliveryEvent(payload: unknown): DeliveryEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as { type?: unknown; created_at?: unknown; data?: { email_id?: unknown; to?: unknown } };
  const map: Record<string, DeliveryEventType> = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivery_delayed": "delayed",
  };
  const type = typeof p.type === "string" ? map[p.type] : undefined;
  const emailId = p.data?.email_id;
  if (!type || typeof emailId !== "string") return null;
  const to = Array.isArray(p.data?.to) ? p.data.to.filter((x): x is string => typeof x === "string") : [];
  return { type, emailId, to, at: typeof p.created_at === "string" ? p.created_at : new Date().toISOString() };
}
