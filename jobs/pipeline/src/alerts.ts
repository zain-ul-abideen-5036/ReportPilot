import { evaluateAlerts, type AlertCandidate, type AlertKind, type AlertSnapshot } from "@reportpilot/core";
import type { Logger } from "./log";

/**
 * Raising and resolving alerts. The rules live in core (pure, tested);
 * this file decides what changed since yesterday: which alerts are new
 * (insert and email once) and which conditions have cleared (resolve).
 */

/** Kinds this job owns. Downtime belongs to the uptime worker and bounces to the webhook. */
export const DAILY_KINDS: AlertKind[] = ["ssl", "domain", "traffic", "vitals", "indexing"];

export interface OpenAlert {
  id: string;
  kind: AlertKind;
  dedupeKey: string;
}

export interface AlertSite {
  id: string;
  clientName: string;
  url: string;
  /** The account manager's email, or null to use the agency fallback. */
  notify: string | null;
}

export interface AlertStore {
  open(siteId: string): Promise<OpenAlert[]>;
  /** Insert unless (site, dedupe key) exists. True when this call created it. */
  raise(siteId: string, alert: AlertCandidate): Promise<boolean>;
  resolve(ids: string[], at: Date): Promise<void>;
}

export type AlertNotifier = (site: AlertSite, alert: AlertCandidate) => Promise<void>;

export function reconcile(open: OpenAlert[], candidates: AlertCandidate[]) {
  const keys = new Set(candidates.map((c) => c.dedupeKey));
  const openKeys = new Set(open.map((o) => o.dedupeKey));
  return {
    raise: candidates.filter((c) => !openKeys.has(c.dedupeKey)),
    resolve: open.filter((o) => DAILY_KINDS.includes(o.kind) && !keys.has(o.dedupeKey)).map((o) => o.id),
  };
}

export async function processSiteAlerts(
  site: AlertSite,
  snapshot: AlertSnapshot,
  deps: { store: AlertStore; notify: AlertNotifier; log: Logger; now: Date },
) {
  const candidates = evaluateAlerts(snapshot, deps.now);
  const open = await deps.store.open(site.id);
  const plan = reconcile(open, candidates);
  let raised = 0;
  for (const alert of plan.raise) {
    // The unique index decides: if another run raised it first, we stay quiet.
    if (await deps.store.raise(site.id, alert)) {
      raised++;
      try {
        await deps.notify(site, alert);
      } catch (err) {
        deps.log.warn("alert email failed", { siteId: site.id, kind: alert.kind, error: (err as Error).message });
      }
    }
  }
  if (plan.resolve.length) await deps.store.resolve(plan.resolve, deps.now);
  return { raised, resolved: plan.resolve.length };
}

export function resendAlertNotifier(opts: { apiKey?: string; from: string; fallbackTo?: string; appUrl: string; fetcher?: typeof fetch }): AlertNotifier {
  const fetcher = opts.fetcher ?? fetch;
  return async (site, alert) => {
    const to = site.notify ?? opts.fallbackTo;
    if (!opts.apiKey || !to) return; // alert emails are off in this environment
    const label = alert.severity === "critical" ? "Action needed" : "Heads up";
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${opts.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: opts.from,
        to,
        subject: `${label}: ${site.clientName}, ${alert.title.charAt(0).toLowerCase()}${alert.title.slice(1)}`,
        text: `${alert.title}\n\n${site.url}\n\n${alert.detail}\n\nSee every open alert: ${opts.appUrl.replace(/\/$/, "")}/alerts`,
      }),
    });
    if (!res.ok) throw new Error(`Resend: ${res.status}`);
  };
}

export function memoryAlertStore() {
  const rows: Array<OpenAlert & { siteId: string; state: "open" | "resolved"; title: string }> = [];
  let seq = 0;
  const store: AlertStore = {
    async open(siteId) {
      return rows.filter((r) => r.siteId === siteId && r.state === "open").map(({ id, kind, dedupeKey }) => ({ id, kind, dedupeKey }));
    },
    async raise(siteId, a) {
      if (rows.some((r) => r.siteId === siteId && r.dedupeKey === a.dedupeKey)) return false;
      rows.push({ id: `al_${++seq}`, siteId, kind: a.kind, dedupeKey: a.dedupeKey, state: "open", title: a.title });
      return true;
    },
    async resolve(ids) {
      for (const r of rows) if (ids.includes(r.id)) r.state = "resolved";
    },
  };
  return { store, rows };
}
