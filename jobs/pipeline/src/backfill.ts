import { addMonths, reportingPeriodFor, trailingPeriods, type MonthSearch } from "@reportpilot/core";
import type { Logger } from "./log";

/**
 * The onboarding backfill: 16 months of Search Console history, so the
 * very first report already has year-on-year comparisons and a full
 * 13-month sparkline. Search Console keeps 16 months, so that is the most
 * anyone can get.
 *
 * Months are saved one at a time. If the job is interrupted it simply
 * starts again; months already archived are skipped.
 */

export const BACKFILL_MONTHS = 16;

export interface BackfillSource {
  isMonthFinal(property: string, period: string): Promise<boolean>;
  month(property: string, period: string): Promise<MonthSearch>;
}

export interface BackfillTarget {
  has(siteId: string, period: string): Promise<boolean>;
  save(siteId: string, month: MonthSearch): Promise<void>;
  markDone(siteId: string, at: Date): Promise<void>;
}

export async function backfillSite(
  site: { id: string; gscProperty: string },
  deps: { source: BackfillSource; target: BackfillTarget; log: Logger; now: Date; months?: number },
) {
  const log = deps.log.child({ siteId: site.id, job: "backfill" });
  let latest = reportingPeriodFor(deps.now);
  // Early in the month the previous month may not be final yet; start one earlier.
  if (!(await deps.source.isMonthFinal(site.gscProperty, latest))) latest = addMonths(latest, -1);
  const periods = trailingPeriods(latest, deps.months ?? BACKFILL_MONTHS).reverse(); // newest first
  let saved = 0;
  let skipped = 0;
  const failed: string[] = [];
  for (const period of periods) {
    if (await deps.target.has(site.id, period)) {
      skipped++;
      continue;
    }
    try {
      const month = await deps.source.month(site.gscProperty, period);
      // A month before the property existed comes back empty; nothing to store.
      if (month.totals.impressions === 0 && month.queries.length === 0) {
        log.info("no data for month; property is newer than this", { period });
        break;
      }
      await deps.target.save(site.id, month);
      saved++;
    } catch (err) {
      failed.push(period);
      log.warn("backfill month failed", { period, error: (err as Error).message });
    }
  }
  // Only mark the site done when nothing failed, so the daily job retries the gaps tomorrow.
  if (failed.length === 0) await deps.target.markDone(site.id, deps.now);
  log.info("backfill finished", { saved, skipped, failed: failed.length });
  return { saved, skipped, failed };
}
