import "server-only";
import { cookies } from "next/headers";
import { z } from "zod";

/**
 * The public demo has no database. Each visitor's changes (approvals,
 * notes, alert states, branding, onboarded clients, captured emails) are
 * kept in their own cookie, validated with Zod on every read, so the demo
 * behaves like the real product for them without anyone else seeing it.
 * With DATABASE_URL set this file is never used.
 */

const STATUS = z.enum(["collecting", "draft", "in_review", "approved", "sent", "failed"]);

const ReportPatch = z.object({
  s: STATUS.optional(),
  n: z.string().max(800).optional(),
  v: z.number().int().min(1).max(99).optional(),
  /** Share link revoked. A reissued link carries a new token. */
  rev: z.boolean().optional(),
  tok: z.string().regex(/^[0-9a-f]{32}$/).optional(),
  sentAt: z.string().optional(),
});

const Onboarded = z.object({
  id: z.string().regex(/^cli_new_[a-z0-9]+$/),
  name: z.string().min(1).max(80),
  contact: z.object({ name: z.string().max(80), email: z.string().email() }),
  tz: z.string().max(40),
  day: z.number().int().min(2).max(8),
  url: z.string().url().max(200),
  pages: z.array(z.string().max(120)).max(5),
  branded: z.string().max(80).nullable(),
  keyword: z.string().max(80).nullable(),
  at: z.string(),
});

export const DemoState = z.object({
  v: z.literal(1),
  reports: z.record(z.string(), ReportPatch).default({}),
  clients: z.record(z.string(), z.object({ auto: z.boolean().optional(), ai: z.boolean().optional() })).default({}),
  alerts: z.record(z.string(), z.enum(["open", "acknowledged", "resolved"])).default({}),
  brand: z.object({
    name: z.string().max(80), primary: z.string().regex(/^#[0-9a-f]{6}$/i), accent: z.string().regex(/^#[0-9a-f]{6}$/i),
    senderName: z.string().max(80), senderEmail: z.string().email(), footer: z.string().max(160),
  }).optional(),
  added: z.array(Onboarded).max(3).default([]),
  outbox: z.array(z.object({ siteId: z.string(), to: z.string(), subject: z.string().max(160), at: z.string() })).max(6).default([]),
  audit: z.array(z.object({ a: z.string().max(60), t: z.string().max(80), u: z.string().nullable(), at: z.string() })).max(12).default([]),
});

export type DemoState = z.infer<typeof DemoState>;
export type OnboardedClient = z.infer<typeof Onboarded>;

const COOKIE = "rp_demo";
const EMPTY: DemoState = { v: 1, reports: {}, clients: {}, alerts: {}, added: [], outbox: [], audit: [] };

export async function readDemoState(): Promise<DemoState> {
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!raw) return structuredClone(EMPTY);
  try {
    const parsed = DemoState.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return parsed.success ? parsed.data : structuredClone(EMPTY);
  } catch {
    return structuredClone(EMPTY);
  }
}

/** Browsers cap a cookie at about 4 KB; trim history before anything a visitor would miss. */
export async function writeDemoState(state: DemoState) {
  let s = DemoState.parse(state);
  let encoded = Buffer.from(JSON.stringify(s)).toString("base64url");
  while (encoded.length > 3800 && (s.audit.length > 2 || s.outbox.length > 1)) {
    s = { ...s, audit: s.audit.slice(0, Math.max(2, s.audit.length - 3)), outbox: s.outbox.slice(0, Math.max(1, s.outbox.length - 1)) };
    encoded = Buffer.from(JSON.stringify(s)).toString("base64url");
  }
  (await cookies()).set(COOKIE, encoded, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 30 * 86_400, secure: process.env.NODE_ENV === "production" });
}

export async function resetDemoState() {
  (await cookies()).delete(COOKIE);
}

export function pushAudit(state: DemoState, entry: { a: string; t: string; u: string | null }, now: Date) {
  state.audit = [{ ...entry, at: now.toISOString() }, ...state.audit].slice(0, 12);
}
