import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import {
  buildReport, reportingPeriodFor, templateNarrative, type Narrative, type ReportData, type ReportStatus,
} from "@reportpilot/core";
import {
  ALERTS, AUDIT, CLIENTS, DELIVERY_HISTORY, DEMO_NOW, DEMO_PERIOD, JOB_RUNS, ORG, SITES, USERS, collectDemo, collectOnboarded, onboardedSite,
  type AlertKind, type AlertState, type Stage,
} from "@reportpilot/demo";
import { requireSession } from "./auth/server";
import type { Role, Session } from "./auth/session";
import { readDemoState, type DemoState } from "./demo-state";

/**
 * Everything a dashboard page reads, for the signed-in user's agency.
 * Two sources with one shape:
 *   demo      the bundled sample agency, plus this visitor's own changes
 *   database  Postgres, scoped to the user's organisation
 * Pages call getWorkspace() and never know which one they are talking to.
 */

export interface OrgView {
  id: string;
  name: string;
  initials: string;
  primary: string;
  accent: string;
  senderName: string;
  senderEmail: string;
  footer: string;
  logoUrl: string | null;
}

export interface SiteRow {
  reportId: string;
  site: { id: string; url: string; keyPages: string[]; gscProperty: string | null; brandedRegex: string | null; uptimeKeyword: string | null };
  client: {
    id: string; name: string; initials: string; sector: string; since: string; contact: { name: string; email: string; bounced?: boolean };
    autoSend: boolean; aiEnabled: boolean; timezone: string; reportDay: number; logoUrl: string | null;
  };
  manager: { name: string; initials: string };
  report: ReportData;
  narrative: Narrative;
  status: ReportStatus;
  notes: string;
  version: number;
  shareToken: string | null;
  shareExpiresAt: string | null;
  generatedAt: string;
  sentAt: string | null;
  deliveryStatus: "queued" | "delivered" | "bounced" | "complained" | null;
  openAlerts: AlertRow[];
}

export interface AlertRow {
  id: string;
  siteId: string;
  kind: AlertKind | "bounce";
  severity: "critical" | "warning";
  state: AlertState;
  title: string;
  detail: string;
  raisedAt: string;
  resolvedAt: string | null;
  clientName: string;
  clientInitials: string;
}

export interface RunRow {
  id: string;
  siteId: string;
  period: string;
  stage: Stage;
  status: "succeeded" | "running" | "failed" | "waiting";
  attempts: number;
  durationMs: number | null;
  error: string | null;
  startedAt: string;
  clientName: string;
  clientInitials: string;
}

export interface AuditRow {
  id: string;
  user: { name: string; initials: string } | null;
  action: string;
  target: string;
  at: string;
}

export interface OutboxRow {
  siteId: string;
  to: string;
  subject: string;
  at: string;
}

export interface Workspace {
  mode: "demo" | "database";
  user: { id: string; name: string; initials: string; email: string; role: Role };
  org: OrgView;
  period: string;
  now: Date;
  sites: SiteRow[];
  alerts: AlertRow[];
  runs: RunRow[];
  audit: AuditRow[];
  outbox: OutboxRow[];
  deliveryHistory: typeof DELIVERY_HISTORY;
}

export const initialsOf = (name: string) =>
  name.replace(/&/g, " ").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w) && !/^(and|of|the)$/i.test(w)).map((w) => w[0]!.toUpperCase()).join("").slice(0, 2) || "?";

export const STATUS_ORDER: ReportStatus[] = ["collecting", "draft", "in_review", "approved", "sent", "failed"];

export function statusCounts(ws: Workspace) {
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0])) as Record<ReportStatus, number>;
  for (const r of ws.sites) counts[r.status]++;
  return counts;
}

export function findSite(ws: Workspace, siteId: string): SiteRow {
  const row = ws.sites.find((r) => r.site.id === siteId);
  if (!row) notFound();
  return row;
}

export function findClient(ws: Workspace, clientId: string) {
  const sites = ws.sites.filter((r) => r.client.id === clientId);
  if (sites.length === 0) notFound();
  return { client: sites[0]!.client, sites };
}

/** One workspace per request; React's cache() shares it between the layout and the page. */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const session = await requireSession();
  return session.demo ? demoWorkspace(session, await readDemoState()) : databaseWorkspace(session);
});

