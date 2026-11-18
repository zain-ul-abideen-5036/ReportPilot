import {
  addMonths, ctrOf, daysInPeriod, expectedCtr, median, parsePeriod, periodDays, sumTotals, trailingPeriods,
  type CollectedData, type CruxWeek, type DailySearchPoint, type DimensionRow, type Incident, type IndexStatusRow,
  type LabScore, type MonthSearch, type PageRow, type QueryRow, type SitemapStatus, type SpeedOpportunity,
  type UptimeDay, type UptimeMonth,
} from "@reportpilot/core";
import { DEMO_NOW, DEMO_PERIOD, SITES, type DemoSite } from "./agency";
import { between, createRng, hash, intBetween, pick, wobble, type Rng } from "./random";

/**
 * Generates Search Console, PageSpeed, CrUX and uptime data shaped exactly
 * like the real collectors' output, so the demo exercises the same code
 * path as production.
 */

const HISTORY_START = "2025-07";

interface QuerySeed {
  query: string;
  page: string;
  demand: number;
  basePosition: number;
  ctrFactor: number;
  branded: boolean;
  /** Per-query improvement in position per month. */
  drift: number;
}

function monthIndex(period: string): number {
  const a = parsePeriod(HISTORY_START);
  const b = parsePeriod(period);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

function seasonal(period: string, amplitude = 0.08): number {
  const { month } = parsePeriod(period);
  return 1 + amplitude * Math.sin(((month - 3) / 12) * Math.PI * 2);
}

const querySeedCache = new Map<string, QuerySeed[]>();

function querySeeds(site: DemoSite): QuerySeed[] {
  const cached = querySeedCache.get(site.id);
  if (cached) return cached;
  const rng = createRng(hash(site.id + ":queries"));
  const seeds: QuerySeed[] = [];
  const pages = [...site.keyPages, "/about/", "/blog/", "/reviews/", "/pricing/", "/faq/"];
  site.topic.brand.forEach((q, i) => {
    seeds.push({
      query: q, page: "/", demand: 900 / (i + 1), basePosition: between(rng, 1, 1.4),
      ctrFactor: between(rng, 1.1, 1.5), branded: true, drift: 0,
    });
  });
  let rank = 1;
  for (const service of site.topic.services) {
    for (const place of site.topic.places) {
      if (rng() < 0.28) continue;
      const query = place === "near me" || place === "best" || place === "cost" || place === "price"
        ? (place === "best" ? `best ${service}` : `${service} ${place}`)
        : `${service} ${place}`;
      const page = rng() < 0.7 ? pick(rng, site.keyPages.slice(1)) : pick(rng, pages);
      seeds.push({
        query, page,
        demand: 2600 / rank ** 0.72,
        basePosition: Math.min(48, 2 + rng() ** 1.6 * 34),
        ctrFactor: between(rng, 0.7, 1.25),
        branded: false,
        drift: between(rng, -0.01, 0.035),
      });
      rank++;
    }
    seeds.push({
      query: service, page: pick(rng, site.keyPages), demand: 4200 / rank ** 0.6,
      basePosition: between(rng, 9, 38), ctrFactor: between(rng, 0.6, 1), branded: false,
      drift: between(rng, 0, 0.03),
    });
    rank++;
  }
  // One page that ranks well but writes poor titles, so the low-CTR rule has work to do.
  const weakPage = site.keyPages[2] ?? site.keyPages[1] ?? "/";
  for (const s of seeds) if (s.page === weakPage && !s.branded) s.ctrFactor *= 0.32;
  querySeedCache.set(site.id, seeds);
  return seeds;
}

function scaleFor(site: DemoSite): number {
  // Calibrate so month 0 delivers roughly baseClicks per day.
  const seeds = querySeeds(site);
  let clicks = 0;
  for (const s of seeds) clicks += s.demand * expectedCtr(s.basePosition) * s.ctrFactor;
  return (site.profile.baseClicks * 30) / (clicks * 1.25);
}

export function monthSearch(site: DemoSite, period: string): MonthSearch {
  const m = monthIndex(period);
  const rng = createRng(hash(`${site.id}:${period}:search`));
  const p = site.profile;
  const shock = period === DEMO_PERIOD && p.shock ? 1 + p.shock : 1;
  const demandScale = scaleFor(site) * (1 + p.growth * 0.45) ** m * seasonal(period);

  const queries: QueryRow[] = [];
  const pageAgg = new Map<string, { clicks: number; impressions: number; weighted: number }>();
  for (const s of querySeeds(site)) {
    const improvement = (1 - s.drift * 0.4 - p.growth * 0.12) ** m;
    let position = Math.max(1, s.basePosition * improvement * wobble(rng, 0.18));
    if (shock < 1 && !s.branded) position *= 1 + (1 - shock) * 1.4;
    const impressions = Math.round(s.demand * demandScale * wobble(rng, 0.2) * (position > 20 ? 0.45 : 1));
    if (impressions < 3) continue;
    const ctr = Math.min(0.62, expectedCtr(position) * s.ctrFactor * wobble(rng, 0.15));
    const clicks = Math.round(impressions * ctr);
    queries.push({ query: s.query, clicks, impressions, ctr: ctrOf(clicks, impressions), position: +position.toFixed(1) });
    const url = new URL(s.page, site.url).toString();
    const agg = pageAgg.get(url) ?? { clicks: 0, impressions: 0, weighted: 0 };
    agg.clicks += clicks;
    agg.impressions += impressions;
    agg.weighted += position * impressions;
    pageAgg.set(url, agg);
  }

  const pages: PageRow[] = [...pageAgg.entries()].map(([page, a]) => {
    // Page totals include anonymised queries, so they run higher than the query sum.
    const clicks = Math.round(a.clicks * 1.18);
    const impressions = Math.round(a.impressions * 1.22);
    return { page, clicks, impressions, ctr: ctrOf(clicks, impressions), position: +(a.weighted / a.impressions).toFixed(1) };
  });

  const q = sumTotals(queries);
  const totals = {
    clicks: Math.round(q.clicks * 1.25),
    impressions: Math.round(q.impressions * 1.31),
    ctr: 0,
    position: +(q.position * 1.04).toFixed(1),
  };
  totals.ctr = ctrOf(totals.clicks, totals.impressions);

  return {
    period,
    final: true,
    totals,
    daily: dailySplit(rng, period, totals),
    queries: queries.sort((a, b) => b.clicks - a.clicks),
    pages: pages.sort((a, b) => b.clicks - a.clicks),
    devices: dimension(rng, totals, [["MOBILE", 0.61], ["DESKTOP", 0.34], ["TABLET", 0.05]]),
    countries: dimension(rng, totals, site.url.includes("thornbury")
      ? [["irl", 0.71], ["gbr", 0.17], ["usa", 0.05], ["deu", 0.03], ["fra", 0.02], ["esp", 0.02]]
      : [["gbr", 0.86], ["irl", 0.04], ["usa", 0.04], ["aus", 0.02], ["deu", 0.02], ["fra", 0.02]]),
  };
}

function dailySplit(rng: Rng, period: string, totals: MonthSearch["totals"]): DailySearchPoint[] {
  const days = periodDays(period);
  const weights = days.map((d) => {
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    const weekday = dow === 0 || dow === 6 ? 0.78 : 1.06;
    return weekday * wobble(rng, 0.14);
  });
  const sum = weights.reduce((a, b) => a + b, 0);
  return days.map((day, i) => {
    const share = weights[i]! / sum;
    const clicks = Math.round(totals.clicks * share);
    const impressions = Math.round(totals.impressions * share * wobble(rng, 0.06));
    return {
      day, clicks, impressions, ctr: ctrOf(clicks, impressions),
      position: +(totals.position * wobble(rng, 0.05)).toFixed(1),
    };
  });
}

function dimension(rng: Rng, totals: MonthSearch["totals"], split: Array<[string, number]>): DimensionRow[] {
  return split.map(([key, share]) => {
    const s = share * wobble(rng, 0.06);
    return { key, clicks: Math.round(totals.clicks * s), impressions: Math.round(totals.impressions * s) };
  });
}

const OPPORTUNITIES: Array<Omit<SpeedOpportunity, "url" | "savingsMs"> & { weight: number }> = [
  { id: "render-blocking-resources", title: "Eliminate render-blocking resources", weight: 1 },
  { id: "unused-javascript", title: "Reduce unused JavaScript", weight: 1.3 },
  { id: "modern-image-formats", title: "Serve images in modern formats", weight: 0.9 },
  { id: "offscreen-images", title: "Defer offscreen images", weight: 0.6 },
  { id: "server-response-time", title: "Reduce initial server response time", weight: 0.8 },
  { id: "third-party-summary", title: "Reduce the impact of third-party code", weight: 1.1 },
  { id: "uses-optimized-images", title: "Efficiently encode images", weight: 0.5 },
];

export function speedSnapshot(site: DemoSite, period: string): CollectedData["speed"] {
  const rng = createRng(hash(`${site.id}:${period}:speed`));
  const p = site.profile;
  const field = {
    formFactor: "mobile" as const,
    lcp: Math.round(p.lcp * wobble(rng, 0.05)),
    inp: Math.round(p.inp * wobble(rng, 0.05)),
    cls: +(p.cls * wobble(rng, 0.08)).toFixed(2),
  };
  const regressInp = site.id === "site_brightwater" ? 0.74 : 1;
  const fieldPrevious = {
    lcp: Math.round(field.lcp * wobble(rng, 0.08)),
    inp: Math.round(field.inp * regressInp * wobble(rng, 0.05)),
    cls: +(field.cls * wobble(rng, 0.1)).toFixed(2),
  };

  const history: CruxWeek[] = [];
  const end = Date.parse(`${addMonths(period, 1)}-01T00:00:00Z`);
  for (let w = 24; w >= 0; w--) {
    const t = 1 + (w / 24) * 0.12 * (p.growth > 0.02 ? 1 : -0.5);
    history.push({
      week: new Date(end - w * 7 * 86_400_000).toISOString().slice(0, 10),
      lcp: Math.round(field.lcp * t * wobble(rng, 0.04)),
      inp: Math.round(field.inp * (w > 4 ? 1 / regressInp ** 0.5 : 1) * t * wobble(rng, 0.05)),
      cls: +(field.cls * t * wobble(rng, 0.06)).toFixed(3),
    });
  }

  const lab: LabScore[] = [];
  for (const path of site.keyPages) {
    for (const strategy of ["mobile", "desktop"] as const) {
      const base = strategy === "mobile" ? 112 - p.lcp / 55 : 128 - p.lcp / 90;
      const runs = [0, 1, 2].map(() => Math.max(8, Math.min(100, base * wobble(rng, 0.09))));
      lab.push({
        url: new URL(path, site.url).toString(), strategy,
        score: Math.round(median(runs)),
        lcp: Math.round(p.lcp * (strategy === "mobile" ? 1.35 : 0.62) * wobble(rng, 0.1)),
        cls: +(p.cls * wobble(rng, 0.2)).toFixed(3),
        tbt: Math.round(p.inp * (strategy === "mobile" ? 1.6 : 0.5) * wobble(rng, 0.2)),
      });
    }
  }

  const opportunities = OPPORTUNITIES
    .map((o) => ({
      id: o.id, title: o.title,
      url: new URL(pick(rng, site.keyPages), site.url).toString(),
      savingsMs: Math.round(((p.lcp - 1500) * 0.35 * o.weight * between(rng, 0.4, 1.1)) / 10) * 10,
    }))
    .filter((o) => o.savingsMs > 60);

  return { field, fieldPrevious, lab, history, opportunities };
}

const CAUSES = [
  "HTTP 503 Service Unavailable",
  "Connection timed out after 10 s",
  "HTTP 502 Bad Gateway",
  "Expected text not found on page",
  "TLS handshake failed",
];

export function uptimeMonth(site: DemoSite, period: string, now: Date = DEMO_NOW): UptimeMonth {
  const rng = createRng(hash(`${site.id}:${period}:uptime`));
  const p = site.profile;
  const baseMs = 240 + (p.lcp - 1800) / 9;
  const incidents: Incident[] = [];
  const days: UptimeDay[] = periodDays(period).map((day) => {
    let down = 0;
    if (rng() < p.outageRate) {
      const minutes = intBetween(rng, 5, rng() < 0.2 ? 95 : 28);
      const startMinute = intBetween(rng, 0, 1440 - minutes);
      const start = new Date(Date.parse(`${day}T00:00:00Z`) + startMinute * 60_000);
      incidents.push({
        id: `inc_${site.id.slice(5)}_${day.replaceAll("-", "")}`,
        startedAt: start.toISOString(),
        resolvedAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
        cause: pick(rng, CAUSES),
      });
      down = minutes;
    }
    const avgMs = Math.round(baseMs * wobble(rng, 0.12) * (down ? 1.3 : 1));
    return {
      day,
      uptimePct: +(((1440 - down) / 1440) * 100).toFixed(3),
      avgMs,
      p95Ms: Math.round(avgMs * between(rng, 1.7, 2.6)),
    };
  });
  const day = 86_400_000;
  return {
    days,
    incidents,
    certExpiresAt: new Date(now.getTime() + p.certDays * day).toISOString(),
    domainExpiresAt: new Date(now.getTime() + p.domainDays * day).toISOString(),
  };
}

export function indexing(site: DemoSite, period: string): CollectedData["indexing"] {
  const rng = createRng(hash(`${site.id}:${period}:index`));
  const pages: IndexStatusRow[] = site.keyPages.map((path, i) => {
    const failing = site.id === "site_calder" && i === 2;
    const crawled = new Date(Date.parse(`${period}-01T00:00:00Z`) + intBetween(rng, 2, 27) * 86_400_000);
    return {
      url: new URL(path, site.url).toString(),
      verdict: failing ? "FAIL" : "PASS",
      coverageState: failing ? "Crawled - currently not indexed" : "Submitted and indexed",
      lastCrawl: crawled.toISOString(),
    };
  });
  const sitemaps: SitemapStatus[] = [{
    path: new URL("/sitemap.xml", site.url).toString(),
    errors: site.id === "site_pennine" ? 14 : 0,
    warnings: site.id === "site_pennine" ? 3 : intBetween(rng, 0, 1),
    submitted: 40 + intBetween(rng, 0, 260),
    lastDownloaded: `${period}-${String(Math.min(28, daysInPeriod(period))).padStart(2, "0")}T04:12:00Z`,
  }];
  return { pages, sitemaps };
}

/** Everything the calculate stage needs, exactly as the collectors produce it. */
export function collectDemo(siteId: string, period: string = DEMO_PERIOD): CollectedData {
  const site = SITES.find((s) => s.id === siteId);
  if (!site) throw new Error(`Unknown demo site ${siteId}`);
  const current = monthSearch(site, period);
  const trailing = trailingPeriods(period, 13).map((p) => ({ period: p, ...monthSearch(site, p).totals }));
  return {
    period,
    site: { url: site.url, brandedPattern: site.brandedRegex },
    search: {
      current,
      previous: monthSearch(site, addMonths(period, -1)),
      yearAgo: monthSearch(site, addMonths(period, -12)),
      trailing,
    },
    speed: site.id === "site_thornbury" ? null : speedSnapshot(site, period),
    uptime: uptimeMonth(site, period),
    indexing: indexing(site, period),
  };
}
