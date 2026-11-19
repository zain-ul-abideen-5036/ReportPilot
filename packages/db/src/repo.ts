import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { nextStatus, notesEditable, canEdit, canManageAgency, type ReviewAction, type Role } from "@reportpilot/core";
import * as schema from "./schema";

/**
 * Everything the dashboard reads and writes. Every function takes the
 * signed-in user's organisation and checks that the row it touches
 * belongs to it, so a guessed id from another agency gets "not found".
 * Every change is written to audit_log in the same transaction.
 *
 * Works with any Drizzle Postgres driver: postgres.js in production,
 * PGlite in the tests.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema, any>;

const { alerts, auditLog, clients, jobRuns, loginTokens, memberships, organizations, reportVersions, reports, sites, users } = schema;

export interface Actor {
  orgId: string;
  userId: string | null;
  role: Role;
}

export class RepoError extends Error {
  constructor(message: string, readonly code: "not_found" | "forbidden" | "invalid") {
    super(message);
  }
}

const SHARE_DAYS = 90;
export const newShareToken = () => randomBytes(16).toString("hex");
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/* Reads ------------------------------------------------------------------ */

export async function getOrg(db: AnyDb, orgId: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId));
  if (!org) throw new RepoError("Organisation not found", "not_found");
  return org;
}

export type SiteRecord = Awaited<ReturnType<typeof listSiteRecords>>[number];

/** Every active site with its client, manager and most recent report. */
export async function listSiteRecords(db: AnyDb, orgId: string) {
  const rows = await db
    .select({ site: sites, client: clients, manager: users })
    .from(sites)
    .innerJoin(clients, eq(clients.id, sites.clientId))
    .leftJoin(users, eq(users.id, clients.managerId))
    .where(and(eq(clients.orgId, orgId), eq(sites.active, true)))
    .orderBy(clients.name);
  if (rows.length === 0) return [];
  const latest = await db
    .selectDistinctOn([reports.siteId])
    .from(reports)
    .where(inArray(reports.siteId, rows.map((r) => r.site.id)))
    .orderBy(reports.siteId, desc(reports.period));
  const bySite = new Map(latest.map((r) => [r.siteId, r]));
  return rows.map((r) => ({ ...r, report: bySite.get(r.site.id) ?? null }));
}

export async function listAlertRecords(db: AnyDb, orgId: string) {
  return db
    .select({ alert: alerts, siteId: sites.id, clientName: clients.name })
    .from(alerts)
    .innerJoin(sites, eq(sites.id, alerts.siteId))
    .innerJoin(clients, eq(clients.id, sites.clientId))
    .where(eq(clients.orgId, orgId))
    .orderBy(desc(alerts.raisedAt))
    .limit(200);
}

export async function listRunRecords(db: AnyDb, orgId: string, limit = 300) {
  return db
    .select({ run: jobRuns, clientName: clients.name, siteId: sites.id })
    .from(jobRuns)
    .innerJoin(sites, eq(sites.id, jobRuns.siteId))
    .innerJoin(clients, eq(clients.id, sites.clientId))
    .where(eq(clients.orgId, orgId))
    .orderBy(desc(jobRuns.startedAt))
    .limit(limit);
}

export async function listAuditRecords(db: AnyDb, orgId: string, limit = 50) {
  return db
    .select({ entry: auditLog, user: users })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(eq(auditLog.orgId, orgId))
    .orderBy(desc(auditLog.at))
    .limit(limit);
}

export async function listVersions(db: AnyDb, orgId: string, reportId: string) {
  await ownedReport(db, orgId, reportId);
  return db.select().from(reportVersions).where(eq(reportVersions.reportId, reportId)).orderBy(desc(reportVersions.version));
}

/** The client's web link. Public by design, so it checks the token's expiry and revocation itself. */
export async function reportByShareToken(db: AnyDb, token: string, now: Date = new Date()) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const [row] = await db
    .select({ report: reports, site: sites, client: clients, org: organizations, manager: users })
    .from(reports)
    .innerJoin(sites, eq(sites.id, reports.siteId))
    .innerJoin(clients, eq(clients.id, sites.clientId))
    .innerJoin(organizations, eq(organizations.id, clients.orgId))
    .leftJoin(users, eq(users.id, clients.managerId))
    .where(and(eq(reports.shareToken, token), gt(reports.shareExpiresAt, now)));
  return row ?? null;
}

