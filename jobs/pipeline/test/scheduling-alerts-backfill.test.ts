import { describe, expect, it, vi } from "vitest";
import { DEMO_NOW, DEMO_PERIOD, collectDemo } from "@reportpilot/demo";
import type { MonthSearch } from "@reportpilot/core";
import { runMonthly, runSite, assertPdfSize, MAX_PDF_BYTES, type RunDeps } from "../src/runner";
import { memoryStore, type PipelineSite } from "../src/store";
import { demoCollectors, demoSites } from "../src/demo";
import { collect, type SearchArchive } from "../src/stages/collect";
import { backfillSite, type BackfillTarget } from "../src/backfill";
import { memoryAlertStore, processSiteAlerts, reconcile } from "../src/alerts";
import { loadEnv } from "../src/config";
import { silentLogger } from "../src/log";

const PDF = new Uint8Array([37, 80, 68, 70]);
const site = (id: string, over: Partial<PipelineSite> = {}) => ({ ...demoSites().find((s) => s.id === id)!, ...over });

function deps(sites: PipelineSite[], over: Partial<RunDeps> = {}) {
  const mem = memoryStore(sites);
  const files: Record<string, Uint8Array> = {};
  const d: RunDeps = {
    store: mem.store,
    collectors: demoCollectors(DEMO_PERIOD),
    render: vi.fn(async () => PDF),
    files: { put: async (k, b) => { files[k] = b; return k; } },
    send: async () => ({ id: "re_123" }),
    log: silentLogger,
    appUrl: "https://app.test",
    now: () => DEMO_NOW,
    sleep: async () => {},
    ...over,
  };
  return { d, mem, files };
}

describe("plan step: per-client time zone and report day", () => {
  it("processes only the clients whose local 06:00 on their report day has passed", async () => {
    const sydney = site("site_harlow", { timezone: "Australia/Sydney", reportDay: 3 });
    const london = site("site_kestrel", { timezone: "Europe/London", reportDay: 3 });
    // 19:00 UTC on the 2nd = 06:00 on the 3rd in Sydney, still the 2nd in London.
    const { d } = deps([sydney, london], { now: () => new Date("2026-11-02T19:00:00Z") });
    const { results, summary } = await runMonthly(null, d);
    expect(results.map((r) => r.siteId)).toEqual(["site_harlow"]);
    expect(summary.notDue).toBe(1);
  });

  it("uses each client's own month when no period is given", async () => {
    const auckland = site("site_harlow", { timezone: "Pacific/Auckland", reportDay: 2 });
    const { d, mem } = deps([auckland], { now: () => new Date("2026-11-30T14:00:00Z") });
    await runMonthly(null, d, { force: true });
    expect([...mem.reports.keys()]).toEqual(["site_harlow:2026-11"]);
  });

  it("a manual run (force) ignores the schedule", async () => {
    const { d } = deps([site("site_harlow")], { now: () => new Date("2026-11-01T00:00:00Z") });
    const { results } = await runMonthly(DEMO_PERIOD, d, { force: true });
    expect(results).toHaveLength(1);
  });
});

