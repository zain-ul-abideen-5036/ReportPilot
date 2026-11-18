import { randomBytes } from "node:crypto";
import { buildReport } from "@reportpilot/core";
import type { Stage } from "@reportpilot/demo";
import type { ReportInput } from "@reportpilot/report";
import { collect, type Collectors } from "./stages/collect";
import { writeNarrative, type Rewriter } from "./stages/narrative";
import { composeEmail, type Sender } from "./stages/deliver";
import { pdfKey, type FileStore } from "./storage";
import type { Heartbeat } from "./heartbeat";
import type { Logger } from "./log";
import type { PipelineSite, PipelineStore, StoredReport } from "./store";

/**
 * The monthly pipeline. Each stage saves its output before the next one
 * starts, so a run that dies at "render" picks up at "render" next time.
 * Keyed on (site, period): running it twice never creates a second report
 * and never sends twice.
 */

export const ORDER: Stage[] = ["plan", "collect", "calculate", "insights", "narrative", "render", "review", "deliver"];

export interface RunDeps {
  store: PipelineStore;
  collectors: Collectors;
  render: (input: ReportInput) => Promise<Uint8Array>;
  files: FileStore;
  send?: Sender;
  rewrite?: Rewriter;
  heartbeat?: Heartbeat;
  log: Logger;
  appUrl: string;
  dryRun?: boolean;
  now?: () => Date;
  maxAttempts?: number;
  sleep?: (ms: number) => Promise<void>;
}

export interface SiteResult {
  siteId: string;
  status: StoredReport["status"];
  stage: Stage | null;
  failures: string[];
}

const done = (report: StoredReport, stage: Stage) => report.stage !== null && ORDER.indexOf(report.stage) >= ORDER.indexOf(stage);

async function withRetry<T>(stage: Stage, site: PipelineSite, period: string, deps: RunDeps, fn: () => Promise<T>): Promise<T> {
  const max = deps.maxAttempts ?? 3;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 1; ; attempt++) {
    await deps.store.recordRun({ siteId: site.id, period, stage, status: "running", attempts: attempt });
    try {
      const value = await fn();
      await deps.store.recordRun({ siteId: site.id, period, stage, status: "succeeded", attempts: attempt });
      return value;
    } catch (err) {
      const error = (err as Error).message;
      await deps.store.recordRun({ siteId: site.id, period, stage, status: "failed", attempts: attempt, error });
      if (attempt >= max) throw Object.assign(new Error(error), { stage });
      await sleep(1000 * 2 ** (attempt - 1));
    }
  }
}

