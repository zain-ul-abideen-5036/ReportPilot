import { DEMO_NOW, SITES, CLIENTS } from "./agency";

/**
 * The agency's recent activity: alerts raised between reports, pipeline
 * runs and the audit trail. Timestamps are relative to DEMO_NOW.
 */

const minutesAgo = (m: number) => new Date(DEMO_NOW.getTime() - m * 60_000).toISOString();

export type AlertKind = "downtime" | "ssl" | "domain" | "traffic" | "vitals" | "indexing";
export type AlertState = "open" | "acknowledged" | "resolved";

export interface DemoAlert {
  id: string;
  siteId: string;
  kind: AlertKind;
  severity: "critical" | "warning";
  state: AlertState;
  title: string;
  detail: string;
  raisedAt: string;
  resolvedAt: string | null;
}

export const ALERTS: DemoAlert[] = [
  {
    id: "alr_01", siteId: "site_calder", kind: "ssl", severity: "critical", state: "open",
    title: "SSL certificate expires in 5 days",
    detail: "Issued by R11 (Let's Encrypt). Auto-renewal has failed twice; the ACME challenge returns 404.",
    raisedAt: minutesAgo(52), resolvedAt: null,
  },
  {
    id: "alr_02", siteId: "site_brightwater", kind: "downtime", severity: "critical", state: "acknowledged",
    title: "Site down for 23 minutes",
    detail: "HTTP 503 from origin, confirmed by re-check after 30 s. Recovered at 07:41.",
    raisedAt: minutesAgo(118), resolvedAt: minutesAgo(95),
  },
  {
    id: "alr_03", siteId: "site_pennine", kind: "traffic", severity: "warning", state: "open",
    title: "Organic clicks down 21% week on week",
    detail: "Drop concentrated on /collections/walking-boots/ after the 11 Nov core update.",
    raisedAt: minutesAgo(60 * 9), resolvedAt: null,
  },
  {
    id: "alr_04", siteId: "site_brightwater", kind: "domain", severity: "warning", state: "open",
    title: "Domain expires in 22 days",
    detail: "brightwater-heating.test via RDAP. Registrar auto-renew status unknown.",
    raisedAt: minutesAgo(60 * 26), resolvedAt: null,
  },
  {
    id: "alr_05", siteId: "site_brightwater", kind: "vitals", severity: "warning", state: "acknowledged",
    title: "INP regressed 35% on mobile",
    detail: "p75 INP rose from 171 ms to 231 ms over four weeks. Coincides with a new chat widget.",
    raisedAt: minutesAgo(60 * 52), resolvedAt: null,
  },
  {
    id: "alr_06", siteId: "site_calder", kind: "indexing", severity: "warning", state: "open",
    title: "Key page dropped from the index",
    detail: "/emergency-vet/ reports “Crawled - currently not indexed”.",
    raisedAt: minutesAgo(60 * 70), resolvedAt: null,
  },
  {
    id: "alr_07", siteId: "site_harlow", kind: "downtime", severity: "critical", state: "resolved",
    title: "Site down for 8 minutes",
    detail: "Connection timed out after 10 s during a hosting maintenance window.",
    raisedAt: minutesAgo(60 * 24 * 4 + 200), resolvedAt: minutesAgo(60 * 24 * 4 + 192),
  },
  {
    id: "alr_08", siteId: "site_marlowe", kind: "ssl", severity: "warning", state: "open",
    title: "SSL certificate expires in 17 days",
    detail: "Certificate is manually managed by the client's IT provider.",
    raisedAt: minutesAgo(60 * 24 * 5), resolvedAt: null,
  },
  {
    id: "alr_09", siteId: "site_kestrel", kind: "downtime", severity: "critical", state: "resolved",
    title: "Site down for 6 minutes",
    detail: "HTTP 502 Bad Gateway. Recovered without intervention.",
    raisedAt: minutesAgo(60 * 24 * 9), resolvedAt: minutesAgo(60 * 24 * 9 - 6),
  },
];

