import { createDb } from "@reportpilot/db";
import { GoogleAuth, SearchConsole, parseServiceAccount } from "@reportpilot/integrations";
import { renderReportPdf } from "@reportpilot/report/render";
import type { Browser } from "playwright";
import type { Logger } from "./log";
import type { RunDeps } from "./runner";
import type { JobEnv } from "./config";
import { indexingFromDb, pgArchive, pgStore, speedFromDb, uptimeFromDb } from "./pg-store";
import { localStore, logoResolver, r2Store, type FileStore } from "./storage";

/** R2 when configured, otherwise the local output/ folder (dry runs, forks). */
export function fileStore(env: JobEnv): FileStore {
  return env.R2_BUCKET
    ? r2Store({ accountId: env.R2_ACCOUNT_ID!, bucket: env.R2_BUCKET, accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! })
    : localStore("output");
}

/**
 * Production wiring: Postgres store, Search Console via the service
 * account, earlier months from the archive the backfill filled, speed and
 * uptime from the tables the weekly job and the worker maintain, and one
 * shared Chromium for every PDF in the run.
 */
export async function productionDeps({ log, env, files }: { log: Logger; env: JobEnv; files: FileStore }): Promise<Pick<RunDeps, "store" | "collectors" | "render" | "log">> {
  const db = createDb(env.DATABASE_URL);
  const auth = new GoogleAuth(parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_JSON));
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
    store: pgStore(db, { logo: logoResolver(files) }),
    log,
    render,
    collectors: {
      gsc: new SearchConsole(auth),
      archive: pgArchive(db),
      speedSnapshot: (siteId) => speedFromDb(db, siteId),
      uptime: (siteId, period) => uptimeFromDb(db, siteId, period),
      indexing: (siteId) => indexingFromDb(db, siteId),
    },
  };
}
