/**
 * Server-side error tracking. Sentry starts only when SENTRY_DSN is set,
 * so local development and the public demo need no account. No request
 * bodies, cookies or IP addresses are sent.
 */
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}

export async function onRequestError(...args: unknown[]) {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import("@sentry/nextjs");
  // @ts-expect-error -- forwarded unchanged; the signature belongs to Next.js
  Sentry.captureRequestError(...args);
}
