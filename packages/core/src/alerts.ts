import { THRESHOLDS, type VitalName } from "./vitals";
import { daysUntil } from "./dates";
import { formatCls, formatInt, formatMs, formatSeconds, formatSignedPct, urlPath } from "./format";
import type { CruxWeek, IndexStatusRow } from "./types";

/**
 * Alerts between reports. The daily job gathers a small snapshot per site
 * and these rules decide what deserves an email today. Downtime is raised
 * by the uptime worker the moment an incident opens; everything else is
 * raised here.
 *
 * Every alert carries a dedupe key, so the same condition alerts once per
 * window (a certificate alerts at 21 days and again at 7, not every day).
 */

export type AlertKind = "downtime" | "ssl" | "domain" | "traffic" | "vitals" | "indexing" | "bounce";
export type AlertSeverity = "critical" | "warning";

export interface AlertCandidate {
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  /** Unique per site; an alert with an existing key is not raised again. */
  dedupeKey: string;
}

export interface AlertSnapshot {
  certExpiresAt: string | null;
  domainExpiresAt: string | null;
  /** Daily organic clicks, oldest first, most recent day last. At least 35 days for a traffic check. */
  dailyClicks: Array<{ day: string; clicks: number }>;
  /** Weekly CrUX p75 on phones, oldest first. */
  crux: CruxWeek[];
  /** Latest URL Inspection result per key page. */
  index: IndexStatusRow[];
}

export const ALERT_RULES = {
  ssl: { warnDays: 21, criticalDays: 7 },
  domain: { warnDays: 30, criticalDays: 10 },
  /** Last 7 days against the 28 days before them. */
  traffic: { recentDays: 7, baselineDays: 28, dropPct: -0.3, minBaselinePerDay: 20 },
  /** Latest week against four weeks earlier. */
  vitals: { lookbackWeeks: 4, regressionPct: 0.2 },
} as const;

function expiry(kind: "ssl" | "domain", iso: string | null, now: Date): AlertCandidate | null {
  if (!iso) return null;
  const days = daysUntil(iso, now);
  const rule = ALERT_RULES[kind];
  if (days > rule.warnDays) return null;
  const critical = days <= rule.criticalDays;
  const what = kind === "ssl" ? "SSL certificate" : "Domain registration";
  const window = critical ? "critical" : "warning";
  return {
    kind,
    severity: critical ? "critical" : "warning",
    title: days < 0 ? `${what} expired ${formatInt(daysUntil(now.toISOString(), new Date(iso)))} days ago` : `${what} expires in ${formatInt(days)} days`,
    detail: kind === "ssl"
      ? "Visitors will see a security warning once it expires. Check that automatic renewal is working with the host."
      : "If the domain lapses the site and email stop working. Renew it with the registrar.",
    // One alert per expiry date per window: renewing changes the date and resets it.
    dedupeKey: `${kind}:${iso.slice(0, 10)}:${window}`,
  };
}

/** A sharp drop in organic clicks: the last 7 days against the 28 days before. */
export function trafficDrop(daily: AlertSnapshot["dailyClicks"]): AlertCandidate | null {
  const { recentDays, baselineDays, dropPct, minBaselinePerDay } = ALERT_RULES.traffic;
  if (daily.length < recentDays + baselineDays) return null;
  const recent = daily.slice(-recentDays);
  const baseline = daily.slice(-(recentDays + baselineDays), -recentDays);
  const recentAvg = recent.reduce((s, d) => s + d.clicks, 0) / recentDays;
  const baseAvg = baseline.reduce((s, d) => s + d.clicks, 0) / baselineDays;
  // Tiny sites swing wildly; 3 clicks becoming 1 is not news.
  if (baseAvg < minBaselinePerDay) return null;
  const change = (recentAvg - baseAvg) / baseAvg;
  if (change > dropPct) return null;
  const lastDay = recent.at(-1)!.day;
  return {
    kind: "traffic",
    severity: change <= -0.5 ? "critical" : "warning",
    title: `Organic clicks ${formatSignedPct(change, 0)} over the last 7 days`,
    detail: `About ${formatInt(Math.round(recentAvg))} clicks a day, against ${formatInt(Math.round(baseAvg))} in the four weeks before. Check for a site change, a noindex tag or a Google update.`,
    // One alert per ISO week of the drop.
    dedupeKey: `traffic:${isoWeek(lastDay)}`,
  };
}

/** A Core Web Vitals regression that also crosses Google's "good" line. */
export function vitalsRegression(weeks: CruxWeek[]): AlertCandidate | null {
  const { lookbackWeeks, regressionPct } = ALERT_RULES.vitals;
  if (weeks.length <= lookbackWeeks) return null;
  const now = weeks.at(-1)!;
  const then = weeks.at(-1 - lookbackWeeks)!;
  const worst: Array<{ name: VitalName; change: number; value: number }> = [];
  for (const name of ["lcp", "inp", "cls"] as const) {
    const a = then[name];
    const b = now[name];
    if (a === null || b === null || a === 0) continue;
    const change = (b - a) / a;
    if (change >= regressionPct && b > THRESHOLDS[name].good) worst.push({ name, change, value: b });
  }
  if (worst.length === 0) return null;
  worst.sort((x, y) => y.change - x.change);
  const top = worst[0]!;
  const label = { lcp: "LCP", inp: "INP", cls: "CLS" }[top.name];
  const value = top.name === "lcp" ? formatSeconds(top.value) : top.name === "inp" ? formatMs(top.value) : formatCls(top.value);
  return {
    kind: "vitals",
    severity: top.value > THRESHOLDS[top.name].poor ? "critical" : "warning",
    title: `${label} regressed ${formatSignedPct(top.change, 0)} for real visitors`,
    detail: `Now ${value} at the 75th percentile on phones, measured by Chrome over the last 28 days. Look at what shipped around ${then.week}.`,
    dedupeKey: `vitals:${top.name}:${now.week}`,
  };
}

/** Key pages that Google has dropped from its index. */
export function indexingDrop(rows: IndexStatusRow[]): AlertCandidate | null {
  const failing = rows.filter((r) => r.verdict === "FAIL");
  if (failing.length === 0) return null;
  const names = failing.map((r) => urlPath(r.url));
  return {
    kind: "indexing",
    severity: "warning",
    title: failing.length === 1 ? `${names[0]} is not in Google's index` : `${failing.length} key pages are not in Google's index`,
    detail: `${names.slice(0, 3).join(", ")}: ${failing[0]!.coverageState}. Inspect the page in Search Console and request indexing once fixed.`,
    dedupeKey: `indexing:${names.sort().join("|")}`,
  };
}

export function evaluateAlerts(s: AlertSnapshot, now: Date = new Date()): AlertCandidate[] {
  return [
    expiry("ssl", s.certExpiresAt, now),
    expiry("domain", s.domainExpiresAt, now),
    trafficDrop(s.dailyClicks),
    vitalsRegression(s.crux),
    indexingDrop(s.index),
  ].filter((a): a is AlertCandidate => a !== null);
}

/** ISO 8601 week label, e.g. "2026-W45". */
export function isoWeek(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
