import "server-only";
import { cache } from "react";
import { buildReport, templateNarrative, type Narrative, type ReportData } from "@reportpilot/core";
import {
  ALERTS, AUDIT, CLIENTS, DELIVERY_HISTORY, DEMO_NOW, DEMO_PERIOD, JOB_RUNS, ORG, SITES, USERS, collectDemo,
  type DemoAlert, type DemoClient, type DemoSite, type ReportStatus,
} from "@reportpilot/demo";

/**
 * Data access for the dashboard. In demo mode (no DATABASE_URL) this reads
 * the seeded demo agency; the shapes match what the database layer returns,
 * so pages do not know which one they are talking to.
 */

export const period = DEMO_PERIOD;
export const now = DEMO_NOW;
export const org = ORG;
export const users = USERS;

export interface SiteRow {
  site: DemoSite;
  client: DemoClient;
  report: ReportData;
  narrative: Narrative;
  status: ReportStatus;
  manager: (typeof USERS)[number];
  openAlerts: DemoAlert[];
}

export const getReport = cache((siteId: string): ReportData => buildReport(collectDemo(siteId, period), now));

export const listSites = cache((): SiteRow[] =>
  SITES.map((site) => {
    const client = CLIENTS.find((c) => c.id === site.clientId)!;
    const report = getReport(site.id);
    return {
      site,
      client,
      report,
      narrative: templateNarrative(report),
      status: client.reportStatus,
      manager: USERS.find((u) => u.id === client.manager)!,
      openAlerts: ALERTS.filter((a) => a.siteId === site.id && a.state !== "resolved"),
    };
  }),
);

export function getSite(siteId: string): SiteRow | undefined {
  return listSites().find((r) => r.site.id === siteId);
}

export function getClient(clientId: string) {
  const client = CLIENTS.find((c) => c.id === clientId);
  if (!client) return undefined;
  return { client, sites: listSites().filter((r) => r.client.id === clientId) };
}

export function listAlerts() {
  return ALERTS.map((a) => ({ ...a, row: getSite(a.siteId)! }));
}

export function listRuns() {
  return JOB_RUNS.map((r) => ({ ...r, row: getSite(r.siteId)! }));
}

export function listAudit() {
  return AUDIT.map((a) => ({ ...a, user: USERS.find((u) => u.id === a.userId) ?? null }));
}

export const deliveryHistory = DELIVERY_HISTORY;

/** The signed-in user. Demo mode signs everyone in as the account manager. */
export const currentUser = USERS[1]!;

export const STATUS_ORDER: ReportStatus[] = ["collecting", "draft", "in_review", "approved", "sent", "failed"];

export function statusCounts() {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<ReportStatus, number>;
  for (const r of listSites()) counts[r.status]++;
  return counts;
}

/** Map a share token back to a site. Real tokens are random 128-bit values in the reports table. */
export function siteForToken(token: string): SiteRow | undefined {
  return listSites().find((r) => shareToken(r.site.id) === token);
}

export function shareToken(siteId: string): string {
  // Demo tokens are derived so links are stable; production uses crypto.randomBytes(16).
  let h = 0x811c9dc5;
  for (const ch of `${siteId}:${period}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return `${h.toString(36)}${(h ^ 0x5bd1e995).toString(36)}${siteId.length.toString(36)}k7`;
}
