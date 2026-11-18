import { describe, expect, it, vi } from "vitest";
import { DEMO_NOW, DEMO_PERIOD } from "@reportpilot/demo";
import { runMonthly, runSite, type RunDeps } from "../src/runner";
import { memoryStore, type PipelineSite } from "../src/store";
import { demoCollectors, demoSites } from "../src/demo";
import { writeNarrative } from "../src/stages/narrative";
import { composeEmail, type Sender } from "../src/stages/deliver";
import type { FileStore } from "../src/storage";
import { silentLogger } from "../src/log";
import { buildReport } from "@reportpilot/core";
import { collectDemo } from "@reportpilot/demo";

const PDF = new Uint8Array([37, 80, 68, 70]); // "%PDF"

function setup(over: Partial<RunDeps> = {}, sites: PipelineSite[] = demoSites()) {
  const mem = memoryStore(sites);
  const files: Record<string, Uint8Array> = {};
  const fileStore: FileStore = { put: async (k, b) => { files[k] = b; return k; } };
  const sent: string[] = [];
  const send: Sender = async (e) => { sent.push(e.to.join(",")); return { id: `em_${sent.length}` }; };
  const deps: RunDeps = {
    store: mem.store,
    collectors: demoCollectors(DEMO_PERIOD),
    render: vi.fn(async () => PDF),
    files: fileStore,
    send,
    log: silentLogger,
    appUrl: "https://app.test",
    now: () => DEMO_NOW,
    sleep: async () => {},
    ...over,
  };
  return { deps, mem, files, sent };
}

const site = (id: string, over: Partial<PipelineSite> = {}) => ({ ...demoSites().find((s) => s.id === id)!, ...over });

describe("monthly pipeline", () => {
  it("stops at draft for clients without auto-send", async () => {
    const { deps, sent } = setup({}, [site("site_harlow", { autoSend: false })]);
    const r = await runSite(site("site_harlow", { autoSend: false }), DEMO_PERIOD, deps);
    expect(r.status).toBe("draft");
    expect(sent).toHaveLength(0);
  });

  it("sends automatically when auto-send is on, and records it in the audit log", async () => {
    const s = site("site_kestrel", { autoSend: true });
    const { deps, sent, mem } = setup({}, [s]);
    const r = await runSite(s, DEMO_PERIOD, deps);
    expect(r.status).toBe("sent");
    expect(sent).toEqual(["imran@kestrelphysio.test"]);
    expect(mem.auditLog.map((a) => a.action)).toEqual(["report.auto_approved", "report.sent"]);
  });

  it("is idempotent: running twice creates one report and sends once", async () => {
    const s = site("site_kestrel", { autoSend: true });
    const { deps, sent, mem } = setup({}, [s]);
    await runMonthly(DEMO_PERIOD, deps);
    await runMonthly(DEMO_PERIOD, deps);
    expect(mem.reports.size).toBe(1);
    expect(sent).toHaveLength(1);
  });

  it("resumes from the failed stage instead of starting again", async () => {
    const s = site("site_harlow");
    const render = vi.fn<RunDeps["render"]>().mockRejectedValue(new Error("Chromium crashed"));
    const { deps, mem } = setup({ render, maxAttempts: 2 }, [s]);
    const first = await runSite(s, DEMO_PERIOD, deps);
    expect(first.status).toBe("failed");
    expect(first.stage).toBe("narrative");
    expect(render).toHaveBeenCalledTimes(2);
    const collectRuns = () => mem.runs.filter((r) => r.stage === "collect" && r.status === "succeeded").length;
    expect(collectRuns()).toBe(1);

    render.mockResolvedValue(PDF);
    const second = await runSite(s, DEMO_PERIOD, deps);
    expect(second.status).toBe("draft");
    expect(collectRuns()).toBe(1); // collect did not run again
  });

  it("delivers a report the manager approved in the dashboard on the next run", async () => {
    const s = site("site_marlowe", { autoSend: false });
    const { deps, mem, sent } = setup({}, [s]);
    await runSite(s, DEMO_PERIOD, deps);
    const report = [...mem.reports.values()][0]!;
    await mem.store.updateReport(report.id, { status: "approved" });
    const r = await runSite(s, DEMO_PERIOD, deps);
    expect(r.status).toBe("sent");
    expect(sent).toHaveLength(1);
  });

  it("writes emails to files instead of sending in a dry run", async () => {
    const s = site("site_kestrel", { autoSend: true });
    const { deps, files, sent } = setup({ dryRun: true }, [s]);
    await runSite(s, DEMO_PERIOD, deps);
    expect(sent).toHaveLength(0);
    expect(Object.keys(files)).toContain(`emails/site_kestrel/${DEMO_PERIOD}.html`);
  });

  it("produces a partial report when one source fails", async () => {
    const s = site("site_harlow");
    const collectors = { ...demoCollectors(DEMO_PERIOD), speedSnapshot: async () => { throw new Error("PageSpeed: 429 Quota exceeded"); } };
    const { deps, mem } = setup({ collectors }, [s]);
    const r = await runSite(s, DEMO_PERIOD, deps);
    expect(r.status).toBe("draft");
    expect(r.failures).toEqual(["PageSpeed: PageSpeed: 429 Quota exceeded"]);
    const report = [...mem.reports.values()][0]!;
    expect(report.data!.speed).toBeNull();
    expect(report.data!.search).not.toBeNull();
  });

  it("waits when Search Console has not finalised the month", async () => {
    const s = site("site_harlow");
    const base = demoCollectors(DEMO_PERIOD);
    const collectors = { ...base, gsc: { ...base.gsc!, isMonthFinal: async () => false } as typeof base.gsc };
    const { deps } = setup({ collectors }, [s]);
    const r = await runSite(s, DEMO_PERIOD, deps);
    expect(r.status).toBe("collecting");
  });

  it("pings the heartbeat at start and finish", async () => {
    const heartbeat = { start: vi.fn(async () => {}), success: vi.fn(async () => {}), fail: vi.fn(async () => {}) };
    const { deps } = setup({ heartbeat }, [site("site_harlow")]);
    await runMonthly(DEMO_PERIOD, deps);
    expect(heartbeat.start).toHaveBeenCalledOnce();
    expect(heartbeat.success).toHaveBeenCalledOnce();
  });
});

