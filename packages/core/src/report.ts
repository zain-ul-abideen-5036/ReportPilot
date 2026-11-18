import { change, type Change, type Direction } from "./change";
import {
  brandedSplit, lowCtrPages, movers, shares, strikingDistance, topDriver, topTenMovement,
  type BrandedSplit, type LowCtrPage, type Mover, type TopTenMovement,
} from "./search";
import { assessVitals, vitalRegression, type VitalsAssessment } from "./vitals";
import { summariseUptime, type UptimeSummary } from "./uptime";
import {
  indexingFindings, rankFindings, searchFindings, speedFindings, uptimeFindings, type Finding,
} from "./insights";
import type {
  CollectedData, CruxWeek, DailySearchPoint, DimensionRow, Incident, IndexStatusRow, LabScore,
  PageRow, Period, QueryRow, SitemapStatus, SpeedOpportunity, UptimeDay, VitalsP75, FormFactor,
} from "./types";

/**
 * The calculate stage: turns collected data into everything the report
 * shows. Pure and deterministic, so the same input always produces the
 * same report, and the output is stored as reports.data.
 */

export type KpiKey = "clicks" | "impressions" | "ctr" | "position";

export interface Kpi {
  key: KpiKey;
  label: string;
  value: number;
  direction: Direction;
  mom: Change;
  yoy: Change;
  /** 13 monthly values, oldest first. */
  spark: number[];
}

export type Light = "good" | "watch" | "act" | "unknown";

export interface BuiltSearch {
  final: boolean;
  kpis: Kpi[];
  daily: DailySearchPoint[];
  dailyPrevious: DailySearchPoint[];
  topQueries: QueryRow[];
  topPages: PageRow[];
  pageMovers: { gainers: Mover[]; losers: Mover[] };
  queryMovers: { gainers: Mover[]; losers: Mover[] };
  strikingDistance: QueryRow[];
  lowCtr: LowCtrPage[];
  topTen: TopTenMovement;
  branded: BrandedSplit | null;
  devices: Array<DimensionRow & { share: number }>;
  countries: Array<DimensionRow & { share: number }>;
  driver: Mover | null;
}

export interface BuiltSpeed {
  field: VitalsP75 & { formFactor: FormFactor };
  fieldPrevious: VitalsP75 | null;
  assessment: VitalsAssessment;
  inpRegression: number | null;
  lcpRegression: number | null;
  lab: LabScore[];
  history: CruxWeek[];
  opportunities: SpeedOpportunity[];
}

export interface BuiltUptime {
  summary: UptimeSummary;
  days: UptimeDay[];
  incidents: Incident[];
}

export interface BuiltIndexing {
  pages: IndexStatusRow[];
  sitemaps: SitemapStatus[];
}

export interface ReportData {
  period: Period;
  siteUrl: string;
  status: { search: Light; speed: Light; reliability: Light };
  search: BuiltSearch | null;
  speed: BuiltSpeed | null;
  uptime: BuiltUptime | null;
  indexing: BuiltIndexing | null;
  findings: Finding[];
  freshness: { searchThrough: string | null; searchFinal: boolean };
}

const KPI_META: Record<KpiKey, { label: string; direction: Direction }> = {
  clicks: { label: "Clicks", direction: "higher-is-better" },
  impressions: { label: "Impressions", direction: "higher-is-better" },
  ctr: { label: "Click-through rate", direction: "higher-is-better" },
  position: { label: "Average position", direction: "lower-is-better" },
};

function buildSearch(input: NonNullable<CollectedData["search"]>, brandedPattern: string | null): BuiltSearch {
  const { current, previous, yearAgo, trailing } = input;
  const kpis = (Object.keys(KPI_META) as KpiKey[]).map((key) => ({
    key,
    ...KPI_META[key],
    value: current.totals[key],
    mom: change(current.totals[key], previous?.totals[key]),
    yoy: change(current.totals[key], yearAgo?.totals[key]),
    spark: trailing.map((t) => t[key]),
  }));
  return {
    final: current.final,
    kpis,
    daily: current.daily,
    dailyPrevious: previous?.daily ?? [],
    topQueries: [...current.queries].sort((a, b) => b.clicks - a.clicks).slice(0, 10),
    topPages: [...current.pages].sort((a, b) => b.clicks - a.clicks).slice(0, 10),
    pageMovers: movers(current.pages, previous?.pages ?? [], (p) => p.page),
    queryMovers: movers(current.queries, previous?.queries ?? [], (q) => q.query),
    strikingDistance: strikingDistance(current.queries),
    lowCtr: lowCtrPages(current.pages),
    topTen: topTenMovement(current.queries, previous?.queries ?? []),
    branded: brandedSplit(current.queries, brandedPattern),
    devices: shares(current.devices),
    countries: shares(current.countries).slice(0, 6),
    driver: topDriver(current, previous),
  };
}

function buildSpeed(sp: NonNullable<CollectedData["speed"]>): BuiltSpeed {
  return {
    field: sp.field,
    fieldPrevious: sp.fieldPrevious,
    assessment: assessVitals(sp.field),
    inpRegression: vitalRegression(sp.field.inp, sp.fieldPrevious?.inp ?? null),
    lcpRegression: vitalRegression(sp.field.lcp, sp.fieldPrevious?.lcp ?? null),
    lab: sp.lab,
    history: sp.history,
    opportunities: [...sp.opportunities].sort((a, b) => b.savingsMs - a.savingsMs).slice(0, 3),
  };
}

export function searchLight(s: BuiltSearch | null): Light {
  const pct = s?.kpis.find((k) => k.key === "clicks")?.mom.pct;
  if (pct === null || pct === undefined) return "unknown";
  if (pct <= -0.15) return "act";
  if (pct < -0.05) return "watch";
  return "good";
}

export function speedLight(s: BuiltSpeed | null): Light {
  if (!s) return "unknown";
  const r = Object.values(s.assessment.ratings);
  if (r.includes("poor")) return "act";
  if (s.assessment.passes) return "good";
  if (r.every((x) => x === "unknown")) return "unknown";
  return "watch";
}

export function reliabilityLight(u: BuiltUptime | null): Light {
  if (!u) return "unknown";
  const { uptimePct, certDaysLeft, domainDaysLeft } = u.summary;
  if (uptimePct < 99 || (certDaysLeft ?? 99) < 7 || (domainDaysLeft ?? 99) < 10) return "act";
  if (uptimePct < 99.9 || (certDaysLeft ?? 99) < 21 || (domainDaysLeft ?? 99) < 30) return "watch";
  return "good";
}

export function buildReport(data: CollectedData, now: Date = new Date()): ReportData {
  const search = data.search ? buildSearch(data.search, data.site.brandedPattern) : null;
  const speed = data.speed ? buildSpeed(data.speed) : null;
  const uptime = data.uptime
    ? { summary: summariseUptime(data.uptime, now), days: data.uptime.days, incidents: data.uptime.incidents }
    : null;
  const indexing = data.indexing;

  const findings = rankFindings([
    ...(search ? searchFindings(search) : []),
    ...(speed ? speedFindings(speed) : []),
    ...(uptime ? uptimeFindings(uptime) : []),
    ...(indexing ? indexingFindings(indexing) : []),
  ]);

  const lastDay = search?.daily.at(-1)?.day ?? null;
  return {
    period: data.period,
    siteUrl: data.site.url,
    status: { search: searchLight(search), speed: speedLight(speed), reliability: reliabilityLight(uptime) },
    search,
    speed,
    uptime,
    indexing,
    findings,
    freshness: { searchThrough: lastDay, searchFinal: search?.final ?? false },
  };
}