/* Demo ------------------------------------------------------------------- */

const SAMPLE_NOTES: Record<string, string> = {
  site_harlow: "October was about the implants page. We rewrote it in September and it is now the second-biggest source of new patient enquiries.\n\nIn November we will tackle the titles on the treatment pages, which Google shows often but which few people click.",
  site_pennine: "The drop in clicks lines up with Google's core update in the second week of October, which hit category pages across outdoor retail. Competitors saw the same pattern. We are reviewing the walking boots collection first.",
};

/** Report data never changes for the bundled sites, so it is built once per process. */
const demoReports = new Map<string, ReportData>();
function demoReport(siteId: string, build: () => ReportData) {
  let r = demoReports.get(siteId);
  if (!r) {
    r = build();
    demoReports.set(siteId, r);
  }
  return r;
}

/** Demo share tokens are derived, so links stay stable between visits; production uses crypto.randomBytes(16). */
export function demoShareToken(siteId: string, salt = ""): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (const ch of `${siteId}:${DEMO_PERIOD}:${salt}`) {
    h1 = Math.imul(h1 ^ ch.charCodeAt(0), 16777619) >>> 0;
    h2 = Math.imul(h2 ^ ch.charCodeAt(0), 2246822519) >>> 0;
  }
  const hex = (n: number) => n.toString(16).padStart(8, "0");
  return `${hex(h1)}${hex(h2)}${hex(h1 ^ 0x5bd1e995)}${hex((h2 + 0x9e3779b9) >>> 0)}`;
}

