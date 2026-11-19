import postgres from "postgres";
import * as Sentry from "@sentry/cloudflare";
import { postgresStore } from "./store";
import { resendNotifier } from "./notify";
import { runNightly, runTick } from "./monitor";

export interface Env {
  DATABASE_URL: string;
  RESEND_API_KEY?: string;
  ALERT_FROM: string;
  ALERT_TO?: string;
  RECHECK_DELAY_MS?: string;
  /** Optional. When set, any exception in a cron run is reported to Sentry. */
  SENTRY_DSN?: string;
}

/**
 * Cron entry point. "*\/5 * * * *" runs the checks; "10 0 * * *" rolls
 * up yesterday and applies retention. Each invocation opens and closes
 * its own small connection, which suits Workers' short lifetimes.
 */
const handler = {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
    const sql = postgres(env.DATABASE_URL, { max: 2, prepare: false, fetch_types: false });
    const store = postgresStore(sql);
    const work = (async () => {
      try {
        if (event.cron === "10 0 * * *") {
          const r = await runNightly(store, new Date(event.scheduledTime));
          console.info(JSON.stringify({ msg: "nightly rollup", ...r }));
        } else {
          const outcomes = await runTick({
            store,
            notifier: resendNotifier(env.RESEND_API_KEY, env.ALERT_FROM, env.ALERT_TO),
            recheckDelayMs: Number(env.RECHECK_DELAY_MS ?? 30_000),
          });
          const down = outcomes.filter((o) => !o.result.ok).length;
          console.info(JSON.stringify({ msg: "uptime tick", sites: outcomes.length, down, transitions: outcomes.filter((o) => o.transition) }));
        }
      } finally {
        await sql.end({ timeout: 5 });
      }
    })();
    ctx.waitUntil(work);
    await work;
  },

  /** Health endpoint so Healthchecks.io or a browser can confirm the worker is deployed. */
  async fetch(): Promise<Response> {
    return Response.json({ ok: true, service: "reportpilot-uptime" });
  },
};

// Sentry stays inert without a DSN, so local `wrangler dev` needs no account.
export default Sentry.withSentry(
  (env: Env) => ({ dsn: env.SENTRY_DSN, enabled: Boolean(env.SENTRY_DSN), tracesSampleRate: 0 }),
  handler as unknown as Parameters<typeof Sentry.withSentry<Env>>[1],
);

interface ScheduledController { cron: string; scheduledTime: number }
interface ExecutionContext { waitUntil(promise: Promise<unknown>): void }
