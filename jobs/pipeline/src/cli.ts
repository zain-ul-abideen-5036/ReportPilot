#!/usr/bin/env -S npx tsx
/**
 * ReportPilot pipeline command line.
 *
 *   reportpilot monthly  [--period 2026-10] [--site <id>] [--dry-run] [--demo]
 *   reportpilot weekly   [--demo]
 *   reportpilot daily    [--site <id>] [--demo]
 *   reportpilot backfill --site <id> [--months 16]
 *
 * --demo     use the bundled sample agency; no database or API keys needed
 * --dry-run  generate every report and write emails to output/ instead of sending
 *
 * The monthly workflow runs hourly from the 2nd to the 8th. With no
 * --period, the plan step works out each client's month from their own
 * time zone and only processes the sites whose report day has reached
 * 06:00 local time. --period or --site skip that check (a manual run).
 */
import { parseArgs } from "node:util";
import { reportingPeriodFor } from "@reportpilot/core";
import { renderReportPdf } from "@reportpilot/report/render";
import { createLogger } from "./log";
import { memoryStore } from "./store";
import { demoCollectors, demoSites } from "./demo";
import { runMonthly } from "./runner";
import { localStore } from "./storage";
import { healthchecks } from "./heartbeat";
import { resendSender } from "./stages/deliver";
import { geminiRewriter } from "./stages/narrative";
import { fileStore, productionDeps } from "./production";
import { loadEnv, requireProduction } from "./config";
import { initSentry } from "./sentry";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    period: { type: "string" },
    site: { type: "string" },
    months: { type: "string" },
    "dry-run": { type: "boolean", default: false },
    demo: { type: "boolean", default: false },
  },
});

const command = positionals[0] ?? "monthly";
const log = createLogger({ job: command });

async function main() {
  const env = loadEnv();
  const sentry = await initSentry(env.SENTRY_DSN, command, log);
  const dryRun = values["dry-run"] ?? false;

  try {
    if (command === "monthly") {
      if (values.demo) {
        const period = values.period ?? reportingPeriodFor(new Date());
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
            appUrl: env.APP_URL,
            dryRun: true,
            sleep: async () => {},
          }, { siteId: values.site, force: true });
          if (summary.failed > 0) {
            console.error(`\nDemo run finished with ${summary.failed} of ${summary.sites} reports failed. See the log lines above.`);
            process.exitCode = 1;
          } else {
            console.log(`\nDemo run complete: ${summary.sites} reports. PDFs in output/reports/, email previews in output/emails/.`);
          }
        } finally {
          await browser.close();
        }
        return;
      }

      requireProduction(env);
      const files = fileStore(env);
      const deps = await productionDeps({ log, env, files });
      const manual = Boolean(values.period || values.site);
      const { summary } = await runMonthly(values.period ?? null, {
        ...deps,
        files,
        send: dryRun || !env.RESEND_API_KEY ? undefined : resendSender(env.RESEND_API_KEY),
        rewrite: env.GEMINI_API_KEY ? geminiRewriter(env.GEMINI_API_KEY) : undefined,
        heartbeat: healthchecks(env.HEALTHCHECK_MONTHLY_URL),
        appUrl: env.APP_URL,
        dryRun,
        report: (err, ctx) => sentry.capture(err, ctx),
      }, { siteId: values.site, force: manual });
      if (summary.failed > 0) process.exitCode = 1;
      return;
    }

    if (command === "weekly") {
      const { runWeekly } = await import("./weekly");
      await runWeekly({ log, demo: values.demo ?? false });
      return;
    }

    if (command === "daily") {
      if (values.demo || !env.DATABASE_URL) {
        log.info("daily job (demo): alerts in the demo agency are pre-seeded; nothing to fetch");
        return;
      }
      const { createDb } = await import("@reportpilot/db");
      const { GoogleAuth, parseServiceAccount } = await import("@reportpilot/integrations");
      const { runDaily } = await import("./daily");
      const { resendAlertNotifier } = await import("./alerts");
      const totals = await runDaily({
        db: createDb(env.DATABASE_URL),
        auth: env.GOOGLE_SERVICE_ACCOUNT_JSON ? new GoogleAuth(parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON)) : null,
        notify: resendAlertNotifier({ apiKey: env.RESEND_API_KEY, from: env.ALERT_FROM, fallbackTo: env.ALERT_TO, appUrl: env.APP_URL }),
        heartbeat: healthchecks(env.HEALTHCHECK_DAILY_URL),
        log,
        siteId: values.site,
      });
      if (totals.failed > 0) process.exitCode = 1;
      return;
    }

    if (command === "backfill") {
      if (!values.site) throw new Error("backfill needs --site <id>");
      requireProduction(env);
      const { createDb, tables } = await import("@reportpilot/db");
      const { eq } = await import("drizzle-orm");
      const { GoogleAuth, SearchConsole, parseServiceAccount } = await import("@reportpilot/integrations");
      const { backfillSite } = await import("./backfill");
      const { pgBackfillTarget } = await import("./daily");
      const db = createDb(env.DATABASE_URL);
      const [site] = await db.select().from(tables.sites).where(eq(tables.sites.id, values.site));
      if (!site?.gscProperty) throw new Error(`Site ${values.site} not found or has no Search Console property`);
      const r = await backfillSite({ id: site.id, gscProperty: site.gscProperty }, {
        source: new SearchConsole(new GoogleAuth(parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON))),
        target: pgBackfillTarget(db),
        log,
        now: new Date(),
        months: values.months ? Number(values.months) : undefined,
      });
      if (r.failed.length) process.exitCode = 1;
      return;
    }

    log.error("unknown command", { command });
    process.exitCode = 2;
  } catch (err) {
    sentry.capture(err, { command });
    throw err;
  } finally {
    await sentry.flush();
  }
}

main().catch((err) => {
  log.error("fatal", { error: (err as Error).stack ?? String(err) });
  process.exit(1);
});
