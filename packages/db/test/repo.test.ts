import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq, sql } from "drizzle-orm";
import * as schema from "../src/schema";
import {
  applyDeliveryEvent, consumeLoginToken, createClientWithSite, createLoginToken, listAuditRecords, listSiteRecords, markSent,
  reissueShareLink, reportByShareToken, revokeShareLink, saveNotes, setAlertState, transitionReport, updateBrand, RepoError,
  type Actor, type AnyDb,
} from "../src/repo";

/*
 * The dashboard's database layer against a real Postgres (PGlite, in
 * process) with the real migrations applied, so the SQL is exercised
 * exactly as it runs in production.
 */

let db: AnyDb;
let org: { id: string };
let other: { id: string };
let manager: Actor;
let viewer: Actor;
let owner: Actor;
let reportId: string;
let siteId: string;

beforeAll(async () => {
  const client = new PGlite();
  const d = drizzle(client, { schema, casing: "snake_case" });
  await migrate(d, { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
  db = d as unknown as AnyDb;
}, 60_000);

beforeEach(async () => {
  await db.execute(sql`truncate organizations, users, login_tokens restart identity cascade`);
  [org] = await db.insert(schema.organizations).values({ name: "Northfold", senderName: "Northfold", senderEmail: "r@northfold.test" }).returning() as [{ id: string }];
  [other] = await db.insert(schema.organizations).values({ name: "Rival", senderName: "Rival", senderEmail: "r@rival.test" }).returning() as [{ id: string }];
  const [u1, u2, u3] = await db.insert(schema.users).values([
    { email: "maya@northfold.test", name: "Maya" }, { email: "vic@northfold.test", name: "Vic" }, { email: "owen@northfold.test", name: "Owen" },
  ]).returning();
  await db.insert(schema.memberships).values([
    { userId: u1!.id, orgId: org.id, role: "manager" }, { userId: u2!.id, orgId: org.id, role: "viewer" }, { userId: u3!.id, orgId: org.id, role: "owner" },
  ]);
  manager = { orgId: org.id, userId: u1!.id, role: "manager" };
  viewer = { orgId: org.id, userId: u2!.id, role: "viewer" };
  owner = { orgId: org.id, userId: u3!.id, role: "owner" };
  const { site } = await createClientWithSite(db, manager, {
    name: "Harlow Dental", logoKey: null, contacts: [{ name: "Ruth", email: "ruth@harlow.test" }], timezone: "Europe/London", reportDay: 3,
    site: { url: "https://harlow.test", gscProperty: "sc-domain:harlow.test", keyPages: ["/"], brandedRegex: "harlow", uptimeKeyword: "Harlow" },
  });
  siteId = site.id;
  const [rep] = await db.insert(schema.reports).values({
    siteId, period: "2026-10", status: "draft", shareToken: "a".repeat(32), shareExpiresAt: new Date("2027-01-01T00:00:00Z"),
  }).returning();
  reportId = rep!.id;
});

describe("review flow in the database", () => {
  it("moves draft → in review → approved → sent and audits every step", async () => {
    await transitionReport(db, manager, reportId, "submit");
    const approved = await transitionReport(db, manager, reportId, "approve");
    expect(approved.status).toBe("approved");
    expect(approved.approvedBy).toBe(manager.userId);
    const sent = await markSent(db, manager, reportId, { deliveryId: "re_9", pdfKey: "reports/x/v2.pdf", captured: false });
    expect(sent).toMatchObject({ status: "sent", version: 2, deliveryId: "re_9", deliveryStatus: "queued" });
    const actions = (await listAuditRecords(db, org.id)).map((a) => a.entry.action);
    expect(actions).toEqual(expect.arrayContaining(["report.submit", "report.approve", "report.sent", "client.created"]));
  });

  it("records a captured email once, with who it was for", async () => {
    await transitionReport(db, manager, reportId, "approve");
    await markSent(db, manager, reportId, { deliveryId: null, pdfKey: null, captured: true, to: "ruth@harlow.test", subject: "Your October report" });
    const captured = (await listAuditRecords(db, org.id)).filter((a) => a.entry.action === "email.captured");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.entry.meta).toMatchObject({ to: "ruth@harlow.test", subject: "Your October report" });
  });

  it("refuses illegal transitions and viewers", async () => {
    await expect(transitionReport(db, manager, reportId, "send")).rejects.toThrow(/cannot be sent/);
    await expect(transitionReport(db, viewer, reportId, "approve")).rejects.toMatchObject({ code: "forbidden" });
  });

  it("hides another agency's reports behind not found", async () => {
    const intruder: Actor = { orgId: other.id, userId: null, role: "owner" };
    await expect(transitionReport(db, intruder, reportId, "approve")).rejects.toBeInstanceOf(RepoError);
    expect(await listSiteRecords(db, other.id)).toEqual([]);
  });

  it("locks notes after approval", async () => {
    await saveNotes(db, manager, reportId, "We rewrote the implants page.");
    await transitionReport(db, manager, reportId, "approve");
    await expect(saveNotes(db, manager, reportId, "changed")).rejects.toThrow(/locked/);
  });

  it("lists each site with its latest report", async () => {
    await db.insert(schema.reports).values({ siteId, period: "2026-09", status: "sent" });
    const rows = await listSiteRecords(db, org.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.report!.period).toBe("2026-10");
  });
});

describe("share links", () => {
  it("serves a valid token, and nothing once revoked or expired", async () => {
    expect(await reportByShareToken(db, "a".repeat(32), new Date("2026-11-19T00:00:00Z"))).not.toBeNull();
    expect(await reportByShareToken(db, "a".repeat(32), new Date("2027-02-01T00:00:00Z"))).toBeNull();
    await revokeShareLink(db, manager, reportId);
    expect(await reportByShareToken(db, "a".repeat(32), new Date("2026-11-19T00:00:00Z"))).toBeNull();
  });

  it("issues a fresh 128-bit token that lasts 90 days", async () => {
    const now = new Date("2026-11-19T00:00:00Z");
    const token = await reissueShareLink(db, manager, reportId, now);
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(await reportByShareToken(db, token, new Date("2027-02-16T00:00:00Z"))).not.toBeNull();
    expect(await reportByShareToken(db, token, new Date("2027-02-18T00:00:00Z"))).toBeNull();
  });

  it("rejects malformed tokens without querying", async () => {
    expect(await reportByShareToken(db, "../../etc")).toBeNull();
  });
});

describe("bounces", () => {
  it("marks the contact, keeps the bounce status and raises one alert", async () => {
    await db.update(schema.reports).set({ status: "sent", deliveryId: "re_7", deliveryStatus: "queued" }).where(eq(schema.reports.id, reportId));
    const event = { type: "bounced" as const, emailId: "re_7", to: ["Ruth@harlow.test"], at: "2026-11-04T09:00:00Z" };
    expect(await applyDeliveryEvent(db, event)).toEqual({ matched: true });
    await applyDeliveryEvent(db, event);
    await applyDeliveryEvent(db, { ...event, type: "delivered" });
    const [rep] = await db.select().from(schema.reports).where(eq(schema.reports.id, reportId));
    expect(rep!.deliveryStatus).toBe("bounced");
    const [client] = await db.select().from(schema.clients);
    expect(client!.contacts[0]!.bouncedAt).toBe("2026-11-04T09:00:00Z");
    expect(await db.select().from(schema.alerts)).toHaveLength(1);
  });

  it("ignores emails it does not know", async () => {
    expect(await applyDeliveryEvent(db, { type: "bounced", emailId: "re_nope", to: [], at: "2026-11-04T09:00:00Z" })).toEqual({ matched: false });
  });
});

describe("alerts, branding and onboarding", () => {
  it("acknowledges alerts, but only inside the organisation", async () => {
    const [a] = await db.insert(schema.alerts).values({ siteId, kind: "ssl", severity: "warning", title: "SSL", dedupeKey: "ssl:x" }).returning();
    await setAlertState(db, manager, a!.id, "acknowledged");
    await expect(setAlertState(db, { ...manager, orgId: other.id }, a!.id, "resolved")).rejects.toMatchObject({ code: "not_found" });
    const [row] = await db.select().from(schema.alerts);
    expect(row!.state).toBe("acknowledged");
  });

  it("lets only the owner change branding", async () => {
    const patch = { name: "Northfold Studio", brandPrimary: "#0b5cc4", brandAccent: "#e8a33d", senderName: "Northfold", senderEmail: "r@northfold.test", footer: "Hebden Bridge" };
    await expect(updateBrand(db, manager, patch)).rejects.toMatchObject({ code: "forbidden" });
    expect((await updateBrand(db, owner, patch)).brandPrimary).toBe("#0b5cc4");
  });

  it("creates new sites owed a 16-month backfill", async () => {
    const [site] = await db.select().from(schema.sites).where(eq(schema.sites.id, siteId));
    expect(site!.backfilledAt).toBeNull();
  });
});

describe("email sign-in links", () => {
  it("work once, within 15 minutes, for members only", async () => {
    const now = new Date("2026-11-19T09:00:00Z");
    expect(await createLoginToken(db, "stranger@example.test", now)).toBeNull();
    const token = (await createLoginToken(db, " Maya@Northfold.test ", now))!;
    expect(await consumeLoginToken(db, token, new Date("2026-11-19T09:20:00Z"))).toBeNull();
    const fresh = (await createLoginToken(db, "maya@northfold.test", now))!;
    const session = await consumeLoginToken(db, fresh, new Date("2026-11-19T09:05:00Z"));
    expect(session).toMatchObject({ orgId: org.id, role: "manager" });
    expect(await consumeLoginToken(db, fresh, new Date("2026-11-19T09:06:00Z"))).toBeNull();
  });

  it("stores only a hash of the token", async () => {
    const token = (await createLoginToken(db, "maya@northfold.test"))!;
    const [row] = await db.select().from(schema.loginTokens);
    expect(row!.tokenHash).not.toContain(token);
    expect(row!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