describe("narrative stage", () => {
  const report = buildReport(collectDemo("site_harlow"), DEMO_NOW);

  it("uses AI text that keeps every figure", async () => {
    const rewrite = async (prompt: string) => prompt.split("\n").slice(4).join(" ");
    const n = await writeNarrative(report, { aiEnabled: true, rewrite, log: silentLogger });
    expect(n.source).toBe("ai");
  });

  it("falls back to the template when the AI invents a number", async () => {
    const n = await writeNarrative(report, { aiEnabled: true, rewrite: async () => "Traffic grew a remarkable 37% this month, with 12,345 new visitors arriving from Google search results.", log: silentLogger });
    expect(n.source).toBe("template");
  });

  it("never calls the AI when it is off for the client", async () => {
    const rewrite = vi.fn(async () => "x");
    await writeNarrative(report, { aiEnabled: false, rewrite, log: silentLogger });
    expect(rewrite).not.toHaveBeenCalled();
  });

  it("does not send contact details to the AI", async () => {
    let prompt = "";
    await writeNarrative(report, { aiEnabled: true, rewrite: async (p) => { prompt = p; return null; }, log: silentLogger });
    expect(prompt).not.toMatch(/@/);
  });
});

describe("email", () => {
  it("includes a plain-text alternative, the PDF and the private link", () => {
    const s = site("site_harlow");
    const report = buildReport(collectDemo("site_harlow"), DEMO_NOW);
    const email = composeEmail(s, DEMO_PERIOD, { summary: "Summary.", highlights: ["One."], recommendations: [], source: "template" }, "https://app.test/r/abc", PDF, "rep_1");
    expect(report).toBeTruthy();
    expect(email.text).toContain("https://app.test/r/abc");
    expect(email.text.startsWith("Hi Ruth,")).toBe(true);
    expect(email.attachments[0]!.filename).toBe("Harlow & Finch Dental - October 2026.pdf");
    expect(email.from).toBe("Northfold Studio <reports@northfold.studio>");
    expect(email.html).not.toContain("<script");
  });
});
