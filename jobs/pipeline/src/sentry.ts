import type { Logger } from "./log";

/**
 * Error tracking for the scheduled jobs. Sentry is loaded only when
 * SENTRY_DSN is set, so local and demo runs stay dependency-free at
 * runtime. Only error messages and stage names are sent: no report data,
 * no client contacts.
 */
export interface ErrorReporter {
  capture(err: unknown, context?: Record<string, unknown>): void;
  flush(): Promise<void>;
}

const noop: ErrorReporter = { capture() {}, async flush() {} };

export async function initSentry(dsn: string | undefined, job: string, log: Logger): Promise<ErrorReporter> {
  if (!dsn) return noop;
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn,
    environment: process.env.GITHUB_ACTIONS ? "actions" : "local",
    release: process.env.GITHUB_SHA,
    tracesSampleRate: 0,
    initialScope: { tags: { job } },
  });
  log.info("sentry enabled");
  return {
    capture(err, context) {
      Sentry.withScope((scope) => {
        if (context) scope.setContext("pipeline", context);
        Sentry.captureException(err);
      });
    },
    async flush() {
      await Sentry.flush(5000);
    },
  };
}
