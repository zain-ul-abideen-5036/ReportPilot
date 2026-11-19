import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { tables, type Database } from "@reportpilot/db";
import { SearchConsole, type GoogleAuth } from "@reportpilot/integrations";
import { backfillSite, type BackfillTarget } from "./backfill";
import { processSiteAlerts, type AlertNotifier, type AlertStore } from "./alerts";
import { alertSnapshotFromDb, saveMonth, upsertDaily } from "./pg-store";
import type { Heartbeat } from "./heartbeat";
import type { Logger } from "./log";

/**
 * The daily job (05:30 UTC):
 *   1. finish any owed 16-month backfill (new sites from onboarding),
 *   2. refresh the last 40 days of daily Search Console totals,
 *   3. raise and resolve alerts: SSL and domain expiry, traffic drops,
 *      Core Web Vitals regressions and key pages falling out of the index.
 * Each site is independent; one failure is logged and the job moves on.
 */

const { alerts, clients, gscMonthlyQuery, sites, users } = tables;

export function pgAlertStore(db: Database): AlertStore {
  return {
    async open(siteId) {
      return db.select({ id: alerts.id, kind: alerts.kind, dedupeKey: alerts.dedupeKey }).from(alerts)
        .where(and(eq(alerts.siteId, siteId), inArray(alerts.state, ["open", "acknowledged"])));
    },
    async raise(siteId, a) {
      const rows = await db.insert(alerts)
        .values({ siteId, kind: a.kind, severity: a.severity, title: a.title, detail: a.detail, dedupeKey: a.dedupeKey })
        .onConflictDoNothing({ target: [alerts.siteId, alerts.dedupeKey] })
        .returning({ id: alerts.id });
      return rows.length > 0;
    },
    async resolve(ids, at) {
      if (ids.length) await db.update(alerts).set({ state: "resolved", resolvedAt: at }).where(inArray(alerts.id, ids));
    },
  };
}

export function pgBackfillTarget(db: Database): BackfillTarget {
  return {
    async has(siteId, period) {
      const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(gscMonthlyQuery)
        .where(and(eq(gscMonthlyQuery.siteId, siteId), eq(gscMonthlyQuery.month, period)));
      return (row?.n ?? 0) > 0;
    },
    save: (siteId, month) => saveMonth(db, siteId, month),
    async markDone(siteId, at) {
      await db.update(sites).set({ backfilledAt: at }).where(eq(sites.id, siteId));
    },
  };
}

export async function runDaily(deps: {
  db: Database;
  auth: GoogleAuth | null;
  notify: AlertNotifier;
  log: Logger;
  heartbeat?: Heartbeat;
  now?: Date;
  siteId?: string;
}) {
  const now = deps.now ?? new Date();
  const today = now.toISOString().slice(0, 10);
  const gsc = deps.auth ? new SearchConsole(deps.auth) : null;
  await deps.heartbeat?.start();

  const rows = await deps.db
    .select({ site: sites, clientName: clients.name, notify: users.email })
    .from(sites)
    .innerJoin(clients, eq(clients.id, sites.clientId))
    .leftJoin(users, eq(users.id, clients.managerId))
    .where(and(eq(sites.active, true), eq(clients.status, "active"), deps.siteId ? eq(sites.id, deps.siteId) : undefined));

  const totals = { sites: rows.length, backfilled: 0, raised: 0, resolved: 0, failed: 0 };
  for (const { site, clientName, notify } of rows) {
    const log = deps.log.child({ siteId: site.id });
    try {
      if (gsc && site.gscProperty) {
        if (!site.backfilledAt) {
          const r = await backfillSite({ id: site.id, gscProperty: site.gscProperty }, { source: gsc, target: pgBackfillTarget(deps.db), log, now });
          if (r.failed.length === 0) totals.backfilled++;
        }
        const start = new Date(now.getTime() - 40 * 86_400_000).toISOString().slice(0, 10);
        const days = await gsc.daily(site.gscProperty, start, today, "all");
        await upsertDaily(deps.db, site.id, days);
      }
      const snapshot = await alertSnapshotFromDb(deps.db, site.id, today);
      const r = await processSiteAlerts(
        { id: site.id, clientName, url: site.url, notify },
        snapshot,
        { store: pgAlertStore(deps.db), notify: deps.notify, log, now },
      );
      totals.raised += r.raised;
      totals.resolved += r.resolved;
    } catch (err) {
      totals.failed++;
      log.error("daily job failed for site", { error: (err as Error).message });
    }
  }
  deps.log.info("daily job finished", totals);
  if (totals.failed) await deps.heartbeat?.fail(JSON.stringify(totals));
  else await deps.heartbeat?.success(JSON.stringify(totals));
  return totals;
}

/** Sites still owed a backfill, for the dashboard and the CLI. */
export async function pendingBackfills(db: Database) {
  return db.select({ id: sites.id, url: sites.url }).from(sites).where(and(eq(sites.active, true), isNull(sites.backfilledAt)));
}