function demoWorkspace(session: Session, state: DemoState): Workspace {
  const user = USERS.find((u) => u.id === session.uid) ?? USERS[1]!;
  const brand = state.brand;
  const org: OrgView = {
    id: ORG.id, name: brand?.name ?? ORG.name, initials: initialsOf(brand?.name ?? ORG.name), primary: brand?.primary ?? ORG.primary,
    accent: brand?.accent ?? ORG.accent, senderName: brand?.senderName ?? ORG.senderName, senderEmail: brand?.senderEmail ?? ORG.senderEmail,
    footer: brand?.footer ?? ORG.footer, logoUrl: null,
  };
  const generatedAt = new Date(DEMO_NOW.getTime() - 16 * 86_400_000).toISOString();
  const alerts: AlertRow[] = ALERTS.map((a) => {
    const c = CLIENTS.find((x) => x.id === SITES.find((s) => s.id === a.siteId)!.clientId)!;
    return { ...a, state: state.alerts[a.id] ?? a.state, clientName: c.name, clientInitials: c.initials };
  });

  const bundled: SiteRow[] = SITES.map((site) => {
    const c = CLIENTS.find((x) => x.id === site.clientId)!;
    const patch = state.reports[site.id] ?? {};
    const flags = state.clients[c.id] ?? {};
    const manager = USERS.find((u) => u.id === c.manager)!;
    const report = demoReport(site.id, () => buildReport(collectDemo(site.id, DEMO_PERIOD), DEMO_NOW));
    const status = patch.s ?? c.reportStatus;
    return {
      reportId: `rep_${site.id}`,
      site: { id: site.id, url: site.url, keyPages: site.keyPages, gscProperty: site.gscProperty, brandedRegex: site.brandedRegex, uptimeKeyword: site.uptimeKeyword },
      client: {
        id: c.id, name: c.name, initials: c.initials, sector: c.sector, since: c.since, contact: c.contact,
        autoSend: flags.auto ?? c.autoSend, aiEnabled: flags.ai ?? c.aiEnabled, timezone: c.timezone, reportDay: c.reportDay, logoUrl: null,
      },
      manager: { name: manager.name, initials: manager.initials },
      report,
      narrative: templateNarrative(report),
      status,
      notes: patch.n ?? SAMPLE_NOTES[site.id] ?? "",
      version: patch.v ?? (c.reportStatus === "sent" ? 2 : 1),
      shareToken: patch.rev ? null : (patch.tok ?? demoShareToken(site.id)),
      shareExpiresAt: patch.rev ? null : new Date(DEMO_NOW.getTime() + 74 * 86_400_000).toISOString(),
      generatedAt,
      sentAt: patch.sentAt ?? (c.reportStatus === "sent" ? new Date(DEMO_NOW.getTime() - 15 * 86_400_000).toISOString() : null),
      deliveryStatus: status === "sent" ? "delivered" : null,
      openAlerts: alerts.filter((a) => a.siteId === site.id && a.state !== "resolved"),
    };
  });

  const added: SiteRow[] = state.added.map((a) => {
    const siteId = `site_${a.id.slice(4)}`;
    const site = onboardedSite({ id: siteId, clientId: a.id, name: a.name, url: a.url, keyPages: a.pages, brandedRegex: a.branded, uptimeKeyword: a.keyword });
    const report = demoReport(`${siteId}:${a.url}`, () => buildReport(collectOnboarded(site, DEMO_PERIOD), DEMO_NOW));
    const patch = state.reports[siteId] ?? {};
    return {
      reportId: `rep_${siteId}`,
      site: { id: siteId, url: site.url, keyPages: site.keyPages, gscProperty: site.gscProperty, brandedRegex: site.brandedRegex, uptimeKeyword: site.uptimeKeyword },
      client: {
        id: a.id, name: a.name, initials: initialsOf(a.name), sector: "New client", since: DEMO_PERIOD, contact: a.contact,
        autoSend: state.clients[a.id]?.auto ?? false, aiEnabled: state.clients[a.id]?.ai ?? true, timezone: a.tz, reportDay: a.day, logoUrl: null,
      },
      manager: { name: user.name, initials: user.initials },
      report,
      narrative: templateNarrative(report),
      status: patch.s ?? "draft",
      notes: patch.n ?? "",
      version: patch.v ?? 1,
      shareToken: patch.rev ? null : (patch.tok ?? demoShareToken(siteId)),
      shareExpiresAt: patch.rev ? null : new Date(DEMO_NOW.getTime() + 90 * 86_400_000).toISOString(),
      generatedAt: a.at,
      sentAt: patch.sentAt ?? null,
      deliveryStatus: patch.s === "sent" ? "delivered" : null,
      openAlerts: [],
    };
  });

  const sites = [...added, ...bundled];
  const nameOf = (siteId: string) => sites.find((s) => s.site.id === siteId)?.client;
  const userView = (id: string | null) => {
    const u = USERS.find((x) => x.id === id);
    return u ? { name: u.name, initials: u.initials } : null;
  };

  return {
    mode: "demo",
    user: { id: user.id, name: user.name, initials: user.initials, email: user.email, role: session.role },
    org,
    period: DEMO_PERIOD,
    now: DEMO_NOW,
    sites,
    alerts,
    runs: JOB_RUNS.map((r) => ({ ...r, clientName: nameOf(r.siteId)!.name, clientInitials: nameOf(r.siteId)!.initials })),
    audit: [
      ...state.audit.map((e, i) => ({ id: `mine_${i}`, user: userView(e.u), action: e.a, target: e.t, at: e.at })),
      ...AUDIT.map((e) => ({ id: e.id, user: userView(e.userId), action: e.action, target: e.target, at: e.at })),
    ],
    outbox: state.outbox,
    deliveryHistory: DELIVERY_HISTORY,
  };
}

/* Database --------------------------------------------------------------- */

const ACTION_TEXT: Record<string, string> = {
  "report.submit": "submitted the {period} report for review",
  "report.approve": "approved the {period} report",
  "report.approve_partial": "approved the {period} report without speed data",
  "report.withdraw": "withdrew approval of the {period} report",
  "report.sent": "sent the {period} report",
  "report.auto_approved": "approved the {period} report automatically",
  "report.notes_edited": "added notes to the {period} report",
  "report.link_revoked": "revoked the client link",
  "report.link_reissued": "issued a new client link",
  "report.rerendered": "re-rendered the {period} report",
  "email.captured": "captured the {period} email in test mode",
  "email.bounced": "had a report email bounce",
  "email.delivered": "had the report email delivered",
  "client.created": "added a client",
  "client.auto_send": "changed auto-send",
  "client.ai": "changed AI wording",
  "alert.acknowledged": "acknowledged an alert",
  "alert.resolved": "resolved an alert",
  "org.brand_updated": "updated the brand",
  "user.signed_in": "signed in",
};

