import type { DimensionRow, MonthSearch, PageRow, QueryRow, SearchTotals } from "./types";

/**
 * Search Console calculations: opportunities, movers and the branded split.
 * All functions are pure so the unit tests can pin their behaviour exactly.
 */

/**
 * Typical organic CTR by position, used to flag pages that under-perform
 * for where they rank. Values are deliberately conservative averages of
 * published click-curve studies; we compare against half of them.
 */
const EXPECTED_CTR: readonly number[] = [
  0.28, 0.155, 0.11, 0.08, 0.062, 0.048, 0.038, 0.031, 0.026, 0.022,
];

export function expectedCtr(position: number): number {
  if (!Number.isFinite(position) || position < 1) return EXPECTED_CTR[0]!;
  const index = Math.round(position) - 1;
  if (index < EXPECTED_CTR.length) return EXPECTED_CTR[index]!;
  // Page two and beyond: decays roughly 15% per position.
  return 0.022 * 0.85 ** (index - 9);
}

/** Recompute CTR from clicks and impressions; Search Console rounds it. */
export function ctrOf(clicks: number, impressions: number): number {
  return impressions > 0 ? clicks / impressions : 0;
}

/** Combine rows into totals with impression-weighted average position. */
export function sumTotals(rows: SearchTotals[]): SearchTotals {
  let clicks = 0;
  let impressions = 0;
  let weighted = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    weighted += r.position * r.impressions;
  }
  return {
    clicks,
    impressions,
    ctr: ctrOf(clicks, impressions),
    position: impressions > 0 ? weighted / impressions : 0,
  };
}

export interface StrikingDistanceOptions {
  minPosition?: number;
  maxPosition?: number;
  minImpressions?: number;
  limit?: number;
}

/**
 * Queries ranking just off page one (positions 8–20 by default) with real
 * demand behind them. Ordered by impressions: the bigger the audience,
 * the more a small ranking gain is worth.
 */
export function strikingDistance(
  queries: QueryRow[],
  { minPosition = 8, maxPosition = 20, minImpressions = 100, limit = 10 }: StrikingDistanceOptions = {},
): QueryRow[] {
  return queries
    .filter((q) => q.position >= minPosition && q.position <= maxPosition && q.impressions >= minImpressions)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
}

export interface LowCtrPage extends PageRow {
  expectedCtr: number;
  /** Extra monthly clicks if the page reached its expected CTR. */
  missedClicks: number;
}

/**
 * Pages that appear often but get clicked rarely for their position:
 * CTR under half of what the position normally earns. Usually a title
 * or meta description problem, which is cheap to fix.
 */
export function lowCtrPages(
  pages: PageRow[],
  { minImpressions = 500, ratio = 0.5, limit = 8 }: { minImpressions?: number; ratio?: number; limit?: number } = {},
): LowCtrPage[] {
  return pages
    .filter((p) => p.impressions >= minImpressions && p.position <= 20)
    .map((p) => {
      const exp = expectedCtr(p.position);
      return { ...p, expectedCtr: exp, missedClicks: Math.round(p.impressions * exp - p.clicks) };
    })
    .filter((p) => p.ctr < p.expectedCtr * ratio)
    .sort((a, b) => b.missedClicks - a.missedClicks)
    .slice(0, limit);
}

export interface Mover {
  key: string;
  current: number;
  previous: number;
  delta: number;
}

/**
 * Biggest gainers and losers by clicks between two months. Rows that only
 * exist in one month count as zero in the other, so a page that vanished
 * shows up as a loser rather than disappearing silently.
 */
export function movers<T extends { clicks: number }>(
  current: T[],
  previous: T[],
  keyOf: (row: T) => string,
  limit = 5,
): { gainers: Mover[]; losers: Mover[] } {
  const prev = new Map(previous.map((r) => [keyOf(r), r.clicks]));
  const curr = new Map(current.map((r) => [keyOf(r), r.clicks]));
  const keys = new Set([...prev.keys(), ...curr.keys()]);
  const all: Mover[] = [];
  for (const key of keys) {
    const c = curr.get(key) ?? 0;
    const p = prev.get(key) ?? 0;
    if (c !== p) all.push({ key, current: c, previous: p, delta: c - p });
  }
  const gainers = all.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, limit);
  const losers = all.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, limit);
  return { gainers, losers };
}

export interface TopTenMovement {
  entered: QueryRow[];
  dropped: Array<QueryRow & { previousPosition: number }>;
}

/** Queries that moved onto or off page one between two months. */
export function topTenMovement(current: QueryRow[], previous: QueryRow[], limit = 8): TopTenMovement {
  const prev = new Map(previous.map((q) => [q.query, q]));
  const curr = new Map(current.map((q) => [q.query, q]));
  const entered = current
    .filter((q) => q.position <= 10 && (prev.get(q.query)?.position ?? Infinity) > 10)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
  const dropped = previous
    .filter((q) => q.position <= 10 && (curr.get(q.query)?.position ?? Infinity) > 10)
    .map((q) => {
      const now = curr.get(q.query);
      return {
        ...(now ?? { ...q, clicks: 0, impressions: 0, ctr: 0, position: 100 }),
        previousPosition: q.position,
      };
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, limit);
  return { entered, dropped };
}

export interface BrandedSplit {
  branded: SearchTotals;
  nonBranded: SearchTotals;
  /** Share of clicks from non-branded queries, the ones SEO work earns. */
  nonBrandedShare: number;
}

/**
 * Split query traffic by a per-client brand regex. Anonymised queries
 * are not in the query table, so these totals are lower than site totals
 * (explained in the report appendix).
 */
export function brandedSplit(queries: QueryRow[], pattern: string | null): BrandedSplit | null {
  if (!pattern) return null;
  let regex: RegExp;
  try {
    regex = new RegExp(pattern, "i");
  } catch {
    return null;
  }
  const branded = queries.filter((q) => regex.test(q.query));
  const nonBranded = queries.filter((q) => !regex.test(q.query));
  const b = sumTotals(branded);
  const n = sumTotals(nonBranded);
  const total = b.clicks + n.clicks;
  return { branded: b, nonBranded: n, nonBrandedShare: total > 0 ? n.clicks / total : 0 };
}

/** Share of clicks by dimension key (device, country), largest first. */
export function shares(rows: DimensionRow[]): Array<DimensionRow & { share: number }> {
  const total = rows.reduce((s, r) => s + r.clicks, 0);
  return rows
    .map((r) => ({ ...r, share: total > 0 ? r.clicks / total : 0 }))
    .sort((a, b) => b.clicks - a.clicks);
}

/** The page that contributed most to a change in total clicks. */
export function topDriver(current: MonthSearch, previous: MonthSearch | null): Mover | null {
  if (!previous) return null;
  const { gainers, losers } = movers(current.pages, previous.pages, (p) => p.page, 1);
  const totalDelta = current.totals.clicks - previous.totals.clicks;
  const pick = totalDelta >= 0 ? gainers[0] : losers[0];
  return pick ?? null;
}
