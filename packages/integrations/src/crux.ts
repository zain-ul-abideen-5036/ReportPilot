import type { CruxWeek } from "@reportpilot/core";
import { requestJson, type FetchLike } from "./http";

/**
 * Chrome UX Report History API: weekly real-visitor p75 for the last 25
 * collection periods, so trend lines need no history of our own.
 */

const ENDPOINT = "https://chromeuxreport.googleapis.com/v1/records:queryHistoryRecord";

interface Period { lastDate: { year: number; month: number; day: number } }
interface HistoryResponse {
  record?: {
    collectionPeriods?: Period[];
    metrics?: Record<string, { percentilesTimeseries?: { p75s?: Array<number | string | null> } }>;
  };
}

const iso = (d: Period["lastDate"]) => `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
const num = (v: number | string | null | undefined) => (v === null || v === undefined || v === "NaN" ? null : Number(v));

export function parseHistory(json: HistoryResponse): CruxWeek[] {
  const periods = json.record?.collectionPeriods ?? [];
  const m = json.record?.metrics ?? {};
  const series = (k: string) => m[k]?.percentilesTimeseries?.p75s ?? [];
  const lcp = series("largest_contentful_paint");
  const inp = series("interaction_to_next_paint");
  const cls = series("cumulative_layout_shift");
  return periods.map((p, i) => ({ week: iso(p.lastDate), lcp: num(lcp[i]), inp: num(inp[i]), cls: num(cls[i]) }));
}

export class CruxHistory {
  constructor(private readonly apiKey: string, private readonly fetchImpl?: FetchLike) {}

  /**
   * Origin-level by default; pass a URL for page-level. Returns [] when
   * the site has too little Chrome traffic to be in the dataset (404),
   * which the report shows as "no real-visitor data yet".
   */
  async weekly(target: { origin: string } | { url: string }, formFactor: "PHONE" | "DESKTOP" = "PHONE"): Promise<CruxWeek[]> {
    try {
      const json = await requestJson<HistoryResponse>(
        `${ENDPOINT}?key=${encodeURIComponent(this.apiKey)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...target, formFactor, metrics: ["largest_contentful_paint", "interaction_to_next_paint", "cumulative_layout_shift"] }),
        },
        { api: "CrUX History", fetch: this.fetchImpl },
      );
      return parseHistory(json);
    } catch (err) {
      if ((err as { status?: number }).status === 404) return [];
      throw err;
    }
  }
}