describe("versions and delivery status", () => {
  it("records v1 at render and v2 for the copy that was sent, with the Resend id", async () => {
    const s = site("site_kestrel", { autoSend: true });
    const { d, mem, files } = deps([s]);
    const r = await runSite(s, DEMO_PERIOD, d);
    expect(r.status).toBe("sent");
    expect(mem.versions.map((v) => [v.version, v.reason])).toEqual([[1, "render"], [2, "sent"]]);
    const stored = [...mem.reports.values()][0]!;
    expect(stored).toMatchObject({ version: 2, deliveryId: "re_123", deliveryStatus: "queued" });
    expect(Object.keys(files).filter((k) => k.endsWith(".pdf"))).toEqual([
      `reports/${s.orgId}/${s.id}/${DEMO_PERIOD}/v1.pdf`,
      `reports/${s.orgId}/${s.id}/${DEMO_PERIOD}/v2.pdf`,
    ]);
    expect(mem.auditLog.at(-1)!.meta).toMatchObject({ deliveryId: "re_123", version: 2 });
  });

  it("a forced re-render after a reset makes a new version instead of overwriting", async () => {
    const s = site("site_harlow", { autoSend: false });
    const { d, mem } = deps([s]);
    await runSite(s, DEMO_PERIOD, d);
    const rep = [...mem.reports.values()][0]!;
    await mem.store.updateReport(rep.id, { stage: "narrative" });
    await runSite(s, DEMO_PERIOD, d);
    expect(mem.versions.map((v) => [v.version, v.reason])).toEqual([[1, "render"], [2, "rerender"]]);
  });

  it("refuses oversized and empty PDFs", () => {
    expect(() => assertPdfSize(new Uint8Array(MAX_PDF_BYTES + 1))).toThrow(/over the 8 MB limit/);
    expect(() => assertPdfSize(new Uint8Array(0))).toThrow(/empty/);
  });

  it("a dry run writes the HTML and plain-text email and records no delivery", async () => {
    const s = site("site_kestrel", { autoSend: true });
    const { d, mem, files } = deps([s], { dryRun: true });
    await runSite(s, DEMO_PERIOD, d);
    expect(Object.keys(files)).toEqual(expect.arrayContaining([`emails/${s.id}/${DEMO_PERIOD}.html`, `emails/${s.id}/${DEMO_PERIOD}.txt`]));
    expect([...mem.reports.values()][0]!.deliveryId).toBeNull();
  });
});

describe("collect reads earlier months from the archive", () => {
  it("only asks the API for months the backfill does not have, and archives what it fetched", async () => {
    const s = site("site_harlow");
    const demo = collectDemo("site_harlow", DEMO_PERIOD).search!;
    const asked: string[] = [];
    const base = demoCollectors(DEMO_PERIOD).gsc!;
    const gsc = { isMonthFinal: async () => true, month: async (p: string, period: string) => { asked.push(period); return base.month(p, period); } };
    const stored = new Map<string, MonthSearch>([[demo.previous!.period, demo.previous!], [demo.yearAgo!.period, demo.yearAgo!]]);
    const saved: string[] = [];
    const archive: SearchArchive = {
      load: async (_id, p) => stored.get(p) ?? null,
      save: async (_id, m) => { saved.push(m.period); },
    };
    const r = await collect(s, DEMO_PERIOD, { gsc: gsc as never, archive }, silentLogger);
    expect(r.data.search!.previous!.period).toBe("2026-09");
    expect(asked).not.toContain("2026-09");
    expect(asked).not.toContain("2025-10");
    expect(asked[0]).toBe(DEMO_PERIOD);
    expect(saved).toContain(DEMO_PERIOD);
    expect(r.data.search!.trailing).toHaveLength(13);
  });
});

describe("16-month backfill", () => {
  const month = (period: string, empty = false): MonthSearch => ({
    period, final: true, totals: { clicks: empty ? 0 : 10, impressions: empty ? 0 : 100, ctr: 0.1, position: 5 },
    daily: [], queries: empty ? [] : [{ query: "q", clicks: 10, impressions: 100, ctr: 0.1, position: 5 }], pages: [], devices: [], countries: [],
  });

  function target(have: string[] = []) {
    const saved: string[] = [];
    let done: Date | null = null;
    const t: BackfillTarget = {
      has: async (_s, p) => have.includes(p) || saved.includes(p),
      save: async (_s, m) => { saved.push(m.period); },
      markDone: async (_s, at) => { done = at; },
    };
    return { t, saved, done: () => done };
  }

  it("saves 16 final months, newest first, and marks the site done", async () => {
    const { t, saved, done } = target();
    const source = { isMonthFinal: async () => true, month: async (_p: string, period: string) => month(period) };
    await backfillSite({ id: "s", gscProperty: "p" }, { source, target: t, log: silentLogger, now: new Date("2026-11-19T00:00:00Z") });
    expect(saved).toHaveLength(16);
    expect(saved[0]).toBe("2026-10");
    expect(saved.at(-1)).toBe("2025-07");
    expect(done()).not.toBeNull();
  });

  it("starts a month earlier when last month is not final, skips months it has, and stops where the property began", async () => {
    const { t, saved } = target(["2026-08"]);
    const source = { isMonthFinal: async () => false, month: async (_p: string, period: string) => month(period, period < "2026-05") };
    const r = await backfillSite({ id: "s", gscProperty: "p" }, { source, target: t, log: silentLogger, now: new Date("2026-11-02T00:00:00Z") });
    expect(saved).toEqual(["2026-09", "2026-07", "2026-06", "2026-05"]);
    expect(r.skipped).toBe(1);
  });

  it("leaves the site owed when a month fails, so tomorrow retries the gap", async () => {
    const { t, done } = target();
    const source = { isMonthFinal: async () => true, month: async (_p: string, period: string) => { if (period === "2026-03") throw new Error("429"); return month(period); } };
    const r = await backfillSite({ id: "s", gscProperty: "p" }, { source, target: t, log: silentLogger, now: new Date("2026-11-19T00:00:00Z") });
    expect(r.failed).toEqual(["2026-03"]);
    expect(done()).toBeNull();
  });
});