/* Ownership -------------------------------------------------------------- */

async function ownedReport(db: AnyDb, orgId: string, reportId: string) {
  const [row] = await db
    .select({ report: reports, client: clients, site: sites })
    .from(reports)
    .innerJoin(sites, eq(sites.id, reports.siteId))
    .innerJoin(clients, eq(clients.id, sites.clientId))
    .where(and(eq(reports.id, reportId), eq(clients.orgId, orgId)));
  if (!row) throw new RepoError("Report not found", "not_found");
  return row;
}

function requireEdit(actor: Actor) {
  if (!canEdit(actor.role)) throw new RepoError("Viewers can read but not change anything.", "forbidden");
}

async function audit(db: AnyDb, actor: Actor, action: string, entity: string, entityId: string | null, meta: Record<string, unknown> = {}) {
  await db.insert(auditLog).values({ orgId: actor.orgId, userId: actor.userId, action, entity, entityId, meta });
}

/* Review ----------------------------------------------------------------- */

export async function transitionReport(db: AnyDb, actor: Actor, reportId: string, action: ReviewAction) {
  return db.transaction(async (tx) => {
    const { report } = await ownedReport(tx, actor.orgId, reportId);
    const next = nextStatus(action, report.status, actor.role);
    if (!next.ok) throw new RepoError(next.reason, actor.role === "viewer" ? "forbidden" : "invalid");
    const [updated] = await tx
      .update(reports)
      .set({
        status: next.to,
        updatedAt: sql`now()`,
        ...(next.to === "approved" && { approvedBy: actor.userId, approvedAt: new Date() }),
        ...(action === "withdraw" && { approvedBy: null, approvedAt: null }),
      })
      // Optimistic check: if someone else changed the status meanwhile, nothing is updated.
      .where(and(eq(reports.id, reportId), eq(reports.status, report.status)))
      .returning();
    if (!updated) throw new RepoError("Someone else changed this report a moment ago. Reload to see the latest.", "invalid");
    await audit(tx, actor, `report.${action}`, "report", reportId, { from: report.status, to: next.to });
    return updated;
  });
}

export async function saveNotes(db: AnyDb, actor: Actor, reportId: string, notes: string) {
  requireEdit(actor);
  return db.transaction(async (tx) => {
    const { report } = await ownedReport(tx, actor.orgId, reportId);
    if (!notesEditable(report.status)) throw new RepoError("Notes are locked once a report is approved. Withdraw the approval to edit them.", "invalid");
    if ((report.managerNotes ?? "") === notes) return report;
    const [updated] = await tx.update(reports).set({ managerNotes: notes || null, updatedAt: sql`now()` }).where(eq(reports.id, reportId)).returning();
    await audit(tx, actor, "report.notes_edited", "report", reportId, { length: notes.length });
    return updated!;
  });
}

/** Record a delivery made from the dashboard ("Send now"). */
export async function markSent(db: AnyDb, actor: Actor, reportId: string, sent: { deliveryId: string | null; pdfKey: string | null; captured: boolean }) {
  return db.transaction(async (tx) => {
    const { report } = await ownedReport(tx, actor.orgId, reportId);
    const next = nextStatus("send", report.status, actor.role);
    if (!next.ok) throw new RepoError(next.reason, "invalid");
    const version = report.version + 1;
    const [updated] = await tx.update(reports).set({
      status: "sent", sentAt: new Date(), version, deliveryId: sent.deliveryId,
      deliveryStatus: sent.captured ? null : "queued", deliveryUpdatedAt: new Date(),
      ...(sent.pdfKey && { pdfKey: sent.pdfKey }), updatedAt: sql`now()`,
    }).where(and(eq(reports.id, reportId), eq(reports.status, "approved"))).returning();
    if (!updated) throw new RepoError("This report was sent or changed a moment ago.", "invalid");
    if (sent.pdfKey) await tx.insert(reportVersions).values({ reportId, version, pdfKey: sent.pdfKey, reason: "sent", createdBy: actor.userId }).onConflictDoNothing();
    await audit(tx, actor, sent.captured ? "email.captured" : "report.sent", "report", reportId, { deliveryId: sent.deliveryId, version });
    return updated;
  });
}

