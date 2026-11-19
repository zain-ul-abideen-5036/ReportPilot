import {
  ctrOf, periodRange, type DimensionRow, type DailySearchPoint, type IndexStatusRow, type MonthSearch, type PageRow,
  type QueryRow, type SitemapStatus,
} from "@reportpilot/core";
import { requestJson, type FetchLike } from "./http";
import type { GoogleAuth } from "./google-auth";

/**
 * Google Search Console API v3 (searchanalytics.query, sitemaps.list) and
 * the URL Inspection API. Data lags two to three days; the monthly job
 * asks for dataState "final" and waits until the whole month is in.
 */

const BASE = "https://searchconsole.googleapis.com/webmasters/v3";
const INSPECT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect";
export const MAX_ROWS = 25_000;

type Dimension = "date" | "query" | "page" | "device" | "country";

interface ApiRow { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }

export interface QueryRequest {
  startDate: string;
  endDate: string;
  dimensions?: Dimension[];
  rowLimit?: number;
  dataState?: "final" | "all";
}

export class SearchConsole {
  constructor(private readonly auth: GoogleAuth, private readonly fetchImpl?: FetchLike) {}

  private async headers() {
    return { authorization: `Bearer ${await this.auth.token()}`, "content-type": "application/json" };
  }

  /** One page of results. */
  async queryPage(property: string, req: QueryRequest, startRow = 0): Promise<ApiRow[]> {
    const res = await requestJson<{ rows?: ApiRow[] }>(
      `${BASE}/sites/${encodeURIComponent(property)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: await this.headers(),
        body: JSON.stringify({ dataState: "final", ...req, rowLimit: req.rowLimit ?? MAX_ROWS, startRow }),
      },
      { api: "Search Console", fetch: this.fetchImpl },
    );
    return res.rows ?? [];
  }

  /**
   * Every row, following startRow pagination until a short page comes back.
   * `maxRows` stops early for the top-N tables we store.
   */
  async queryAll(property: string, req: QueryRequest, maxRows = Infinity): Promise<ApiRow[]> {
    const pageSize = Math.min(req.rowLimit ?? MAX_ROWS, MAX_ROWS);
    const rows: ApiRow[] = [];
    for (let start = 0; rows.length < maxRows; start += pageSize) {
      const page = await this.queryPage(property, { ...req, rowLimit: pageSize }, start);
      rows.push(...page);
      if (page.length < pageSize) break;
    }
    return rows.slice(0, maxRows);
  }

  /**
   * A month is final when "final" data includes its last day. Checked on
   * the 3rd; if not, the job waits and retries the next day.
   */
  async isMonthFinal(property: string, period: string): Promise<boolean> {
    const { startDate, endDate } = periodRange(period);
    const rows = await this.queryPage(property, { startDate, endDate, dimensions: ["date"], dataState: "final", rowLimit: 31 });
    return rows.some((r) => r.keys?.[0] === endDate);
  }

  /** Everything the report needs for one month, as aggregates. */
  async month(property: string, period: string, final = true): Promise<MonthSearch> {
    const { startDate, endDate } = periodRange(period);
    const base = { startDate, endDate };
    const [totalsRows, dailyRows, queryRows, pageRows, deviceRows, countryRows] = await Promise.all([
      this.queryPage(property, { ...base, rowLimit: 1 }),
      this.queryAll(property, { ...base, dimensions: ["date"] }),
      this.queryAll(property, { ...base, dimensions: ["query"] }, 1000),
      this.queryAll(property, { ...base, dimensions: ["page"] }, 500),
      this.queryAll(property, { ...base, dimensions: ["device"] }),
      this.queryAll(property, { ...base, dimensions: ["country"] }, 50),
    ]);
    const t = totalsRows[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
    return {
      period,
      final,
      totals: { clicks: t.clicks, impressions: t.impressions, ctr: ctrOf(t.clicks, t.impressions), position: t.position },
      daily: dailyRows.map(toDaily).sort((a, b) => a.day.localeCompare(b.day)),
      queries: queryRows.map((r): QueryRow => ({ query: r.keys?.[0] ?? "", ...metrics(r) })),
      pages: pageRows.map((r): PageRow => ({ page: r.keys?.[0] ?? "", ...metrics(r) })),
      devices: deviceRows.map(toDim),
      countries: countryRows.map(toDim),
    };
  }

  /**
   * Site totals per day. The alerts job asks for "all" rather than "final"
   * so a traffic drop shows up within two days instead of four; the
   * monthly report only ever uses final data.
   */
  async daily(property: string, startDate: string, endDate: string, dataState: "final" | "all" = "final"): Promise<DailySearchPoint[]> {
    const rows = await this.queryAll(property, { startDate, endDate, dimensions: ["date"], dataState });
    return rows.map(toDaily).sort((a, b) => a.day.localeCompare(b.day));
  }

  async sitemaps(property: string): Promise<SitemapStatus[]> {
    const res = await requestJson<{ sitemap?: Array<{ path: string; errors?: string; warnings?: string; lastDownloaded?: string; contents?: Array<{ submitted?: string }> }> }>(
      `${BASE}/sites/${encodeURIComponent(property)}/sitemaps`,
      { headers: await this.headers() },
      { api: "Search Console sitemaps", fetch: this.fetchImpl },
    );
    return (res.sitemap ?? []).map((s) => ({
      path: s.path,
      errors: Number(s.errors ?? 0),
      warnings: Number(s.warnings ?? 0),
      submitted: (s.contents ?? []).reduce((n, c) => n + Number(c.submitted ?? 0), 0),
      lastDownloaded: s.lastDownloaded ?? null,
    }));
  }

  /** URL Inspection for a key page. Quota: 2,000 a day per property. */
  async inspect(property: string, url: string): Promise<IndexStatusRow> {
    const res = await requestJson<{ inspectionResult?: { indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string } } }>(
      INSPECT,
      { method: "POST", headers: await this.headers(), body: JSON.stringify({ inspectionUrl: url, siteUrl: property, languageCode: "en-GB" }) },
      { api: "URL Inspection", fetch: this.fetchImpl },
    );
    const r = res.inspectionResult?.indexStatusResult ?? {};
    const verdict = r.verdict === "PASS" || r.verdict === "FAIL" ? r.verdict : "NEUTRAL";
    return { url, verdict, coverageState: r.coverageState ?? "Unknown", lastCrawl: r.lastCrawlTime ?? null };
  }
}

function metrics(r: ApiRow) {
  return { clicks: r.clicks, impressions: r.impressions, ctr: ctrOf(r.clicks, r.impressions), position: +r.position.toFixed(2) };
}

function toDaily(r: ApiRow): DailySearchPoint {
  return { day: r.keys?.[0] ?? "", ...metrics(r) };
}

function toDim(r: ApiRow): DimensionRow {
  return { key: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions };
}
