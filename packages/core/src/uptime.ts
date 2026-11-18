import type { Incident, UptimeDay, UptimeMonth } from "./types";
import { daysUntil } from "./dates";

/**
 * Reliability figures. Uptime is averaged across days (each day weighted
 * equally), which matches how the daily rollup is stored.
 */

export interface UptimeSummary {
  uptimePct: number;
  avgMs: number;
  p95Ms: number;
  incidentCount: number;
  downtimeMinutes: number;
  longestIncidentMinutes: number;
  certDaysLeft: number | null;
  domainDaysLeft: number | null;
}

export function incidentMinutes(i: Incident, until: Date = new Date()): number {
  const end = i.resolvedAt ? Date.parse(i.resolvedAt) : until.getTime();
  return Math.max(0, Math.round((end - Date.parse(i.startedAt)) / 60_000));
}

export function summariseUptime(month: UptimeMonth, now: Date = new Date()): UptimeSummary {
  const days = month.days;
  const avg = (pick: (d: UptimeDay) => number) =>
    days.length ? days.reduce((s, d) => s + pick(d), 0) / days.length : 0;
  const durations = month.incidents.map((i) => incidentMinutes(i, now));
  return {
    uptimePct: avg((d) => d.uptimePct),
    avgMs: Math.round(avg((d) => d.avgMs)),
    p95Ms: days.length ? Math.max(...days.map((d) => d.p95Ms)) : 0,
    incidentCount: month.incidents.length,
    downtimeMinutes: durations.reduce((s, m) => s + m, 0),
    longestIncidentMinutes: durations.length ? Math.max(...durations) : 0,
    certDaysLeft: month.certExpiresAt ? daysUntil(month.certExpiresAt, now) : null,
    domainDaysLeft: month.domainExpiresAt ? daysUntil(month.domainExpiresAt, now) : null,
  };
}

/**
 * Two-failure confirmation rule used by the uptime worker: an incident
 * opens only when the latest check and the 30-second re-check both fail.
 * Returns the new state given the previous one and the two results.
 */
export type MonitorState = "up" | "down";

export function nextMonitorState(previous: MonitorState, firstOk: boolean, recheckOk: boolean | null): MonitorState {
  if (firstOk) return "up";
  if (recheckOk === null) return previous; // re-check pending, keep current state
  return recheckOk ? "up" : "down";
}

/** p95 of a list of response times, nearest-rank method. */
export function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(0.95 * sorted.length) - 1;
  return sorted[Math.max(0, rank)]!;
}

/** Roll raw checks into one day's figures. */
export function rollupDay(day: string, checks: Array<{ ok: boolean; ms: number }>): UptimeDay {
  const ok = checks.filter((c) => c.ok);
  const times = ok.map((c) => c.ms);
  return {
    day,
    uptimePct: checks.length ? (ok.length / checks.length) * 100 : 100,
    avgMs: times.length ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0,
    p95Ms: p95(times),
  };
}