/** A re-render after a note changed: bumps the version and keeps the old file. */
export async function recordRerender(db: AnyDb, actor: Actor, reportId: string, pdfKey: string) {
  requireEdit(actor);
  return db.transaction(async (tx) => {
    const { report } = await ownedReport(tx, actor.orgId, reportId);
    const version = report.version + 1;
    await tx.update(reports).set({ version, pdfKey, updatedAt: sql`now()` }).where(eq(reports.id, reportId));
    await tx.insert(reportVersions).values({ reportId, version, pdfKey, reason: "rerender", createdBy: actor.userId });
    await audit(tx, actor, "report.rerendered", "report", reportId, { version });
    return version;
  });
}

export async function revokeShareLink(db: AnyDb, actor: Actor, reportId: string) {
  requireEdit(actor);
  return db.transaction(async (tx) => {
    await ownedReport(tx, actor.orgId, reportId);
    await tx.update(reports).set({ shareToken: null, shareExpiresAt: null, updatedAt: sql`now()` }).where(eq(reports.id, reportId));
    await audit(tx, actor, "report.link_revoked", "report", reportId);
  });
}

export async function reissueShareLink(db: AnyDb, actor: Actor, reportId: string, now: Date = new Date()) {
  requireEdit(actor);
  return db.transaction(async (tx) => {
    await ownedReport(tx, actor.orgId, reportId);
    const token = newShareToken();
    await tx.update(reports).set({ shareToken: token, shareExpiresAt: new Date(now.getTime() + SHARE_DAYS * 86_400_000), updatedAt: sql`now()` })
      .where(eq(reports.id, reportId));
    await audit(tx, actor, "report.link_reissued", "report", reportId);
    return token;
  });
}

/* Clients ---------------------------------------------------------------- */

export async function setClientFlag(db: AnyDb, actor: Actor, clientId: string, flag: "autoSend" | "aiEnabled", on: boolean) {
  requireEdit(actor);
  return db.transaction(async (tx) => {
    const [row] = await tx.update(clients).set({ [flag]: on }).where(and(eq(clients.id, clientId), eq(clients.orgId, actor.orgId))).returning();
    if (!row) throw new RepoError("Client not found", "not_found");
    await audit(tx, actor, flag === "autoSend" ? "client.auto_send" : "client.ai", "client", clientId, { on });
    return row;
  });
}

export interface NewClient {
  name: string;
  logoKey: string | null;
  contacts: Array<{ name: string; email: string }>;
  timezone: string;
  reportDay: number;
  site: { url: string; gscProperty: string | null; keyPages: string[]; brandedRegex: string | null; uptimeKeyword: string | null };
}

/** Onboarding: client and first site together. backfilled_at stays null so the daily job pulls 16 months. */
export async function createClientWithSite(db: AnyDb, actor: Actor, input: NewClient) {
  requireEdit(actor);
  return db.transaction(async (tx) => {
    const [client] = await tx.insert(clients).values({
      orgId: actor.orgId, name: input.name, logoKey: input.logoKey, contacts: input.contacts, timezone: input.timezone,
      reportDay: input.reportDay, managerId: actor.userId,
    }).returning();
    const [site] = await tx.insert(sites).values({ clientId: client!.id, ...input.site }).returning();
    await audit(tx, actor, "client.created", "client", client!.id, { siteId: site!.id });
    return { client: client!, site: site! };
  });
}

/* Alerts ----------------------------------------------------------------- */

export async function setAlertState(db: AnyDb, actor: Actor, alertId: string, state: "acknowledged" | "resolved") {
  requireEdit(actor);
  return db.transaction(async (tx) => {
    const [owned] = await tx.select({ id: alerts.id }).from(alerts)
      .innerJoin(sites, eq(sites.id, alerts.siteId)).innerJoin(clients, eq(clients.id, sites.clientId))
      .where(and(eq(alerts.id, alertId), eq(clients.orgId, actor.orgId)));
    if (!owned) throw new RepoError("Alert not found", "not_found");
    await tx.update(alerts).set({ state, ...(state === "resolved" && { resolvedAt: new Date() }) }).where(eq(alerts.id, alertId));
    await audit(tx, actor, `alert.${state}`, "alert", alertId);
  });
}

/* Branding --------------------------------------------------------------- */

export interface BrandPatch {
  name: string;
  brandPrimary: string;
  brandAccent: string;
  senderName: string;
  senderEmail: string;
  footer: string;
  brandLogoKey?: string | null;
}

