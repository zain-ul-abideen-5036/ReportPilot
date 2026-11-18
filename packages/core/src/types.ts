/**
 * Domain types shared by the pipeline, the PDF template and the dashboard.
 * Everything here is plain data so it can be stored as JSON in reports.data.
 */

/** A reporting month in `YYYY-MM` form, e.g. `2026-10`. */
export type Period = string;

export interface SearchTotals {
  clicks: number;
  impressions: number;
  /** Click-through rate as a fraction, 0.034 = 3.4%. */
  ctr: number;
  /** Impression-weighted average position. Lower is better. */
  position: number;
}

export interface DailySearchPoint extends SearchTotals {
  day: string; // YYYY-MM-DD
}

export interface QueryRow extends SearchTotals {
  query: string;
}

export interface PageRow extends SearchTotals {
  page: string;
}

export interface DimensionRow {
  key: string;
  clicks: number;
  impressions: number;
}

export interface MonthSearch {
  period: Period;
  /** True when Search Console reports the month as final (dataState=final). */
  final: boolean;
  totals: SearchTotals;
  daily: DailySearchPoint[];
  queries: QueryRow[];
  pages: PageRow[];
  devices: DimensionRow[];
  countries: DimensionRow[];
}

export type FormFactor = "mobile" | "desktop";

export interface VitalsP75 {
  /** Largest Contentful Paint, milliseconds. */
  lcp: number | null;
  /** Interaction to Next Paint, milliseconds. */
  inp: number | null;
  /** Cumulative Layout Shift, unitless. */
  cls: number | null;
}

export interface CruxWeek extends VitalsP75 {
  week: string; // ISO date of the collection period end
}

export interface SpeedOpportunity {
  id: string;
  title: string;
  savingsMs: number;
  url: string;
}

export interface LabScore {
  url: string;
  strategy: FormFactor;
  /** Median Lighthouse performance score of three runs, 0–100. */
  score: number;
  lcp: number;
  cls: number;
  tbt: number;
}

export interface SpeedSnapshot {
  field: VitalsP75 & { formFactor: FormFactor };
  fieldPrevious: VitalsP75 | null;
  lab: LabScore[];
  history: CruxWeek[];
  opportunities: SpeedOpportunity[];
}

export interface Incident {
  id: string;
  startedAt: string; // ISO timestamp
  resolvedAt: string | null;
  cause: string;
}

export interface UptimeDay {
  day: string;
  uptimePct: number;
  avgMs: number;
  p95Ms: number;
}

export interface UptimeMonth {
  days: UptimeDay[];
  incidents: Incident[];
  certExpiresAt: string | null;
  domainExpiresAt: string | null;
}

export interface IndexStatusRow {
  url: string;
  verdict: "PASS" | "NEUTRAL" | "FAIL";
  coverageState: string;
  lastCrawl: string | null;
}

export interface SitemapStatus {
  path: string;
  errors: number;
  warnings: number;
  submitted: number;
  lastDownloaded: string | null;
}

/**
 * Everything the calculate stage needs for one site and one month.
 * Any source may be null when collection failed; the report says so
 * honestly instead of showing zeros.
 */
export interface CollectedData {
  period: Period;
  site: { url: string; brandedPattern: string | null };
  search: {
    current: MonthSearch;
    previous: MonthSearch | null;
    yearAgo: MonthSearch | null;
    /** Monthly totals for the last 13 months, oldest first, for sparklines. */
    trailing: Array<{ period: Period } & SearchTotals>;
  } | null;
  speed: SpeedSnapshot | null;
  uptime: UptimeMonth | null;
  indexing: { pages: IndexStatusRow[]; sitemaps: SitemapStatus[] } | null;
}
