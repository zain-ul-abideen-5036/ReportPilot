import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  addMonths, ctrOf, periodRange, type CollectedData, type CruxWeek, type LabScore, type MonthSearch,
} from "@reportpilot/core";
import { tables, type Database } from "@reportpilot/db";
import type { SearchArchive } from "./stages/collect";
import type { PipelineSite, PipelineStore, StoredReport } from "./store";

const {
  auditLog, clients, cruxWeekly, gscDaily, gscMonthlyDim, gscMonthlyPage, gscMonthlyQuery, incidents, indexStatus, jobRuns,
  organizations, psiRuns, reportVersions, reports, sitemapStatus, sites, tlsDomain, uptimeDaily, users,
} = tables;

/** Resolves a stored logo (an R2 key or a small data: URL) to something the PDF can embed. */
export type LogoResolver = (key: string | null) => Promise<string | null>;

/** PipelineStore over Postgres. Every query is scoped by the site it is working on. */
export function pgStore(db: Database, opts: { kind?: "monthly" | "backfill"; logo?: LogoResolver } = {}): PipelineStore {
  const kind = opts.kind ?? "monthly";
  const logo: LogoResolver = opts.logo ?? (async (k) => (k?.startsWith("data:") ? k : null));

  const toStored = (r: typeof reports.$inferSelect): StoredReport => ({
    id: r.id,
    siteId: r.siteId,
    period: r.period,
    status: r.status,
    stage: r.collected ? (r.pdfKey ? (r.sentAt ? "deliver" : "render") : r.narrative ? "narrative" : r.data ? "insights" : "collect") : null,
    collected: (r.collected as CollectedData | null) ?? null,
    data: r.data ?? null,
    narrative: r.narrative ?? null,
    managerNotes: r.managerNotes,
    pdfKey: r.pdfKey,
    shareToken: r.shareToken,
    sentAt: r.sentAt?.toISOString() ?? null,
    version: r.version,
    deliveryId: r.deliveryId,
    deliveryStatus: r.deliveryStatus ?? null,
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
      return Promise.all(rows.map(async ({ site, client, org, manager }): Promise<PipelineSite> => ({
        id: site.id, orgId: org.id, clientName: client.name, url: site.url, gscProperty: site.gscProperty,
        brandedRegex: site.brandedRegex, keyPages: site.keyPages, timezone: client.timezone, reportDay: client.reportDay,
        autoSend: client.autoSend, aiEnabled: client.aiEnabled,
        // Contacts whose address bounced are skipped until someone fixes them in the dashboard.
        contacts: client.contacts.filter((c) => !c.bouncedAt).map(({ name, email }) => ({ name, email })),
        managerName: manager?.name ?? org.senderName,
        clientLogoUrl: await logo(client.logoKey),
        brand: {
          name: org.name, primary: org.brandPrimary, accent: org.brandAccent, footer: org.footer,
          senderName: org.senderName, senderEmail: org.senderEmail, logoUrl: await logo(org.brandLogoKey),
        },
      })));
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
          ...(patch.version !== undefined && { version: patch.version }),
          ...(patch.shareToken !== undefined && {
            shareToken: patch.shareToken,
            shareExpiresAt: patch.shareToken ? new Date(Date.now() + 90 * 86_400_000) : null,
          }),
          ...(patch.sentAt !== undefined && { sentAt: patch.sentAt ? new Date(patch.sentAt) : null }),
          ...(patch.deliveryId !== undefined && { deliveryId: patch.deliveryId }),
          ...(patch.deliveryStatus !== undefined && { deliveryStatus: patch.deliveryStatus, deliveryUpdatedAt: new Date() }),
          updatedAt: sql`now()`,
        })
        .where(eq(reports.id, id))
        .returning();
      return toStored(row!);
    },

    async recordRun(run) {
      await db.insert(jobRuns).values({
        kind, siteId: run.siteId, period: run.period, stage: run.stage, status: run.status,
        attempts: run.attempts, error: run.error ?? null,
        finishedAt: run.status === "running" ? null : new Date(),
      });
    },

    async audit(entry) {
      await db.insert(auditLog).values({ orgId: entry.orgId, userId: null, action: entry.action, entity: "report", entityId: entry.entityId, meta: entry.meta ?? {} });
    },

    async recordVersion(entry) {
      await db.insert(reportVersions).values(entry).onConflictDoNothing();
    },
  };
}

