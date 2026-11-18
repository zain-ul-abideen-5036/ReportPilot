import { addMonths, trailingPeriods, type CollectedData, type MonthSearch } from "@reportpilot/core";
import type { CruxHistory, PageSpeed, SearchConsole } from "@reportpilot/integrations";
import type { PipelineSite } from "../store";
import type { Logger } from "../log";

/**
 * The collect stage. Each source is independent: a PageSpeed quota error
 * must not cost the client their search figures. Failures are returned
 * alongside the data so the report can say "unavailable this month".
 */

export interface Collectors {
  gsc?: SearchConsole;
  psi?: PageSpeed;
  crux?: CruxHistory;
  /** Uptime and indexing come from our own tables, written by the worker and weekly job. */
  uptime?: (siteId: string, period: string) => Promise<CollectedData["uptime"]>;
  indexing?: (siteId: string) => Promise<CollectedData["indexing"]>;
  speedSnapshot?: (siteId: string, period: string) => Promise<CollectedData["speed"]>;
}

export interface CollectResult {
  data: CollectedData;
  failures: Array<{ source: string; error: string }>;
  /** True when Search Console has not finalised the month yet. */
  notFinal: boolean;
}

export async function collect(site: PipelineSite, period: string, c: Collectors, log: Logger): Promise<CollectResult> {
  const failures: CollectResult["failures"] = [];
  const attempt = async <T>(source: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn();
    } catch (err) {
      const error = (err as Error).message;
      failures.push({ source, error });
      log.warn("source failed", { source, error });
      return null;
    }
  };

  let notFinal = false;
  const search = await attempt("Search Console", async () => {
    if (!c.gsc || !site.gscProperty) throw new Error("Search Console is not connected for this site");
    const gsc = c.gsc;
    const property = site.gscProperty;
    if (!(await gsc.isMonthFinal(property, period))) {
      notFinal = true;
      throw new Error(`Search Console has not finalised ${period} yet`);
    }
    const [current, previous, yearAgo] = await Promise.all([
      gsc.month(property, period),
      gsc.month(property, addMonths(period, -1)).catch(() => null),
      gsc.month(property, addMonths(period, -12)).catch(() => null),
    ]);
    // 13-month sparkline: reuse the months we have, fetch totals for the rest.
    const have = new Map<string, MonthSearch>([[period, current]]);
    if (previous) have.set(previous.period, previous);
    if (yearAgo) have.set(yearAgo.period, yearAgo);
    const trailing = [];
    for (const p of trailingPeriods(period, 13)) {
      const m = have.get(p) ?? (await gsc.month(property, p).catch(() => null));
      if (m) trailing.push({ period: p, ...m.totals });
    }
    return { current, previous, yearAgo, trailing };
  });

  const speed = await attempt("PageSpeed", async () => {
    if (!c.speedSnapshot) throw new Error("No speed snapshot available");
    return c.speedSnapshot(site.id, period);
  });
  const uptime = await attempt("Uptime", async () => (c.uptime ? c.uptime(site.id, period) : null));
  const indexing = await attempt("Indexing", async () => (c.indexing ? c.indexing(site.id) : null));

  return {
    data: { period, site: { url: site.url, brandedPattern: site.brandedRegex }, search, speed, uptime, indexing },
    failures,
    notFinal,
  };
}