export type Stage = "plan" | "collect" | "calculate" | "insights" | "narrative" | "render" | "review" | "deliver";
export const STAGES: Stage[] = ["plan", "collect", "calculate", "insights", "narrative", "render", "review", "deliver"];

export interface DemoJobRun {
  id: string;
  siteId: string;
  period: string;
  stage: Stage;
  status: "succeeded" | "running" | "failed" | "waiting";
  attempts: number;
  durationMs: number | null;
  error: string | null;
  startedAt: string;
}

/** Latest run per site for the October cycle, in the state the clients list implies. */
export const JOB_RUNS: DemoJobRun[] = SITES.map((site, i) => {
  const client = CLIENTS.find((c) => c.id === site.clientId)!;
  const base = { id: `run_${i + 1}`, siteId: site.id, period: "2026-10", startedAt: minutesAgo(60 * 24 * 16 - i * 4) };
  switch (client.reportStatus) {
    case "failed":
      return { ...base, stage: "collect", status: "failed", attempts: 3, durationMs: 41_200,
        error: "PageSpeed Insights: 429 Quota exceeded for quota metric 'Queries per 100 seconds'. Search Console and uptime collected." };
    case "collecting":
      return { ...base, stage: "collect", status: "waiting", attempts: 2, durationMs: null,
        error: "Search Console reports October as not final yet. Next retry at 06:00." };
    case "sent":
      return { ...base, stage: "deliver", status: "succeeded", attempts: 1, durationMs: 86_400 + i * 1200, error: null };
    case "approved":
      return { ...base, stage: "deliver", status: "running", attempts: 1, durationMs: null, error: null };
    default:
      return { ...base, stage: "review", status: "waiting", attempts: 1, durationMs: 71_300 + i * 2100, error: null };
  }
});

export interface DemoAuditEntry {
  id: string;
  userId: string | null;
  action: string;
  target: string;
  at: string;
}

export const AUDIT: DemoAuditEntry[] = [
  { id: "aud_1", userId: "usr_tom", action: "approved the October report", target: "Marlowe Quay Solicitors", at: minutesAgo(34) },
  { id: "aud_2", userId: "usr_tom", action: "acknowledged a downtime alert", target: "Brightwater Heating", at: minutesAgo(96) },
  { id: "aud_3", userId: "usr_priya", action: "added notes to the October report", target: "Pennine Trail Outfitters", at: minutesAgo(60 * 3 + 12) },
  { id: "aud_4", userId: null, action: "sent the October report automatically", target: "Oakridge Bakehouse", at: minutesAgo(60 * 24 * 2 + 40) },
  { id: "aud_5", userId: "usr_tom", action: "submitted the October report for review", target: "Harlow & Finch Dental", at: minutesAgo(60 * 24 * 3) },
  { id: "aud_6", userId: null, action: "sent the October report automatically", target: "Kestrel Physiotherapy", at: minutesAgo(60 * 24 * 15 + 20) },
  { id: "aud_7", userId: "usr_amara", action: "updated the brand colours", target: "Northfold Studio", at: minutesAgo(60 * 24 * 21) },
  { id: "aud_8", userId: "usr_priya", action: "added a site", target: "Thornbury Interiors", at: minutesAgo(60 * 24 * 40) },
];

/** Monthly delivery record for the overview chart: reports sent on time per cycle. */
export const DELIVERY_HISTORY: Array<{ period: string; onTime: number; late: number; manualMinutes: number }> = [
  { period: "2026-05", onTime: 6, late: 1, manualMinutes: 14 },
  { period: "2026-06", onTime: 7, late: 0, manualMinutes: 12 },
  { period: "2026-07", onTime: 7, late: 0, manualMinutes: 11 },
  { period: "2026-08", onTime: 6, late: 1, manualMinutes: 13 },
  { period: "2026-09", onTime: 8, late: 0, manualMinutes: 9 },
  { period: "2026-10", onTime: 4, late: 0, manualMinutes: 10 },
];
