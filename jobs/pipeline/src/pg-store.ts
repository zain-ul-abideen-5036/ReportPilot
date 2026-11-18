import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { addMonths, periodRange, type CollectedData, type CruxWeek, type LabScore } from "@reportpilot/core";
import { tables, type Database } from "@reportpilot/db";
import type { PipelineSite, PipelineStore, StoredReport } from "./store";

const {
  auditLog, clients, cruxWeekly, incidents, indexStatus, jobRuns, organizations, psiRuns, reports, sites, tlsDomain, uptimeDaily, users,
} = tables;

/** PipelineStore over Postgres. Every query is scoped by the site it is working on. */
export function pgStore(db: Database): PipelineStore {
  const toStored = (r: typeof reports.$inferSelect): StoredReport => ({
    id: r.id,
    siteId: r.siteId,
    period: r.period,
    status: r.status,
    stage: (r.collected ? (r.pdfKey ? (r.sentAt ? "deliver" : "render") : r.narrative ? "narrative" : r.data ? "insights" : "collect") : null),
    collected: (r.collected as CollectedData | null) ?? null,
    data: r.data ?? null,
    narrative: r.narrative ?? null,
    managerNotes: r.managerNotes,
    pdfKey: r.pdfKey,
    shareToken: r.shareToken,
    sentAt: r.sentAt?.toISOString() ?? null,
  });

  return {
    async sites(filter) {
      const rows = await db
        .select({ site: sites, client: clients, org: organizations, manager: users })
        .from(sites)
        .innerJoin(clients, eq(clients.id, sites.clientId))
        .innerJoin(organizations, eq(organizations.id, clients.orgId))
        .leftJoin(users, eq(users.id, clients.managerId))
        .where(and(eq(sites.active, true), eq(clients.status, "active"), filter?.siteId ? eq(sites.id, filter.siteId) : undefined));
      return rows.map(({ site, client, org, manager }): PipelineSite => ({
        id: site.id, orgId: org.id, clientName: client.name, url: site.url, gscProperty: site.gscProperty,
        brandedRegex: site.brandedRegex, keyPages: site.keyPages, timezone: client.timezone, reportDay: client.reportDay,
        autoSend: client.autoSend, aiEnabled: client.aiEnabled,
        contacts: client.contacts.filter((c) => !c.bouncedAt).map(({ name, email }) => ({ name, email })),
        managerName: manager?.name ?? org.senderName,
        brand: { name: org.name, primary: org.brandPrimary, accent: org.brandAccent, footer: org.footer, senderName: org.senderName, senderEmail: org.senderEmail },
      }));
    },

    async ensureReport(siteId, period) {
      // ON CONFLICT on the (site_id, period) unique index makes this idempotent.
      await db.insert(reports).values({ siteId, period }).onConflictDoNothing({ target: [reports.siteId, reports.period] });
      const [row] = await db.select().from(reports).where(and(eq(reports.siteId, siteId), eq(reports.period, period)));
      return toStored(row!);
    },

    async updateReport(id, patch) {
      const [row] = await db
        .update(reports)
        .set({
          ...(patch.status && { status: patch.status }),
          ...(patch.collected !== undefined && { collected: patch.collected }),
          ...(patch.data !== undefined && { data: patch.data }),
          ...(patch.narrative !== undefined && { narrative: patch.narrative }),
          ...(patch.pdfKey !== undefined && { pdfKey: patch.pdfKey }),
          ...(patch.shareToken !== undefined && {
            shareToken: patch.shareToken,
            shareExpiresAt: patch.shareToken ? new Date(Date.now() + 90 * 86_400_000) : null,
          }),
          ...(patch.sentAt !== undefined && { sentAt: patch.sentAt ? new Date(patch.sentAt) : null }),
          updatedAt: sql`now()`,
        })
        .where(eq(reports.id, id))
        .returning();
      return toStored(row!);
    },

    async recordRun(run) {
      await db.insert(jobRuns).values({
        kind: "monthly", siteId: run.siteId, period: run.period, stage: run.stage, status: run.status,
        attempts: run.attempts, error: run.error ?? null,
        finishedAt: run.status === "running" ? null : new Date(),
      });
    },

    async audit(entry) {
      await db.insert(auditLog).values({ orgId: entry.orgId, userId: null, action: entry.action, entity: "report", entityId: entry.entityId, meta: entry.meta ?? {} });
    },
  };
}

