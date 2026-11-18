import { nextMonitorState } from "@reportpilot/core";
import { checkSite, type CheckResult, type Fetcher, type MonitoredSite } from "./check";
import type { UptimeStore } from "./store";
import type { Notifier } from "./notify";

export interface MonitorDeps {
  store: UptimeStore;
  notifier: Notifier;
  fetcher?: Fetcher;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
  recheckDelayMs?: number;
  concurrency?: number;
}

export interface SiteOutcome {
  siteId: string;
  result: CheckResult;
  transition: "opened" | "resolved" | null;
}

/**
 * One five-minute tick. For each site: check; on failure wait 30 seconds
 * and check again; only two consecutive failures open an incident. This
 * is the rule that keeps false alarms out of account managers' inboxes.
 */
export async function runTick(deps: MonitorDeps): Promise<SiteOutcome[]> {
  const sites = await deps.store.activeSites();
  const limit = deps.concurrency ?? 6;
  const outcomes: SiteOutcome[] = [];
  for (let i = 0; i < sites.length; i += limit) {
    const batch = sites.slice(i, i + limit);
    outcomes.push(...(await Promise.all(batch.map((s) => checkOne(s, deps)))));
  }
  return outcomes;
}

export async function checkOne(site: MonitoredSite, deps: MonitorDeps): Promise<SiteOutcome> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const first = await checkSite(site, deps.fetcher);
  let result = first;
  let recheckOk: boolean | null = null;

  if (!first.ok) {
    await sleep(deps.recheckDelayMs ?? 30_000);
    result = await checkSite(site, deps.fetcher);
    recheckOk = result.ok;
  }

  const at = now();
  await deps.store.recordCheck(site.id, at, result);
  const next = nextMonitorState(site.state, first.ok, recheckOk);

  if (site.state === "up" && next === "down") {
    const cause = result.error ?? first.error ?? "Unknown failure";
    const incidentId = await deps.store.openIncident(site.id, at, cause);
    await deps.notifier.down(site, cause, at).then(() => deps.store.markNotified(incidentId, now())).catch(() => undefined);
    return { siteId: site.id, result, transition: "opened" };
  }

  if (site.state === "down" && next === "up" && site.openIncidentId) {
    await deps.store.resolveIncident(site.openIncidentId, at);
    await deps.notifier.up(site, at).catch(() => undefined);
    return { siteId: site.id, result, transition: "resolved" };
  }

  return { siteId: site.id, result, transition: null };
}

/** Nightly: roll yesterday's checks into uptime_daily and apply 90-day retention. */
export async function runNightly(store: UptimeStore, now: Date = new Date(), retentionDays = 90) {
  const yesterday = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const rolled = await store.rollupDay(yesterday);
  const deleted = await store.deleteChecksBefore(new Date(now.getTime() - retentionDays * 86_400_000));
  return { day: yesterday, rolled, deleted };
}

