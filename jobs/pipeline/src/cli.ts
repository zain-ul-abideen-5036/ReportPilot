#!/usr/bin/env -S npx tsx
/**
 * ReportPilot pipeline command line.
 *
 *   reportpilot monthly [--period 2026-10] [--site <id>] [--dry-run] [--demo]
 *   reportpilot weekly  [--demo]
 *
 * --demo     use the bundled sample agency; no database or API keys needed
 * --dry-run  generate every report and write emails to output/ instead of sending
 *
 * Run by .github/workflows/monthly-reports.yml on the 2nd–4th at 06:00 UTC;
 * the per-client 06:00 local-time rule is applied by the plan step.
 */
import { parseArgs } from "node:util";
import { reportingPeriodFor } from "@reportpilot/core";
import { renderReportPdf } from "@reportpilot/report/render";
import { createLogger } from "./log";
import { memoryStore } from "./store";
import { demoCollectors, demoSites } from "./demo";
import { runMonthly } from "./runner";
import { localStore, r2Store } from "./storage";
import { healthchecks } from "./heartbeat";
import { resendSender } from "./stages/deliver";
import { geminiRewriter } from "./stages/narrative";
import { productionDeps } from "./production";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    period: { type: "string" },
    site: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    demo: { type: "boolean", default: false },
  },
});

const command = positionals[0] ?? "monthly";
const log = createLogger({ job: command });

async function main() {
  const period = values.period ?? reportingPeriodFor(new Date());
  const dryRun = values["dry-run"] ?? false;

  if (command === "monthly") {
    if (values.demo) {
      const { store } = memoryStore(demoSites());
      const { chromium } = await import("playwright");
      const browser = await chromium.launch();
      try {
        const { summary } = await runMonthly(period, {
          store,
          collectors: demoCollectors(period),
          render: (input) => renderReportPdf(input, { browser }),
          files: localStore("output"),
          log,
          appUrl: process.env.APP_URL ?? "http://localhost:3000",
          dryRun: true,
          sleep: async () => {},
        }, { siteId: values.site });
        console.log(`\nDemo run complete: ${summary.sites} reports, PDFs in output/reports/, email previews in output/emails/.`);
      } finally {
        await browser.close();
      }
      return;
    }

    const deps = await productionDeps({ log, dryRun });
    const files = process.env.R2_BUCKET
      ? r2Store({ accountId: process.env.R2_ACCOUNT_ID!, bucket: process.env.R2_BUCKET, accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! })
      : localStore("output");
    const { summary } = await runMonthly(period, {
      ...deps,
      files,
      send: dryRun || !process.env.RESEND_API_KEY ? undefined : resendSender(process.env.RESEND_API_KEY),
      rewrite: process.env.GEMINI_API_KEY ? geminiRewriter(process.env.GEMINI_API_KEY) : undefined,
      heartbeat: healthchecks(process.env.HEALTHCHECK_MONTHLY_URL),
      appUrl: process.env.APP_URL ?? "http://localhost:3000",
      dryRun,
    }, { siteId: values.site });
    if (summary.failed > 0) process.exitCode = 1;
    return;
  }

  if (command === "weekly") {
    const { runWeekly } = await import("./weekly");
    await runWeekly({ log, demo: values.demo ?? false });
    return;
  }

  log.error("unknown command", { command });
  process.exitCode = 2;
}

main().catch((err) => {
  log.error("fatal", { error: (err as Error).stack ?? String(err) });
  process.exit(1);
});