describe("alerts between reports", () => {
  const now = new Date("2026-11-10T08:00:00Z");
  const quiet = { certExpiresAt: null, domainExpiresAt: null, dailyClicks: [], crux: [], index: [] };
  const siteRef = { id: "s1", clientName: "Harlow Dental", url: "https://harlow.test", notify: "maya@studio.test" };

  it("raises a new alert once, emails it once, and does not repeat it the next day", async () => {
    const { store, rows } = memoryAlertStore();
    const notify = vi.fn(async () => {});
    const snap = { ...quiet, certExpiresAt: "2026-11-20T00:00:00Z" };
    await processSiteAlerts(siteRef, snap, { store, notify, log: silentLogger, now });
    await processSiteAlerts(siteRef, snap, { store, notify, log: silentLogger, now: new Date("2026-11-11T08:00:00Z") });
    expect(rows).toHaveLength(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it("resolves the warning and raises a critical alert when the certificate crosses 7 days", async () => {
    const { store, rows } = memoryAlertStore();
    const notify = vi.fn(async () => {});
    await processSiteAlerts(siteRef, { ...quiet, certExpiresAt: "2026-11-25T00:00:00Z" }, { store, notify, log: silentLogger, now });
    await processSiteAlerts(siteRef, { ...quiet, certExpiresAt: "2026-11-25T00:00:00Z" }, { store, notify, log: silentLogger, now: new Date("2026-11-20T08:00:00Z") });
    expect(rows.map((r) => r.state)).toEqual(["resolved", "open"]);
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it("resolves an alert once its condition clears, e.g. the certificate renewed", async () => {
    const { store, rows } = memoryAlertStore();
    const notify = async () => {};
    await processSiteAlerts(siteRef, { ...quiet, certExpiresAt: "2026-11-20T00:00:00Z" }, { store, notify, log: silentLogger, now });
    await processSiteAlerts(siteRef, { ...quiet, certExpiresAt: "2027-02-20T00:00:00Z" }, { store, notify, log: silentLogger, now });
    expect(rows[0]!.state).toBe("resolved");
  });

  it("never auto-resolves downtime or bounce alerts it does not own", () => {
    const plan = reconcile([{ id: "a", kind: "downtime", dedupeKey: "incident:1" }, { id: "b", kind: "bounce", dedupeKey: "bounce:x" }], []);
    expect(plan.resolve).toEqual([]);
  });

  it("an email failure does not stop the alert being recorded", async () => {
    const { store, rows } = memoryAlertStore();
    await processSiteAlerts(siteRef, { ...quiet, domainExpiresAt: "2026-11-15T00:00:00Z" }, {
      store, notify: async () => { throw new Error("Resend: 500"); }, log: silentLogger, now,
    });
    expect(rows).toHaveLength(1);
  });
});

describe("environment validation", () => {
  it("accepts an empty environment for demo runs, with defaults", () => {
    expect(loadEnv({}).APP_URL).toBe("http://localhost:3000");
  });

  it("names every bad variable in one message", () => {
    expect(() => loadEnv({ DATABASE_URL: "not a url", RESEND_API_KEY: "sk_live", R2_BUCKET: "reports" })).toThrow(
      /DATABASE_URL[\s\S]*RESEND_API_KEY should start with re_[\s\S]*Set all four R2_\* variables/,
    );
  });

  it("treats empty strings from unset GitHub secrets as missing", () => {
    expect(loadEnv({ DATABASE_URL: "", SENTRY_DSN: "" }).DATABASE_URL).toBeUndefined();
  });
});
