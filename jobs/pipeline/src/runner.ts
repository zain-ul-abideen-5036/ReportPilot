import { randomBytes } from "node:crypto";
import { buildReport, isDue, localReportingPeriod } from "@reportpilot/core";
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
  /** Called with any error that ends a stage, for Sentry. */
  report?: (err: unknown, context: Record<string, unknown>) => void;
}

export interface SiteResult {
  siteId: string;
  status: StoredReport["status"];
  stage: Stage | null;
  failures: string[];
}

/** Resend rejects attachments over 40 MB and many inboxes stop at 10 MB. Our reports are about 300 KB. */
export const MAX_PDF_BYTES = 8 * 1024 * 1024;

export function assertPdfSize(pdf: Uint8Array) {
  if (pdf.byteLength > MAX_PDF_BYTES) throw new Error(`PDF is ${(pdf.byteLength / 1_048_576).toFixed(1)} MB, over the 8 MB limit`);
  if (pdf.byteLength < 4) throw new Error("PDF is empty");
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
      if (attempt >= max) throw Object.assign(new Error(error), { stage, cause: err });
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
      const pdf = await withRetry("render", site, period, deps, async () => {
        const bytes = await deps.render(reportInput(site, report, now()));
        assertPdfSize(bytes);
        return bytes;
      });
      // A report that already has a PDF (a forced re-run) gets a new version, never an overwrite.
      const version = report.pdfKey ? report.version + 1 : report.version;
      const key = await deps.files.put(pdfKey(site.orgId, site.id, period, version), pdf, "application/pdf");
      await deps.store.recordVersion({ reportId: report.id, version, pdfKey: key, reason: report.pdfKey ? "rerender" : "render" });
      report = await deps.store.updateReport(report.id, {
        pdfKey: key, version, stage: "render", status: "draft",
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
      const delivered = await withRetry("deliver", site, period, deps, async () => {
        const link = `${deps.appUrl.replace(/\/$/, "")}/r/${report.shareToken}`;
        // Render once more so the manager's latest note is in the copy the client receives.
        const pdf = await deps.render(reportInput(site, report, now()));
        assertPdfSize(pdf);
        const email = composeEmail(site, period, report.narrative!, link, pdf, report.id);
        if (deps.dryRun || !deps.send) {
          await deps.files.put(`emails/${site.id}/${period}.html`, new TextEncoder().encode(email.html), "text/html");
          await deps.files.put(`emails/${site.id}/${period}.txt`, new TextEncoder().encode(email.text), "text/plain");
          log.info("dry run: email written instead of sent", { to: email.to });
          return null;
        }
        const version = report.version + 1;
        const key = await deps.files.put(pdfKey(site.orgId, site.id, period, version), pdf, "application/pdf");
        const { id } = await deps.send(email);
        log.info("sent", { deliveryId: id, to: email.to.length });
        return { id, key, version };
      });
      if (delivered) {
        await deps.store.recordVersion({ reportId: report.id, version: delivered.version, pdfKey: delivered.key, reason: "sent" });
        report = await deps.store.updateReport(report.id, {
          status: "sent", stage: "deliver", sentAt: now().toISOString(),
          version: delivered.version, pdfKey: delivered.key, deliveryId: delivered.id, deliveryStatus: "queued",
        });
        await deps.store.audit({
          orgId: site.orgId, action: "report.sent", entityId: report.id,
          meta: { auto: site.autoSend, deliveryId: delivered.id, version: delivered.version },
        });
      }
    }
  } catch (err) {
    const stage = (err as { stage?: Stage }).stage ?? null;
    log.error("stage failed after retries", { stage, error: (err as Error).message });
    deps.report?.((err as { cause?: unknown }).cause ?? err, { siteId: site.id, period, stage });
    report = await deps.store.updateReport(report.id, { status: "failed" });
    failures.push(`${stage ?? "pipeline"}: ${(err as Error).message}`);
  }
  return { siteId: site.id, status: report.status, stage: report.stage, failures };
}

export function reportInput(site: PipelineSite, report: StoredReport, now: Date): ReportInput {
  return {
    report: report.data!,
    narrative: report.narrative!,
    org: { name: site.brand.name, primary: site.brand.primary, accent: site.brand.accent, footer: site.brand.footer, logoUrl: site.brand.logoUrl ?? null },
    client: { name: site.clientName, logoUrl: site.clientLogoUrl ?? null },
    preparedBy: site.managerName,
    managerNotes: report.managerNotes,
    generatedAt: now.toISOString(),
  };
}

export interface MonthlyOptions {
  siteId?: string;
  /**
   * Skip the per-client schedule. Used for manual runs (--period, --site)
   * and the demo. The scheduled run leaves it off, so each client is
   * processed from 06:00 on their report day in their own time zone.
   */
  force?: boolean;
}

/**
 * Stage 0, plan. With no period given, each site's month comes from its
 * client's local calendar and only sites that are due are processed.
 * The workflow runs hourly through the reporting window; a site that is
 * not due yet is simply picked up by a later run.
 */
export async function runMonthly(period: string | null, deps: RunDeps, opts: MonthlyOptions = {}) {
  const now = deps.now ?? (() => new Date());
  await deps.heartbeat?.start();
  const all = await deps.store.sites({ siteId: opts.siteId });
  const plan = all.map((site) => ({ site, period: period ?? localReportingPeriod(now(), site.timezone) }));
  const due = opts.force ? plan : plan.filter((p) => isDue(p.period, p.site, now()));
  deps.log.info("monthly run starting", {
    period: period ?? "per client", sites: all.length, due: due.length, dryRun: Boolean(deps.dryRun),
  });
  const results: SiteResult[] = [];
  for (const p of due) results.push(await runSite(p.site, p.period, deps));
  const summary = {
    period: period ?? "per client",
    sites: results.length,
    notDue: all.length - due.length,
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
