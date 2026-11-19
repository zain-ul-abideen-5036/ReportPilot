"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  canEdit, canManageAgency, formatPeriod, isValidTimeZone, nextStatus, notesEditable, prettyUrl, REPORT_DAY_MIN, REPORT_DAY_MAX,
  type ReviewAction,
} from "@reportpilot/core";
import { USERS } from "@reportpilot/demo";
import { requireSession } from "./auth/server";
import { SESSION_COOKIE, cookieOptions, isDemoMode, sessionSecret, signSession, type Session } from "./auth/session";
import { pushAudit, readDemoState, resetDemoState, writeDemoState } from "./demo-state";
import { database, demoShareToken, getWorkspace, initialsOf } from "./data";

/**
 * Every change the dashboard can make. Each action validates its input
 * with Zod, checks the signed-in user's role, then writes either to
 * Postgres (through the org-scoped repo, which also audits) or, in the
 * public demo, to this visitor's own demo state.
 */

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function actorOf(s: Session) {
  return { orgId: s.org, userId: s.uid, role: s.role };
}

async function guard(fn: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await fn();
  } catch (err) {
    const e = err as { message?: string; code?: string; digest?: string };
    if (e.digest?.startsWith("NEXT_REDIRECT")) throw err;
    if (e.code) return fail(e.message ?? "Something went wrong");
    console.error(err);
    return fail("Something went wrong. Nothing was changed.");
  }
}

const SiteId = z.string().min(1).max(80);

/* Review ----------------------------------------------------------------- */

const ReviewInput = z.object({ siteId: SiteId, action: z.enum(["submit", "approve", "approve_partial", "withdraw"]) });