/**
 * The Search Console archive: monthly aggregates (top 1,000 queries, top
 * 500 pages, device and country splits) plus daily site totals. Storing
 * aggregates instead of raw rows is what keeps 50 sites inside a free
 * Postgres tier.
 */
export function pgArchive(db: Database): SearchArchive {
  return {
    async load(siteId, period) {
      const { startDate } = periodRange(period);
      const next = `${addMonths(period, 1)}-01`;
      const [days, queries, pages, dims] = await Promise.all([
        db.select().from(gscDaily).where(and(eq(gscDaily.siteId, siteId), gte(gscDaily.day, startDate), lt(gscDaily.day, next))).orderBy(asc(gscDaily.day)),
        db.select().from(gscMonthlyQuery).where(and(eq(gscMonthlyQuery.siteId, siteId), eq(gscMonthlyQuery.month, period))),
        db.select().from(gscMonthlyPage).where(and(eq(gscMonthlyPage.siteId, siteId), eq(gscMonthlyPage.month, period))),
        db.select().from(gscMonthlyDim).where(and(eq(gscMonthlyDim.siteId, siteId), eq(gscMonthlyDim.month, period))),
      ]);
      // A month is only usable if both its days and its tables are there.
      if (days.length === 0 || queries.length === 0) return null;
      const clicks = days.reduce((s, d) => s + d.clicks, 0);
      const impressions = days.reduce((s, d) => s + d.impressions, 0);
      const position = impressions ? days.reduce((s, d) => s + d.position * d.impressions, 0) / impressions : 0;
      const strip = <T extends { siteId: string }>({ siteId: _s, ...rest }: T) => rest;
      return {
        period,
        final: true,
        totals: { clicks, impressions, ctr: ctrOf(clicks, impressions), position: +position.toFixed(2) },
        daily: days.map(({ day, clicks, impressions, ctr, position }) => ({ day, clicks, impressions, ctr, position })),
        queries: queries.map((q) => { const { month: _m, ...r } = strip(q); return r; }),
        pages: pages.map((p) => { const { month: _m, ...r } = strip(p); return r; }),
        devices: dims.filter((d) => d.dimension === "device").map(({ key, clicks, impressions }) => ({ key, clicks, impressions })),
        countries: dims.filter((d) => d.dimension === "country").map(({ key, clicks, impressions }) => ({ key, clicks, impressions })),
      };
    },

    async save(siteId, m) {
      if (!m.final) return; // only final months are archived
      await saveMonth(db, siteId, m);
    },
  };
}

export async function saveMonth(db: Database, siteId: string, m: MonthSearch) {
  await db.transaction(async (tx) => {
    // Replace the month wholesale so a re-fetch never leaves stale rows behind.
    await tx.delete(gscMonthlyQuery).where(and(eq(gscMonthlyQuery.siteId, siteId), eq(gscMonthlyQuery.month, m.period)));
    await tx.delete(gscMonthlyPage).where(and(eq(gscMonthlyPage.siteId, siteId), eq(gscMonthlyPage.month, m.period)));
    await tx.delete(gscMonthlyDim).where(and(eq(gscMonthlyDim.siteId, siteId), eq(gscMonthlyDim.month, m.period)));
    for (const batch of chunks(m.queries.slice(0, 1000), 500)) {
      await tx.insert(gscMonthlyQuery).values(batch.map((q) => ({ siteId, month: m.period, ...q }))).onConflictDoNothing();
    }
    for (const batch of chunks(m.pages.slice(0, 500), 500)) {
      await tx.insert(gscMonthlyPage).values(batch.map((p) => ({ siteId, month: m.period, ...p }))).onConflictDoNothing();
    }
    const dims = [
      ...m.devices.map((d) => ({ siteId, month: m.period, dimension: "device" as const, ...d })),
      ...m.countries.map((d) => ({ siteId, month: m.period, dimension: "country" as const, ...d })),
    ];
    if (dims.length) await tx.insert(gscMonthlyDim).values(dims).onConflictDoNothing();
    await upsertDaily(tx as unknown as Database, siteId, m.daily);
  });
}