async function databaseWorkspace(session: Session): Promise<Workspace> {
  const { db, repo } = await database();
  const [org, records, alertRecords, runRecords, auditRecords] = await Promise.all([
    repo.getOrg(db, session.org),
    repo.listSiteRecords(db, session.org),
    repo.listAlertRecords(db, session.org),
    repo.listRunRecords(db, session.org),
    repo.listAuditRecords(db, session.org, 60),
  ]);
  const now = new Date();
  const fallbackPeriod = reportingPeriodFor(now);

  const alerts: AlertRow[] = alertRecords.map(({ alert, clientName }) => ({
    id: alert.id, siteId: alert.siteId, kind: alert.kind, severity: alert.severity, state: alert.state, title: alert.title, detail: alert.detail,
    raisedAt: alert.raisedAt.toISOString(), resolvedAt: alert.resolvedAt?.toISOString() ?? null, clientName, clientInitials: initialsOf(clientName),
  }));

  const sites: SiteRow[] = records.map(({ site, client, manager, report }) => {
    const data = report?.data ?? buildReport({ period: report?.period ?? fallbackPeriod, site: { url: site.url, brandedPattern: site.brandedRegex }, search: null, speed: null, uptime: null, indexing: null }, now);
    const contact = client.contacts[0] ?? { name: "No contact yet", email: "" };
    return {
      reportId: report?.id ?? "",
      site: { id: site.id, url: site.url, keyPages: site.keyPages, gscProperty: site.gscProperty, brandedRegex: site.brandedRegex, uptimeKeyword: site.uptimeKeyword },
      client: {
        id: client.id, name: client.name, initials: initialsOf(client.name), sector: "", since: client.createdAt.toISOString().slice(0, 7),
        contact: { name: contact.name, email: contact.email, bounced: Boolean(contact.bouncedAt) },
        autoSend: client.autoSend, aiEnabled: client.aiEnabled, timezone: client.timezone, reportDay: client.reportDay,
        logoUrl: client.logoKey?.startsWith("data:") ? client.logoKey : client.logoKey ? `/api/logo?key=${encodeURIComponent(client.logoKey)}` : null,
      },
      manager: { name: manager?.name ?? org.senderName, initials: initialsOf(manager?.name ?? org.senderName) },
      report: data,
      narrative: report?.narrative ?? templateNarrative(data),
      status: report?.status ?? "collecting",
      notes: report?.managerNotes ?? "",
      version: report?.version ?? 1,
      shareToken: report?.shareToken ?? null,
      shareExpiresAt: report?.shareExpiresAt?.toISOString() ?? null,
      generatedAt: (report?.updatedAt ?? now).toISOString(),
      sentAt: report?.sentAt?.toISOString() ?? null,
      deliveryStatus: report?.deliveryStatus ?? null,
      openAlerts: alerts.filter((a) => a.siteId === site.id && a.state !== "resolved"),
    };
  });

  const byReport = new Map(sites.map((s) => [s.reportId, s]));
  const byClient = new Map(sites.map((s) => [s.client.id, s]));
  const me = auditRecords.find((a) => a.user?.id === session.uid)?.user;

  return {
    mode: "database",
    user: { id: session.uid, name: session.name, initials: initialsOf(session.name), email: session.email ?? me?.email ?? "", role: session.role },
    org: {
      id: org.id, name: org.name, initials: initialsOf(org.name), primary: org.brandPrimary, accent: org.brandAccent, senderName: org.senderName,
      senderEmail: org.senderEmail, footer: org.footer,
      logoUrl: org.brandLogoKey?.startsWith("data:") ? org.brandLogoKey : org.brandLogoKey ? `/api/logo?key=${encodeURIComponent(org.brandLogoKey)}` : null,
    },
    period: sites.map((s) => s.report.period).sort().at(-1) ?? fallbackPeriod,
    now,
    sites,
    alerts,
    runs: runRecords.map(({ run, clientName, siteId }) => ({
      id: run.id, siteId, period: run.period ?? "", stage: run.stage, status: run.status, attempts: run.attempts, error: run.error,
      startedAt: run.startedAt.toISOString(), durationMs: run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
      clientName, clientInitials: initialsOf(clientName),
    })),
    audit: auditRecords.map(({ entry, user }) => {
      const row = entry.entityId ? byReport.get(entry.entityId) ?? byClient.get(entry.entityId) : undefined;
      const text = (ACTION_TEXT[entry.action] ?? entry.action).replace("{period}", row ? new Date(`${row.report.period}-01`).toLocaleString("en-GB", { month: "long" }) : "");
      return {
        id: entry.id, user: user ? { name: user.name, initials: initialsOf(user.name) } : null, action: text,
        target: row?.client.name ?? (entry.entity === "organization" ? org.name : ""), at: entry.at.toISOString(),
      };
    }),
    outbox: auditRecords.filter((a) => a.entry.action === "email.captured").map(({ entry }) => ({
      siteId: byReport.get(entry.entityId ?? "")?.site.id ?? "", to: String(entry.meta.to ?? ""), subject: String(entry.meta.subject ?? ""), at: entry.at.toISOString(),
    })),
    deliveryHistory: [],
  };
}

