import { describe, expect, it } from "vitest";
import { checkSite, type MonitoredSite, type CheckResult } from "../src/check";
import { runNightly, runTick } from "../src/monitor";
import { memoryNotifier } from "../src/notify";
import type { UptimeStore } from "../src/store";

const page = (body: string, status = 200) => new Response(body, { status });

function memoryStore(sites: MonitoredSite[]) {
  const checks: Array<{ siteId: string; result: CheckResult }> = [];
  const incidents: Array<{ id: string; siteId: string; resolvedAt: Date | null; cause: string }> = [];
  const store: UptimeStore = {
    async activeSites() { return sites; },
    async recordCheck(siteId, _at, result) { checks.push({ siteId, result }); },
    async openIncident(siteId, _at, cause) { const id = `inc${incidents.length + 1}`; incidents.push({ id, siteId, resolvedAt: null, cause }); return id; },
    async resolveIncident(id, at) { const i = incidents.find((x) => x.id === id); if (i) i.resolvedAt = at; },
    async markNotified() {},
    async rollupDay() { return sites.length; },
    async deleteChecksBefore() { return 42; },
  };
  return { store, checks, incidents };
}

const site = (over: Partial<MonitoredSite> = {}): MonitoredSite => ({
  id: "s1", url: "https://example.test/", keyword: "Harlow & Finch", state: "up", openIncidentId: null, clientName: "Harlow & Finch Dental", notify: "tom@example.test", ...over,
});

describe("checkSite", () => {
  it("is up when the status is fine and the keyword is present", async () => {
    const r = await checkSite(site(), async () => page("<h1>Harlow &amp; Finch</h1> Harlow & Finch Dental"));
    expect(r.ok).toBe(true);
  });

  it("is down when a 200 page lacks the expected text", async () => {
    const r = await checkSite(site(), async () => page("Error establishing a database connection"));
    expect(r).toMatchObject({ ok: false, status: 200, error: "Expected text not found on page" });
  });

  it("is down on 5xx", async () => {
    const r = await checkSite(site(), async () => page("", 503));
    expect(r).toMatchObject({ ok: false, status: 503 });
  });

  it("detects error pages when no keyword is configured", async () => {
    const r = await checkSite(site({ keyword: null }), async () => page("<title>502 Bad Gateway</title>"));
    expect(r.ok).toBe(false);
  });

  it("reports timeouts in plain words", async () => {
    const r = await checkSite(site(), async () => { const e = new Error("timeout"); e.name = "TimeoutError"; throw e; });
    expect(r.error).toBe("Connection timed out after 10 s");
  });
});

describe("two-failure rule", () => {
  const noSleep = async () => {};

  it("does not open an incident when the re-check succeeds", async () => {
    const { store, incidents } = memoryStore([site()]);
    const { notifier, sent } = memoryNotifier();
    const responses = [page("", 503), page("Harlow & Finch")];
    await runTick({ store, notifier, sleep: noSleep, fetcher: async () => responses.shift()! });
    expect(incidents).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it("opens an incident and alerts once both checks fail", async () => {
    const { store, incidents } = memoryStore([site()]);
    const { notifier, sent } = memoryNotifier();
    const outcomes = await runTick({ store, notifier, sleep: noSleep, fetcher: async () => page("", 503) });
    expect(outcomes[0]!.transition).toBe("opened");
    expect(incidents).toEqual([expect.objectContaining({ siteId: "s1", cause: "HTTP 503" })]);
    expect(sent).toEqual([{ kind: "down", siteId: "s1", cause: "HTTP 503" }]);
  });

  it("resolves the open incident when the site recovers", async () => {
    const { store, incidents } = memoryStore([site({ state: "down", openIncidentId: "inc1" })]);
    incidents.push({ id: "inc1", siteId: "s1", resolvedAt: null, cause: "HTTP 503" });
    const { notifier, sent } = memoryNotifier();
    const outcomes = await runTick({ store, notifier, sleep: noSleep, fetcher: async () => page("Harlow & Finch") });
    expect(outcomes[0]!.transition).toBe("resolved");
    expect(incidents[0]!.resolvedAt).toBeInstanceOf(Date);
    expect(sent).toEqual([{ kind: "up", siteId: "s1" }]);
  });

  it("does not alert again while a site stays down", async () => {
    const { store } = memoryStore([site({ state: "down", openIncidentId: "inc1" })]);
    const { notifier, sent } = memoryNotifier();
    await runTick({ store, notifier, sleep: noSleep, fetcher: async () => page("", 503) });
    expect(sent).toHaveLength(0);
  });

  it("records one check per site per tick", async () => {
    const { store, checks } = memoryStore([site({ id: "a" }), site({ id: "b" })]);
    await runTick({ store, notifier: memoryNotifier().notifier, sleep: noSleep, fetcher: async () => page("Harlow & Finch") });
    expect(checks.map((c) => c.siteId)).toEqual(["a", "b"]);
  });
});

describe("nightly rollup", () => {
  it("rolls up yesterday and applies retention", async () => {
    const { store } = memoryStore([site()]);
    expect(await runNightly(store, new Date("2026-11-19T00:10:00Z"))).toEqual({ day: "2026-11-18", rolled: 1, deleted: 42 });
  });
});
