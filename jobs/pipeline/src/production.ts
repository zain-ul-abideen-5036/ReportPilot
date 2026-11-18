import { createDb } from "@reportpilot/db";
import { GoogleAuth, SearchConsole, parseServiceAccount } from "@reportpilot/integrations";
import { renderReportPdf } from "@reportpilot/report/render";
import type { Browser } from "playwright";
import type { Logger } from "./log";
import type { RunDeps } from "./runner";
import { indexingFromDb, pgStore, speedFromDb, uptimeFromDb } from "./pg-store";

/**
 * Production wiring: Postgres store, Search Console via the service
 * account, speed and uptime from the tables the weekly job and the worker
 * maintain, and one shared Chromium for every PDF in the run.
 */
export async function productionDeps({ log }: { log: Logger; dryRun: boolean }): Promise<Pick<RunDeps, "store" | "collectors" | "render" | "log">> {
  const db = createDb();
  const auth = new GoogleAuth(parseServiceAccount(process.env.GOOGLE_SERVICE_ACCOUNT_JSON));
  log.info("using service account", { email: auth.email });

  let browser: Browser | null = null;
  const render: RunDeps["render"] = async (input) => {
    if (!browser) {
      const { chromium } = await import("playwright");
      browser = await chromium.launch();
      process.once("beforeExit", () => void browser?.close());
    }
    return renderReportPdf(input, { browser });
  };

  return {
    store: pgStore(db),
    log,
    render,
    collectors: {
      gsc: new SearchConsole(auth),
      speedSnapshot: (siteId) => speedFromDb(db, siteId),
      uptime: (siteId, period) => uptimeFromDb(db, siteId, period),
      indexing: (siteId) => indexingFromDb(db, siteId),
    },
  };
}
