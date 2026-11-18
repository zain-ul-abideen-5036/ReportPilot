# 0001: Split work across three free runtimes

**Status:** accepted

## Context

ReportPilot has three workloads with very different shapes. Uptime checks run
every five minutes and must be cheap and frequent. Report rendering needs a
full Chromium for a few minutes once a month. The dashboard is an ordinary,
mostly idle web app. No single free tier fits all three.

## Decision

- **Uptime:** Cloudflare Workers cron triggers (100,000 requests a day free).
- **Monthly and weekly jobs:** GitHub Actions scheduled workflows, which give
  a real Linux machine with Chromium and generous free minutes.
- **Dashboard:** Next.js, deployable to Cloudflare or Vercel.

All three share one Postgres database and one TypeScript `core` package.

## Consequences

- £0 running cost up to about 50 sites.
- Three deploy targets to understand instead of one. Mitigated by keeping
  logic in shared packages so each runtime is thin wiring.
- GitHub's scheduler can start jobs late at busy times. Acceptable for a
  monthly job; the heartbeat (Healthchecks.io) catches a missed run.