export async function upsertDaily(db: Database, siteId: string, days: MonthSearch["daily"]) {
  for (const batch of chunks(days, 500)) {
    if (batch.length === 0) continue;
    await db.insert(gscDaily).values(batch.map((d) => ({ siteId, ...d }))).onConflictDoUpdate({
      target: [gscDaily.siteId, gscDaily.day],
      set: { clicks: sql`excluded.clicks`, impressions: sql`excluded.impressions`, ctr: sql`excluded.ctr`, position: sql`excluded.position` },
    });
  }
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
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
  const recent = await db.select().from(cruxWeekly)
    .where(and(eq(cruxWeekly.siteId, siteId), eq(cruxWeekly.formFactor, "PHONE")))
    .orderBy(desc(cruxWeekly.week)).limit(25);
  const history = recent.reverse();
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

/** Latest URL Inspection result per key page, and the sitemaps from sitemaps.list. */
export async function indexingFromDb(db: Database, siteId: string): Promise<CollectedData["indexing"]> {
  const [rows, maps] = await Promise.all([
    db.selectDistinctOn([indexStatus.url]).from(indexStatus)
      .where(eq(indexStatus.siteId, siteId)).orderBy(indexStatus.url, desc(indexStatus.checkedAt)),
    db.select().from(sitemapStatus).where(eq(sitemapStatus.siteId, siteId)).orderBy(asc(sitemapStatus.path)),
  ]);
  if (rows.length === 0 && maps.length === 0) return null;
  return {
    pages: rows.map((r) => ({ url: r.url, verdict: r.verdict, coverageState: r.coverageState, lastCrawl: r.lastCrawl?.toISOString() ?? null })),
    sitemaps: maps.map((m) => ({ path: m.path, errors: m.errors, warnings: m.warnings, submitted: m.submitted, lastDownloaded: m.lastDownloaded?.toISOString() ?? null })),
  };
}

/** Everything the daily alert rules look at for one site. */
export async function alertSnapshotFromDb(db: Database, siteId: string, today: string) {
  const since = new Date(Date.parse(`${today}T00:00:00Z`) - 40 * 86_400_000).toISOString().slice(0, 10);
  const [tls, days, crux, index] = await Promise.all([
    db.select().from(tlsDomain).where(eq(tlsDomain.siteId, siteId)).then((r) => r[0]),
    db.select({ day: gscDaily.day, clicks: gscDaily.clicks }).from(gscDaily)
      .where(and(eq(gscDaily.siteId, siteId), gte(gscDaily.day, since))).orderBy(asc(gscDaily.day)),
    db.select().from(cruxWeekly).where(and(eq(cruxWeekly.siteId, siteId), eq(cruxWeekly.formFactor, "PHONE")))
      .orderBy(desc(cruxWeekly.week)).limit(8),
    indexingFromDb(db, siteId),
  ]);
  return {
    certExpiresAt: tls?.certExpiresAt?.toISOString() ?? null,
    domainExpiresAt: tls?.domainExpiresAt?.toISOString() ?? null,
    dailyClicks: days,
    crux: crux.reverse().map((h) => ({ week: h.week, lcp: h.lcpP75, inp: h.inpP75, cls: h.clsP75 })),
    index: index?.pages ?? [],
  };
}