export async function runSite(site: PipelineSite, period: string, deps: RunDeps): Promise<SiteResult> {
  const log = deps.log.child({ siteId: site.id, period });
  const now = deps.now ?? (() => new Date());
  let report = await deps.store.ensureReport(site.id, period);
  const failures: string[] = [];

  if (report.status === "sent") {
    log.info("already sent; skipping");
    return { siteId: site.id, status: report.status, stage: report.stage, failures };
  }

  try {
    if (!done(report, "collect")) {
      const result = await withRetry("collect", site, period, deps, () => collect(site, period, deps.collectors, log));
      failures.push(...result.failures.map((f) => `${f.source}: ${f.error}`));
      if (result.notFinal) {
        await deps.store.recordRun({ siteId: site.id, period, stage: "collect", status: "waiting", attempts: 1, error: "Month not final in Search Console" });
        report = await deps.store.updateReport(report.id, { status: "collecting" });
        log.info("waiting for Search Console to finalise the month");
        return { siteId: site.id, status: report.status, stage: report.stage, failures };
      }
      report = await deps.store.updateReport(report.id, { collected: result.data, stage: "collect" });
    }

    if (!done(report, "insights")) {
      const data = await withRetry("calculate", site, period, deps, async () => buildReport(report.collected!, now()));
      report = await deps.store.updateReport(report.id, { data, stage: "insights" });
    }

    if (!done(report, "narrative")) {
      const narrative = await withRetry("narrative", site, period, deps, () =>
        writeNarrative(report.data!, { aiEnabled: site.aiEnabled, rewrite: deps.rewrite, log }));
      report = await deps.store.updateReport(report.id, { narrative, stage: "narrative" });
    }

    if (!done(report, "render")) {
      const pdf = await withRetry("render", site, period, deps, () => deps.render(reportInput(site, report, now())));
      const key = await deps.files.put(pdfKey(site.orgId, site.id, period, 1), pdf, "application/pdf");
      report = await deps.store.updateReport(report.id, {
        pdfKey: key, stage: "render", status: "draft",
        shareToken: report.shareToken ?? randomBytes(16).toString("hex"),
      });
    }

    if (!done(report, "review")) {
      if (site.autoSend) {
        report = await deps.store.updateReport(report.id, { status: "approved", stage: "review" });
        await deps.store.audit({ orgId: site.orgId, action: "report.auto_approved", entityId: report.id });
      } else if (report.status !== "approved") {
        report = await deps.store.updateReport(report.id, { status: report.status === "in_review" ? "in_review" : "draft" });
        log.info("draft ready for review");
        return { siteId: site.id, status: report.status, stage: report.stage, failures };
      } else {
        report = await deps.store.updateReport(report.id, { stage: "review" });
      }
    }

    if (report.status === "approved" && !report.sentAt) {
      await withRetry("deliver", site, period, deps, async () => {
        const link = `${deps.appUrl.replace(/\/$/, "")}/r/${report.shareToken}`;
        const pdf = await deps.render(reportInput(site, report, now()));
        const email = composeEmail(site, period, report.narrative!, link, pdf, report.id);
        if (deps.dryRun || !deps.send) {
          await deps.files.put(`emails/${site.id}/${period}.html`, new TextEncoder().encode(email.html), "text/html");
          log.info("dry run: email written instead of sent", { to: email.to });
          return;
        }
        const { id } = await deps.send(email);
        log.info("sent", { deliveryId: id, to: email.to.length });
      });
      if (!deps.dryRun && deps.send) {
        report = await deps.store.updateReport(report.id, { status: "sent", stage: "deliver", sentAt: now().toISOString() });
        await deps.store.audit({ orgId: site.orgId, action: "report.sent", entityId: report.id, meta: { auto: site.autoSend } });
      }
    }
  } catch (err) {
    const stage = (err as { stage?: Stage }).stage ?? null;
    log.error("stage failed after retries", { stage, error: (err as Error).message });
    report = await deps.store.updateReport(report.id, { status: "failed" });
    failures.push(`${stage ?? "pipeline"}: ${(err as Error).message}`);
  }
  return { siteId: site.id, status: report.status, stage: report.stage, failures };
}

export function reportInput(site: PipelineSite, report: StoredReport, now: Date): ReportInput {
  return {
    report: report.data!,
    narrative: report.narrative!,
    org: { name: site.brand.name, primary: site.brand.primary, accent: site.brand.accent, footer: site.brand.footer },
    client: { name: site.clientName },
    preparedBy: site.managerName,
    managerNotes: report.managerNotes,
    generatedAt: now.toISOString(),
  };
}

export async function runMonthly(period: string, deps: RunDeps, filter?: { siteId?: string }) {
  await deps.heartbeat?.start();
  const sites = await deps.store.sites(filter);
  deps.log.info("monthly run starting", { period, sites: sites.length, dryRun: Boolean(deps.dryRun) });
  const results: SiteResult[] = [];
  for (const site of sites) results.push(await runSite(site, period, deps));
  const summary = {
    period,
    sites: results.length,
    drafts: results.filter((r) => r.status === "draft" || r.status === "in_review").length,
    sent: results.filter((r) => r.status === "sent").length,
    waiting: results.filter((r) => r.status === "collecting").length,
    failed: results.filter((r) => r.status === "failed").length,
  };
  deps.log.info("monthly run finished", summary);
  if (summary.failed > 0) await deps.heartbeat?.fail(JSON.stringify(summary));
  else await deps.heartbeat?.success(JSON.stringify(summary));
  return { results, summary };
}