export async function reviewReport(input: z.input<typeof ReviewInput>): Promise<ActionResult> {
  return guard(async () => {
    const { siteId, action } = ReviewInput.parse(input);
    const session = await requireSession();
    const ws = await getWorkspace();
    const row = ws.sites.find((r) => r.site.id === siteId);
    if (!row) return fail("Report not found");
    if (session.demo) {
      const next = nextStatus(action as ReviewAction, row.status, session.role);
      if (!next.ok) return fail(next.reason);
      const state = await readDemoState();
      state.reports[siteId] = { ...state.reports[siteId], s: next.to };
      pushAudit(state, { a: AUDIT_TEXT[action]!(formatPeriod(ws.period).split(" ")[0]!), t: row.client.name, u: session.uid }, new Date());
      await writeDemoState(state);
    } else {
      const { db, repo } = await database();
      await repo.transitionReport(db, actorOf(session), row.reportId, action);
    }
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

const AUDIT_TEXT: Record<string, (month: string) => string> = {
  submit: (m) => `submitted the ${m} report for review`,
  approve: (m) => `approved the ${m} report`,
  approve_partial: (m) => `approved the ${m} report without speed data`,
  withdraw: (m) => `withdrew approval of the ${m} report`,
};

const NotesInput = z.object({ siteId: SiteId, notes: z.string().max(800, "Keep the note under 800 characters so it fits the page.") });

export async function saveNotes(input: z.input<typeof NotesInput>): Promise<ActionResult> {
  return guard(async () => {
    const parsed = NotesInput.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);
    const { siteId, notes } = parsed.data;
    const session = await requireSession();
    if (!canEdit(session.role)) return fail("Viewers can read reports but not change them.");
    const ws = await getWorkspace();
    const row = ws.sites.find((r) => r.site.id === siteId);
    if (!row) return fail("Report not found");
    if (row.notes === notes) return { ok: true };
    if (session.demo) {
      if (!notesEditable(row.status)) return fail("Notes are locked once a report is approved.");
      const state = await readDemoState();
      state.reports[siteId] = { ...state.reports[siteId], n: notes };
      pushAudit(state, { a: `edited the note on the ${formatPeriod(ws.period).split(" ")[0]} report`, t: row.client.name, u: session.uid }, new Date());
      await writeDemoState(state);
    } else {
      const { db, repo } = await database();
      await repo.saveNotes(db, actorOf(session), row.reportId, notes);
    }
    revalidatePath(`/reports/${siteId}`);
    return { ok: true };
  });
}

/**
 * "Send now". In the demo, and wherever EMAIL_MODE=test or no Resend key
 * is configured, the email is captured to the outbox instead of sent,
 * which is what the end-to-end test asserts against.
 */
export async function sendNow(input: { siteId: string }): Promise<ActionResult<{ captured: boolean }>> {
  const result = await guard(async () => {
    const { siteId } = z.object({ siteId: SiteId }).parse(input);
    const session = await requireSession();
    const ws = await getWorkspace();
    const row = ws.sites.find((r) => r.site.id === siteId);
    if (!row) return fail("Report not found");
    const next = nextStatus("send", row.status, session.role);
    if (!next.ok) return fail(next.reason);
    if (!row.client.contact.email) return fail("This client has no contact email yet.");
    const subject = `Your ${formatPeriod(ws.period)} website report: ${prettyUrl(row.site.url)}`;
    const now = new Date();

    if (session.demo) {
      const state = await readDemoState();
      state.reports[siteId] = { ...state.reports[siteId], s: "sent", v: row.version + 1, sentAt: now.toISOString() };
      state.outbox = [{ siteId, to: row.client.contact.email, subject, at: now.toISOString() }, ...state.outbox].slice(0, 6);
      pushAudit(state, { a: `sent the ${formatPeriod(ws.period).split(" ")[0]} report (captured in test mode)`, t: row.client.name, u: session.uid }, now);
      await writeDemoState(state);
      revalidatePath("/", "layout");
      return { ok: true, captured: true };
    }

    const { deliverFromDashboard } = await import("./deliver");
    const origin = await requestOrigin();
    const sent = await deliverFromDashboard({ row, org: ws.org, period: ws.period, origin });
    const { db, repo } = await database();
    await repo.markSent(db, actorOf(session), row.reportId, { deliveryId: sent.deliveryId, pdfKey: sent.pdfKey, captured: sent.captured });
    if (sent.captured) {
      const { tables } = await import("@reportpilot/db");
      await db.insert(tables.auditLog).values({ orgId: session.org, userId: session.uid, action: "email.captured", entity: "report", entityId: row.reportId, meta: { to: row.client.contact.email, subject } });
    }
    revalidatePath("/", "layout");
    return { ok: true, captured: sent.captured };
  });
  return result as ActionResult<{ captured: boolean }>;
}

async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return process.env.APP_URL ?? `${proto}://${host}`;
}

/* Share links ------------------------------------------------------------ */

export async function revokeLink(input: { siteId: string }): Promise<ActionResult> {
  return guard(async () => {
    const { siteId } = z.object({ siteId: SiteId }).parse(input);
    const session = await requireSession();
    if (!canEdit(session.role)) return fail("Viewers cannot change client links.");
    const ws = await getWorkspace();
    const row = ws.sites.find((r) => r.site.id === siteId);
    if (!row) return fail("Report not found");
    if (session.demo) {
      const state = await readDemoState();
      state.reports[siteId] = { ...state.reports[siteId], rev: true, tok: undefined };
      pushAudit(state, { a: "revoked the client link", t: row.client.name, u: session.uid }, new Date());
      await writeDemoState(state);
    } else {
      const { db, repo } = await database();
      await repo.revokeShareLink(db, actorOf(session), row.reportId);
    }
    revalidatePath(`/reports/${siteId}`);
    return { ok: true };
  });
}

export async function reissueLink(input: { siteId: string }): Promise<ActionResult> {
  return guard(async () => {
    const { siteId } = z.object({ siteId: SiteId }).parse(input);
    const session = await requireSession();
    if (!canEdit(session.role)) return fail("Viewers cannot change client links.");
    const ws = await getWorkspace();
    const row = ws.sites.find((r) => r.site.id === siteId);
    if (!row) return fail("Report not found");
    if (session.demo) {
      const state = await readDemoState();
      state.reports[siteId] = { ...state.reports[siteId], rev: false, tok: demoShareToken(siteId, String(Date.now())) };
      pushAudit(state, { a: "issued a new client link", t: row.client.name, u: session.uid }, new Date());
      await writeDemoState(state);
    } else {
      const { db, repo } = await database();
      await repo.reissueShareLink(db, actorOf(session), row.reportId);
    }
    revalidatePath(`/reports/${siteId}`);
    return { ok: true };
  });
}

/* Client settings -------------------------------------------------------- */

const FlagInput = z.object({ clientId: z.string().min(1).max(80), flag: z.enum(["autoSend", "aiEnabled"]), on: z.boolean() });

export async function setClientFlag(input: z.input<typeof FlagInput>): Promise<ActionResult> {
  return guard(async () => {
    const { clientId, flag, on } = FlagInput.parse(input);
    const session = await requireSession();
    if (!canEdit(session.role)) return fail("Viewers cannot change client settings.");
    if (session.demo) {
      const ws = await getWorkspace();
      const client = ws.sites.find((r) => r.client.id === clientId)?.client;
      if (!client) return fail("Client not found");
      const state = await readDemoState();
      state.clients[clientId] = { ...state.clients[clientId], [flag === "autoSend" ? "auto" : "ai"]: on };
      pushAudit(state, { a: `turned ${flag === "autoSend" ? "auto-send" : "AI wording"} ${on ? "on" : "off"}`, t: client.name, u: session.uid }, new Date());
      await writeDemoState(state);
    } else {
      const { db, repo } = await database();
      await repo.setClientFlag(db, actorOf(session), clientId, flag, on);
    }
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

/* Alerts ----------------------------------------------------------------- */

const AlertInput = z.object({ alertId: z.string().min(1).max(80), state: z.enum(["acknowledged", "resolved"]) });

export async function updateAlert(input: z.input<typeof AlertInput>): Promise<ActionResult> {
  return guard(async () => {
    const { alertId, state: next } = AlertInput.parse(input);
    const session = await requireSession();
    if (!canEdit(session.role)) return fail("Viewers cannot change alerts.");
    if (session.demo) {
      const ws = await getWorkspace();
      const alert = ws.alerts.find((a) => a.id === alertId);
      if (!alert) return fail("Alert not found");
      const state = await readDemoState();
      state.alerts[alertId] = next;
      pushAudit(state, { a: `${next} an alert`, t: alert.clientName, u: session.uid }, new Date());
      await writeDemoState(state);
    } else {
      const { db, repo } = await database();
      await repo.setAlertState(db, actorOf(session), alertId, next);
    }
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

/* Branding --------------------------------------------------------------- */

const Hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a six-digit hex colour, like #1f4d3f.");

const BrandInput = z.object({
  name: z.string().trim().min(1, "Enter the agency name.").max(80),
  primary: Hex,
  accent: Hex,
  senderName: z.string().trim().min(1, "Enter a sender name.").max(80),
  senderEmail: z.string().trim().email("Enter a valid sender address."),
  footer: z.string().trim().max(160, "Keep the footer under 160 characters."),
  /** A downscaled PNG as a data: URL, made in the browser. Up to ~150 KB. */
  logo: z.string().regex(/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/).max(200_000).nullable().optional(),
});

export async function saveBrand(input: z.input<typeof BrandInput>): Promise<ActionResult> {
  return guard(async () => {
    const parsed = BrandInput.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);
    const b = parsed.data;
    const session = await requireSession();
    if (!canManageAgency(session.role)) return fail("Only the agency owner can change branding. Sign in as the owner to try it.");
    if (session.demo) {
      const state = await readDemoState();
      state.brand = { name: b.name, primary: b.primary, accent: b.accent, senderName: b.senderName, senderEmail: b.senderEmail, footer: b.footer };
      pushAudit(state, { a: "updated the brand", t: b.name, u: session.uid }, new Date());
      await writeDemoState(state);
    } else {
      const { db, repo } = await database();
      const logoKey = b.logo === undefined ? undefined : b.logo === null ? null : await storeLogo(`logos/${session.org}/agency.png`, b.logo);
      await repo.updateBrand(db, actorOf(session), {
        name: b.name, brandPrimary: b.primary, brandAccent: b.accent, senderName: b.senderName, senderEmail: b.senderEmail, footer: b.footer,
        ...(logoKey !== undefined && { brandLogoKey: logoKey }),
      });
    }
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

/** R2 when configured; otherwise the small data: URL itself is stored in the key column. */
async function storeLogo(key: string, dataUrl: string): Promise<string> {
  const { r2FromEnv } = await import("./r2");
  const r2 = r2FromEnv();
  if (!r2) return dataUrl;
  const [, mime, b64] = /^data:([^;]+);base64,(.*)$/.exec(dataUrl)!;
  await r2.put(key, Buffer.from(b64!, "base64"), mime!);
  return key;
}

/* Onboarding ------------------------------------------------------------- */

const KeyPage = z.string().trim().regex(/^\/[^\s]*$/, "Key pages are paths that start with /, like /services/.");

const ClientInput = z.object({
  name: z.string().trim().min(1, "Enter the client's business name.").max(80),
  contactName: z.string().trim().max(80),
  contactEmail: z.string().trim().email("Enter an email address reports can be sent to."),
  timezone: z.string().refine(isValidTimeZone, "Choose a time zone from the list."),
  reportDay: z.number().int().min(REPORT_DAY_MIN).max(REPORT_DAY_MAX),
  url: z.string().trim().url("Enter the full address, starting with https://").refine((u) => /^https?:\/\//.test(u), "Use an http or https address."),
  keyPages: z.array(KeyPage).min(1).max(5, "Up to five key pages."),
  branded: z.string().trim().max(80).refine((v) => { try { new RegExp(v); return true; } catch { return false; } }, "Brand terms must be words separated by |."),
  keyword: z.string().trim().max(80),
  gscProperty: z.string().trim().max(200).optional(),
  logo: z.string().regex(/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/).max(200_000).nullable().optional(),
});

export async function createClient(input: z.input<typeof ClientInput>): Promise<ActionResult<{ siteId: string; clientId: string }>> {
  const r = await guard(async () => {
    const parsed = ClientInput.safeParse(input);
    if (!parsed.success) return fail(parsed.error.issues[0]!.message);
    const c = parsed.data;
    const session = await requireSession();
    if (!canEdit(session.role)) return fail("Viewers cannot add clients.");
    const pages = [...new Set(c.keyPages)];
    if (session.demo) {
      const state = await readDemoState();
      const id = `cli_new_${Date.now().toString(36)}`;
      state.added = [{
        id, name: c.name, contact: { name: c.contactName || c.name, email: c.contactEmail }, tz: c.timezone, day: c.reportDay, url: c.url,
        pages, branded: c.branded || null, keyword: c.keyword || null, at: new Date().toISOString(),
      }, ...state.added].slice(0, 3);
      pushAudit(state, { a: "added a client", t: c.name, u: session.uid }, new Date());
      await writeDemoState(state);
      revalidatePath("/", "layout");
      return { ok: true, clientId: id, siteId: `site_${id.slice(4)}` };
    }
    const { db, repo } = await database();
    const host = new URL(c.url).hostname.replace(/^www\./, "");
    const created = await repo.createClientWithSite(db, actorOf(session), {
      name: c.name,
      logoKey: c.logo ? await storeLogo(`logos/${session.org}/${host}.png`, c.logo) : null,
      contacts: [{ name: c.contactName || c.name, email: c.contactEmail }],
      timezone: c.timezone,
      reportDay: c.reportDay,
      site: { url: c.url, gscProperty: c.gscProperty || `sc-domain:${host}`, keyPages: pages, brandedRegex: c.branded || null, uptimeKeyword: c.keyword || null },
    });
    await dispatchWorkflow("backfill.yml", { site: created.site.id, months: "16" });
    revalidatePath("/", "layout");
    return { ok: true, clientId: created.client.id, siteId: created.site.id };
  });
  return r as ActionResult<{ siteId: string; clientId: string }>;
}

/**
 * "Test connection": asks Search Console for the property with the
 * service account. In the demo there is no Google account behind the
 * sample agency, so it says so instead of pretending.
 */
export async function testConnection(input: { url: string; property?: string }): Promise<ActionResult<{ message: string; simulated: boolean }>> {
  const r = await guard(async () => {
    const { url, property } = z.object({ url: z.string().url(), property: z.string().max(200).optional() }).parse(input);
    await requireSession();
    const host = new URL(url).hostname.replace(/^www\./, "");
    const prop = property || `sc-domain:${host}`;
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!json) {
      return { ok: true, simulated: true, message: `Demo mode: no service account is configured, so access to ${prop} was not checked. With GOOGLE_SERVICE_ACCOUNT_JSON set, this calls Search Console.` };
    }
    const { GoogleAuth, SearchConsole, parseServiceAccount } = await import("@reportpilot/integrations");
    const gsc = new SearchConsole(new GoogleAuth(parseServiceAccount(json)));
    const end = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const start = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10);
    try {
      await gsc.queryPage(prop, { startDate: start, endDate: end, dimensions: ["date"], rowLimit: 1, dataState: "all" });
      return { ok: true, simulated: false, message: `Access to ${prop} confirmed. 16 months of history will be backfilled.` };
    } catch (err) {
      const msg = (err as Error).message;
      return fail(/403|permission/i.test(msg)
        ? `The service account cannot read ${prop} yet. Check it was added as a Restricted user on that exact property.`
        : `Search Console did not answer: ${msg}`);
    }
  });
  return r as ActionResult<{ message: string; simulated: boolean }>;
}

/**
 * Starts a GitHub Actions workflow when a token is configured. Without
 * one, the daily job still picks up owed backfills; this only makes the
 * first report arrive sooner.
 */
async function dispatchWorkflow(file: string, inputs: Record<string, string>) {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) return false;
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/${file}/dispatches`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "content-type": "application/json" },
    body: JSON.stringify({ ref: process.env.GITHUB_REF_NAME ?? "main", inputs }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export async function generateSample(input: { siteId: string }): Promise<ActionResult<{ href: string; queued: boolean }>> {
  const r = await guard(async () => {
    const { siteId } = z.object({ siteId: SiteId }).parse(input);
    const session = await requireSession();
    if (!canEdit(session.role)) return fail("Viewers cannot generate reports.");
    if (session.demo) return { ok: true, href: `/reports/${siteId}`, queued: false };
    const queued = await dispatchWorkflow("monthly-reports.yml", { site: siteId, dry_run: "true" });
    return { ok: true, href: `/reports/${siteId}`, queued };
  });
  return r as ActionResult<{ href: string; queued: boolean }>;
}

/* Sign-in ---------------------------------------------------------------- */

const RoleInput = z.enum(["owner", "manager", "viewer"]);

/** The public demo: sign in as one of the sample agency's people. Disabled once a database is configured. */
export async function signInDemo(formData: FormData) {
  if (!isDemoMode()) redirect("/sign-in?error=demo-off");
  const role = RoleInput.catch("manager").parse(formData.get("role"));
  const next = safeNext(formData.get("next"));
  const user = USERS.find((u) => u.role === role)!;
  const token = await signSession({ uid: user.id, org: "org_northfold", role, name: user.name, email: user.email, demo: true }, sessionSecret()!);
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
  redirect(next);
}

const EmailInput = z.object({ email: z.string().trim().email(), next: z.string().optional() });

export async function requestSignInLink(_prev: unknown, formData: FormData): Promise<{ sent: boolean; error?: string }> {
  const parsed = EmailInput.safeParse({ email: formData.get("email"), next: formData.get("next") ?? undefined });
  if (!parsed.success) return { sent: false, error: "Enter a valid email address." };
  if (isDemoMode()) return { sent: false, error: "Email sign-in needs a database. Use the demo accounts below." };
  if (!sessionSecret()) return { sent: false, error: "AUTH_SECRET is not set on the server." };
  const { db, repo } = await database();
  const token = await repo.createLoginToken(db, parsed.data.email);
  if (token) {
    const origin = await requestOrigin();
    const link = `${origin}/auth/callback?token=${encodeURIComponent(token)}&next=${encodeURIComponent(safeNext(parsed.data.next))}`;
    const key = process.env.RESEND_API_KEY;
    if (key) {
      const { resendSender } = await import("@reportpilot/integrations");
      await resendSender(key)({
        from: process.env.AUTH_EMAIL_FROM ?? "ReportPilot <sign-in@reportpilot.app>",
        to: [parsed.data.email],
        subject: "Your ReportPilot sign-in link",
        text: `Sign in to ReportPilot:\n\n${link}\n\nThe link works once and expires in 15 minutes. If you did not ask for it, ignore this email.`,
        html: `<p>Sign in to ReportPilot:</p><p><a href="${link}">Sign in</a></p><p style="color:#777">The link works once and expires in 15 minutes. If you did not ask for it, ignore this email.</p>`,
      });
    } else {
      // Local development without email: the link is printed to the server log.
      console.info(JSON.stringify({ msg: "sign-in link (RESEND_API_KEY not set)", link }));
    }
  }
  // Same answer whether or not the address belongs to a member, so the form cannot be used to find accounts.
  return { sent: true };
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/sign-in");
}

export async function resetDemo() {
  await requireSession();
  if (!isDemoMode()) return;
  await resetDemoState();
  revalidatePath("/", "layout");
}

function safeNext(value: FormDataEntryValue | string | null | undefined): string {
  const v = typeof value === "string" ? value : "";
  // Only same-site paths, never "//evil.example".
  return /^\/(?!\/)[\w\-/?=&.%]*$/.test(v) ? v : "/dashboard";
}

