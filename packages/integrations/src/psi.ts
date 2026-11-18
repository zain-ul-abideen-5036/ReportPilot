import { median, type FormFactor, type LabScore, type SpeedOpportunity, type VitalsP75 } from "@reportpilot/core";
import { requestJson, type FetchLike } from "./http";

/**
 * PageSpeed Insights API v5: Lighthouse lab results plus CrUX field data.
 * Free with an API key (25,000 queries a day). Lab scores swing between
 * runs, so the weekly job runs each page three times and keeps the median.
 */

const ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";

interface Audit { score?: number | null; numericValue?: number; details?: { type?: string; overallSavingsMs?: number } ; title?: string }

export interface PsiResponse {
  lighthouseResult?: {
    categories?: { performance?: { score?: number | null } };
    audits?: Record<string, Audit>;
  };
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number }>;
  };
}

export interface PsiRun {
  lab: LabScore;
  field: VitalsP75 | null;
  opportunities: SpeedOpportunity[];
}

export function parsePsi(url: string, strategy: FormFactor, json: PsiResponse): PsiRun {
  const audits = json.lighthouseResult?.audits ?? {};
  const score = Math.round((json.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
  const metric = (k: string) => audits[k]?.numericValue ?? 0;
  const m = json.loadingExperience?.metrics;
  const field = m
    ? {
        lcp: m.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
        inp: m.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
        // CrUX reports CLS multiplied by 100.
        cls: m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile != null ? m.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
      }
    : null;
  const opportunities = Object.entries(audits)
    .filter(([, a]) => a.details?.type === "opportunity" && (a.details.overallSavingsMs ?? 0) > 0)
    .map(([id, a]) => ({ id, title: a.title ?? id, savingsMs: Math.round(a.details!.overallSavingsMs!), url }))
    .sort((a, b) => b.savingsMs - a.savingsMs);
  return {
    lab: {
      url, strategy, score,
      lcp: Math.round(metric("largest-contentful-paint")),
      cls: +metric("cumulative-layout-shift").toFixed(3),
      tbt: Math.round(metric("total-blocking-time")),
    },
    field,
    opportunities,
  };
}

export class PageSpeed {
  constructor(private readonly apiKey: string | undefined, private readonly fetchImpl?: FetchLike) {}

  async run(url: string, strategy: FormFactor): Promise<PsiRun> {
    const qs = new URLSearchParams({ url, strategy, category: "performance" });
    if (this.apiKey) qs.set("key", this.apiKey);
    const json = await requestJson<PsiResponse>(`${ENDPOINT}?${qs}`, {}, { api: "PageSpeed Insights", fetch: this.fetchImpl, timeoutMs: 90_000 });
    return parsePsi(url, strategy, json);
  }

  /**
   * Three runs, median score. The run whose score is the median supplies
   * the metrics and opportunities, so the figures stay internally consistent.
   */
  async medianOfThree(url: string, strategy: FormFactor): Promise<PsiRun> {
    const runs: PsiRun[] = [];
    for (let i = 0; i < 3; i++) runs.push(await this.run(url, strategy));
    return pickMedianRun(runs);
  }
}

export function pickMedianRun(runs: PsiRun[]): PsiRun {
  const target = median(runs.map((r) => r.lab.score));
  return runs.reduce((best, r) => (Math.abs(r.lab.score - target) < Math.abs(best.lab.score - target) ? r : best));
}
