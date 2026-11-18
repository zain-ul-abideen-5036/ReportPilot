import { and, lt, isNull, isNotNull, sql } from "drizzle-orm";
import type { Database } from "./index";
import { reports, uptimeChecks } from "./schema";

/**
 * Data retention, run nightly by the uptime worker's rollup job.
 * Raw uptime checks are kept for 90 days (the daily rollup is kept
 * forever), and expired share links are cleared so old URLs stop working.
 * Documented in docs/privacy.md.
 */
export const RAW_CHECK_RETENTION_DAYS = 90;

export async function applyRetention(db: Database, now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - RAW_CHECK_RETENTION_DAYS * 86_400_000);
  const checks = await db.delete(uptimeChecks).where(lt(uptimeChecks.checkedAt, cutoff)).returning({ id: uptimeChecks.siteId });
  const links = await db
    .update(reports)
    .set({ shareToken: null, updatedAt: sql`now()` })
    .where(and(isNotNull(reports.shareToken), lt(reports.shareExpiresAt, now)))
    .returning({ id: reports.id });
  return { deletedChecks: checks.length, revokedLinks: links.length };
}

/** Reports approved but never sent for 7 days usually mean a delivery problem. */
export function staleApprovedFilter(now: Date = new Date()) {
  const week = new Date(now.getTime() - 7 * 86_400_000);
  return and(lt(reports.approvedAt, week), isNull(reports.sentAt));
}