export async function updateBrand(db: AnyDb, actor: Actor, patch: BrandPatch) {
  if (!canManageAgency(actor.role)) throw new RepoError("Only the agency owner can change branding.", "forbidden");
  return db.transaction(async (tx) => {
    const [org] = await tx.update(organizations).set(patch).where(eq(organizations.id, actor.orgId)).returning();
    await audit(tx, actor, "org.brand_updated", "organization", actor.orgId, { fields: Object.keys(patch) });
    return org!;
  });
}

/* Delivery webhooks ------------------------------------------------------ */

/**
 * Resend told us what happened to an email. A bounce marks the contact so
 * the next run skips it, and raises an alert so the manager fixes the
 * address. Unknown ids are ignored (the email may predate this database).
 */
export async function applyDeliveryEvent(db: AnyDb, event: { type: "delivered" | "bounced" | "complained" | "delayed"; emailId: string; to: string[]; at: string }) {
  if (event.type === "delayed") return { matched: false };
  const type = event.type;
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ report: reports, client: clients, site: sites }).from(reports)
      .innerJoin(sites, eq(sites.id, reports.siteId)).innerJoin(clients, eq(clients.id, sites.clientId))
      .where(eq(reports.deliveryId, event.emailId));
    if (!row) return { matched: false };
    // Never downgrade a bounce to "delivered" if events arrive out of order.
    if (!(event.type === "delivered" && row.report.deliveryStatus === "bounced")) {
      await tx.update(reports).set({ deliveryStatus: type, deliveryUpdatedAt: new Date(event.at) }).where(eq(reports.id, row.report.id));
    }
    if (event.type === "bounced" || event.type === "complained") {
      const bad = new Set(event.to.map((e) => e.toLowerCase()));
      const contacts = row.client.contacts.map((c) => (bad.has(c.email.toLowerCase()) ? { ...c, bouncedAt: event.at } : c));
      await tx.update(clients).set({ contacts }).where(eq(clients.id, row.client.id));
      await tx.insert(alerts).values({
        siteId: row.site.id, kind: "bounce", severity: "warning",
        title: event.type === "bounced" ? `Report email to ${event.to.join(", ")} bounced` : `${event.to.join(", ")} marked the report as spam`,
        detail: event.type === "bounced"
          ? "The address will be skipped next month until it is corrected on the client page."
          : "They will not be emailed again until a manager re-enables the contact.",
        dedupeKey: `bounce:${event.emailId}`,
      }).onConflictDoNothing({ target: [alerts.siteId, alerts.dedupeKey] });
    }
    await tx.insert(auditLog).values({ orgId: row.client.orgId, userId: null, action: `email.${event.type}`, entity: "report", entityId: row.report.id, meta: { emailId: event.emailId } });
    return { matched: true };
  });
}

/* Sign-in ---------------------------------------------------------------- */

const LINK_MINUTES = 15;

/** A one-time link token for a known member. Returns null for unknown emails (the caller says "check your inbox" either way). */
export async function createLoginToken(db: AnyDb, email: string, now: Date = new Date()) {
  const normalised = email.trim().toLowerCase();
  const [member] = await db.select({ id: users.id }).from(users).innerJoin(memberships, eq(memberships.userId, users.id))
    .where(eq(sql`lower(${users.email})`, normalised)).limit(1);
  if (!member) return null;
  const token = randomBytes(32).toString("base64url");
  await db.insert(loginTokens).values({ tokenHash: hash(token), email: normalised, expiresAt: new Date(now.getTime() + LINK_MINUTES * 60_000) });
  return token;
}

/** Spend a link token. Works once, within 15 minutes. Returns the user and their first membership. */
export async function consumeLoginToken(db: AnyDb, token: string, now: Date = new Date()) {
  return db.transaction(async (tx) => {
    const [used] = await tx.update(loginTokens).set({ usedAt: now })
      .where(and(eq(loginTokens.tokenHash, hash(token)), isNull(loginTokens.usedAt), gt(loginTokens.expiresAt, now)))
      .returning();
    if (!used) return null;
    const [row] = await tx.select({ user: users, membership: memberships }).from(users)
      .innerJoin(memberships, eq(memberships.userId, users.id))
      .where(eq(sql`lower(${users.email})`, used.email)).limit(1);
    if (!row) return null;
    await tx.insert(auditLog).values({ orgId: row.membership.orgId, userId: row.user.id, action: "user.signed_in", entity: "user", entityId: row.user.id });
    return { user: row.user, orgId: row.membership.orgId, role: row.membership.role };
  });
}