/** One connection pool per server instance. Imported lazily so the demo never loads a Postgres driver. */
export async function database() {
  const g = globalThis as unknown as { __rpDb?: { db: import("@reportpilot/db/repo").AnyDb; repo: typeof import("@reportpilot/db/repo") } };
  if (!g.__rpDb) {
    const [{ createDb }, repo] = await Promise.all([import("@reportpilot/db"), import("@reportpilot/db/repo")]);
    g.__rpDb = { db: createDb(process.env.DATABASE_URL, { max: Number(process.env.DATABASE_POOL_MAX ?? 5) }) as unknown as import("@reportpilot/db/repo").AnyDb, repo };
  }
  return g.__rpDb;
}

const SAMPLE_SESSION: Session = { uid: "usr_tom", org: ORG.id, role: "viewer", name: "", email: "", demo: true, exp: 0 };
const EMPTY_STATE: DemoState = { v: 1, reports: {}, clients: {}, alerts: {}, added: [], outbox: [], audit: [] };

/** The bundled sample agency with nobody's changes applied: the landing page's preview. */
export function sampleSite(siteId: string) {
  const ws = demoWorkspace(SAMPLE_SESSION, EMPTY_STATE);
  return { row: ws.sites.find((r) => r.site.id === siteId)!, org: ws.org, now: ws.now };
}

/** The client's web link. Public: looks the token up without a session. */
export async function sharedReport(token: string) {
  if (!process.env.DATABASE_URL) {
    const ws = demoWorkspace(SAMPLE_SESSION, await readDemoState());
    const row = ws.sites.find((r) => r.shareToken === token);
    return row ? { row, org: ws.org } : null;
  }
  const { db, repo } = await database();
  const hit = await repo.reportByShareToken(db, token);
  if (!hit?.report.data) {
    // The landing page's "read a sample report" link points at the fictional sample, on every deployment.
    const sample = demoWorkspace(SAMPLE_SESSION, EMPTY_STATE).sites.find((r) => r.shareToken === token);
    return sample ? { row: sample, org: demoWorkspace(SAMPLE_SESSION, EMPTY_STATE).org } : null;
  }
  const session: Session = { uid: "", org: hit.org.id, role: "viewer", name: "", email: "", demo: false, exp: 0 };
  const ws = await databaseWorkspace(session);
  const row = ws.sites.find((r) => r.reportId === hit.report.id);
  return row ? { row, org: ws.org } : null;
}

/** For the print page and PDF route, which may run without a user (signed print URL). */
export async function siteForPrint(siteId: string) {
  if (!process.env.DATABASE_URL) {
    const ws = demoWorkspace(SAMPLE_SESSION, await readDemoState());
    const row = ws.sites.find((r) => r.site.id === siteId);
    return row ? { row, org: ws.org } : null;
  }
  const { db } = await database();
  const { tables } = await import("@reportpilot/db");
  const { eq } = await import("drizzle-orm");
  const [hit] = await db.select({ orgId: tables.clients.orgId }).from(tables.sites).innerJoin(tables.clients, eq(tables.clients.id, tables.sites.clientId)).where(eq(tables.sites.id, siteId));
  if (!hit) return null;
  const ws = await databaseWorkspace({ uid: "", org: hit.orgId, role: "viewer", name: "", email: "", demo: false, exp: 0 });
  const row = ws.sites.find((r) => r.site.id === siteId);
  return row ? { row, org: ws.org } : null;
}