/** Uptime for a month from the worker's daily rollups and incident log. */
export async function uptimeFromDb(db: Database, siteId: string, period: string): Promise<CollectedData["uptime"]> {
  const { startDate } = periodRange(period);
  const next = `${addMonths(period, 1)}-01`;
  const days = await db.select().from(uptimeDaily)
    .where(and(eq(uptimeDaily.siteId, siteId), gte(uptimeDaily.day, startDate), lt(uptimeDaily.day, next)))
    .orderBy(asc(uptimeDaily.day));
  if (days.length === 0) return null;
  const inc = await db.select().from(incidents)
    .where(and(eq(incidents.siteId, siteId), gte(incidents.startedAt, new Date(startDate)), lt(incidents.startedAt, new Date(next))))
    .orderBy(asc(incidents.startedAt));
  const [tls] = await db.select().from(tlsDomain).where(eq(tlsDomain.siteId, siteId));
  return {
    days: days.map((d) => ({ day: d.day, uptimePct: d.uptimePct, avgMs: d.avgMs, p95Ms: d.p95Ms })),
    incidents: inc.map((i) => ({ id: i.id, startedAt: i.startedAt.toISOString(), resolvedAt: i.resolvedAt?.toISOString() ?? null, cause: i.cause })),
    certExpiresAt: tls?.certExpiresAt?.toISOString() ?? null,
    domainExpiresAt: tls?.domainExpiresAt?.toISOString() ?? null,
  };
}

/** Speed from the weekly snapshot tables: latest lab medians and CrUX history. */
export async function speedFromDb(db: Database, siteId: string): Promise<CollectedData["speed"]> {
  const [latest] = await db.select({ d: psiRuns.runDate }).from(psiRuns).where(eq(psiRuns.siteId, siteId)).orderBy(desc(psiRuns.runDate)).limit(1);
  const history = await db.select().from(cruxWeekly)
    .where(and(eq(cruxWeekly.siteId, siteId), eq(cruxWeekly.formFactor, "PHONE")))
    .orderBy(asc(cruxWeekly.week)).limit(25);
  if (!latest && history.length === 0) return null;
  const runs = latest ? await db.select().from(psiRuns).where(and(eq(psiRuns.siteId, siteId), eq(psiRuns.runDate, latest.d))) : [];
  const weeks: CruxWeek[] = history.map((h) => ({ week: h.week, lcp: h.lcpP75, inp: h.inpP75, cls: h.clsP75 }));
  const last = weeks.at(-1);
  const prev = weeks.at(-5);
  return {
    field: { formFactor: "mobile", lcp: last?.lcp ?? null, inp: last?.inp ?? null, cls: last?.cls ?? null },
    fieldPrevious: prev ? { lcp: prev.lcp, inp: prev.inp, cls: prev.cls } : null,
    lab: runs.map((r): LabScore => ({ url: r.url, strategy: r.strategy, score: r.perfScore, lcp: r.lcp ?? 0, cls: r.cls ?? 0, tbt: r.tbt ?? 0 })),
    history: weeks,
    opportunities: runs.flatMap((r) => r.opportunities),
  };
}

/** Latest URL Inspection result per key page. */
export async function indexingFromDb(db: Database, siteId: string): Promise<CollectedData["indexing"]> {
  const rows = await db.selectDistinctOn([indexStatus.url]).from(indexStatus)
    .where(eq(indexStatus.siteId, siteId)).orderBy(indexStatus.url, desc(indexStatus.checkedAt));
  if (rows.length === 0) return null;
  return {
    pages: rows.map((r) => ({ url: r.url, verdict: r.verdict, coverageState: r.coverageState, lastCrawl: r.lastCrawl?.toISOString() ?? null })),
    sitemaps: [],
  };
}
