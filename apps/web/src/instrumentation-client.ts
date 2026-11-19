/**
 * Browser error tracking, active only when NEXT_PUBLIC_SENTRY_DSN is set
 * at build time. Errors only: no performance tracing, no session replay.
 */
import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0,
  });
}
