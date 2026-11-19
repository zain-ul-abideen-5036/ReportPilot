/**
 * Seed a database with the demo agency, so a fresh deployment shows the
 * same dashboard as demo mode. Safe to re-run: if the sample agency is
 * already there it stops without changing anything.
 *
 *   DATABASE_URL=postgres://… npm run seed -w @reportpilot/db
 */
import { randomBytes } from "node:crypto";
import { buildReport, templateNarrative } from "@reportpilot/core";
import { eq } from "drizzle-orm";
import { ALERTS, CLIENTS, DEMO_NOW, DEMO_PERIOD, ORG, SITES, USERS, collectDemo } from "@reportpilot/demo";
import { createDb } from "./index";
import { alerts, clients, memberships, organizations, reports, sites, users } from "./schema";

async function main() {
  const db = createDb();
  const [existing] = await db.select().from(organizations).where(eq(organizations.name, ORG.name));
  if (existing) {
    console.log(`${ORG.name} is already seeded. Sign in as ${USERS[1]!.email} (manager) or ${USERS[0]!.email} (owner).`);
    process.exit(0);
  }
  const [org] = await db
    .insert(organizations)
    .values({ name: ORG.name, brandPrimary: ORG.primary, brandAccent: ORG.accent, senderName: ORG.senderName, senderEmail: ORG.senderEmail, footer: ORG.footer })
    .returning();
  if (!org) throw new Error("Could not create organisation");

  const userIds = new Map<string, string>();
  for (const u of USERS) {
    const [row] = await db
      .insert(users)
      .values({ email: u.email, name: u.name })
      .onConflictDoUpdate({ target: users.email, set: { name: u.name } })
      .returning();
    userIds.set(u.id, row!.id);
    await db.insert(memberships).values({ userId: row!.id, orgId: org.id, role: u.role }).onConflictDoNothing();
  }

  for (const c of CLIENTS) {
    const [client] = await db
      .insert(clients)
      .values({
        orgId: org.id, name: c.name, contacts: [c.contact], timezone: c.timezone, reportDay: c.reportDay,
        managerId: userIds.get(c.manager) ?? null, autoSend: c.autoSend, aiEnabled: c.aiEnabled,
      })
      .returning();
    for (const s of SITES.filter((x) => x.clientId === c.id)) {
      const [site] = await db
        .insert(sites)
        .values({ clientId: client!.id, url: s.url, gscProperty: s.gscProperty, brandedRegex: s.brandedRegex, keyPages: s.keyPages, uptimeKeyword: s.uptimeKeyword })
        .returning();
      const data = buildReport(collectDemo(s.id), DEMO_NOW);
      await db
        .insert(reports)
        .values({
          siteId: site!.id, period: DEMO_PERIOD, status: c.reportStatus, data, narrative: templateNarrative(data),
          shareToken: randomBytes(16).toString("hex"), shareExpiresAt: new Date(DEMO_NOW.getTime() + 90 * 86_400_000),
        })
        .onConflictDoNothing();
      for (const a of ALERTS.filter((x) => x.siteId === s.id)) {
        await db.insert(alerts).values({
          siteId: site!.id, kind: a.kind, severity: a.severity, state: a.state, title: a.title, detail: a.detail,
          dedupeKey: `seed:${a.id}`, raisedAt: new Date(a.raisedAt), resolvedAt: a.resolvedAt ? new Date(a.resolvedAt) : null,
        }).onConflictDoNothing();
      }
    }
  }
  console.log(`Seeded ${CLIENTS.length} clients and ${SITES.length} sites for ${ORG.name}. Sign in as ${USERS[1]!.email} (manager) or ${USERS[0]!.email} (owner).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
