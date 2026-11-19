# ReportPilot: Technical Documentation

Everything needed to run, configure, deploy and extend ReportPilot. For what
the product does and screenshots, see the [README](README.md); for the
reasoning behind the design, the [specification](docs/SPEC.md).

## Contents

- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Deploying to Vercel](#deploying-to-vercel)
- [Architecture](#architecture)
- [The monthly pipeline](#the-monthly-pipeline)
- [How figures are calculated](#how-figures-are-calculated)
- [The number check](#the-number-check)
- [Security and privacy](#security-and-privacy)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Extending it](#extending-it)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)

---

## Getting started

**Requirements:** Node.js 22 or newer. No database, no accounts, no API keys.

```bash
git clone https://github.com/zain-ul-abideen-5036/ReportPilot.git
cd ReportPilot
npm install
npx playwright install chromium   # for PDFs and end-to-end tests

npm run dev                        # http://localhost:3000
```

Open the demo from the landing page, or pick a role on `/sign-in`. The
dashboard opens on a fictional agency, Northfold Studio, with eight clients
and a full October cycle: reports in every state, alerts, pipeline runs and
history. Without `DATABASE_URL`, each visitor's changes are saved in a
Zod-validated cookie and emails are captured on **Sent emails**.

### Useful local modes

| Command | What it does |
| --- | --- |
| `npm run dev` | Dashboard with Turbopack. The first page compiles in about 10 seconds, later pages in under one |
| `npm run build && npm start` | The production build. Dev mode compiles each page on first visit, so judge speed here |
| `npm run demo` | Runs the real monthly pipeline on the demo agency: 8 PDFs in `output/reports/`, email previews in `output/emails/` |
| `npm test` | 162 unit, contract, database (PGlite), worker and pipeline tests |
| `npm run typecheck` | `tsc` in every workspace |
| `npm run lint` | ESLint across the monorepo with TypeScript, React hooks, accessibility and Next.js rules |
| `npm run test:e2e` | 79 Playwright tests on desktop and mobile against a production build, including axe |
| `npx tsx jobs/pipeline/src/cli.ts daily` | Owed backfills, fresh daily clicks and alert evaluation against `DATABASE_URL` |
| `npx tsx jobs/pipeline/src/cli.ts backfill --site <id>` | Pull 16 months of Search Console history for one site |
| `npx tsx jobs/pipeline/src/cli.ts monthly --period 2026-10 --dry-run` | A real run against `DATABASE_URL`, sending nothing |
| `NEXT_DIST_DIR=.next-prod npm run build` | Build beside a running dev server without the two overwriting each other |
| `node scripts/screenshot.mjs http://localhost:3100` | Regenerate and compress the README screenshots |

### Trying the database mode locally

No Postgres install needed: `scripts/local-db.ts` runs PGlite (Postgres in
WebAssembly) behind a Postgres-protocol socket, with the migrations applied.

```bash
npx tsx scripts/local-db.ts                                         # 127.0.0.1:5544
export DATABASE_URL=postgres://postgres@127.0.0.1:5544/postgres
npm run seed -w @reportpilot/db
npm run build
DATABASE_POOL_MAX=1 AUTH_SECRET=$(openssl rand -hex 32) EMAIL_MODE=test npm start
```

Sign in as `tom@northfold.studio` (manager) or `amara@northfold.studio`
(owner). Without `RESEND_API_KEY` the one-time sign-in link is printed to the
server log. `scripts/db-mode-smoke.ts` drives this whole setup through a
browser.

---

## Environment variables

Nothing is required for the demo. All variables are listed in
[`.env.example`](.env.example).

| Variable | Used by | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | dashboard, jobs, worker | Postgres connection (pooled). Without it the dashboard uses the demo agency |
| `AUTH_SECRET` | dashboard | At least 32 random characters; signs session cookies and print URLs. Required with a database |
| `AUTH_EMAIL_FROM` | dashboard | Sender of sign-in emails (default `ReportPilot <sign-in@reportpilot.app>`) |
| `DATABASE_POOL_MAX` | dashboard | Connections per server instance (default 5) |
| `EMAIL_MODE` | dashboard | `test` captures report emails on **Sent emails** instead of sending them |
| `RESEND_WEBHOOK_SECRET` | dashboard | Verifies Resend's delivery and bounce webhooks (`whsec_…`) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | dashboard | Optional; the address shown in onboarding if the JSON key is not set on the dashboard |
| `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPOSITORY` | dashboard | Optional; lets onboarding start the backfill and a sample run on GitHub Actions straight away |
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN` | dashboard, jobs, worker | Optional error tracking |
| `HEALTHCHECK_DAILY_URL` | daily job | Heartbeat for the alerts job |
| `ALERT_FROM`, `ALERT_TO` | daily job, worker | Sender of alert emails, and a fallback recipient when a client has no manager |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | jobs | Service account for Search Console, on one line ([setup](docs/search-console-setup.md)) |
| `PAGESPEED_API_KEY` | weekly job | PageSpeed Insights and CrUX History (free) |
| `GEMINI_API_KEY` | monthly job | Optional AI wording, behind the [number check](#the-number-check) |
| `RESEND_API_KEY` | dashboard, jobs, worker | Report, alert and sign-in emails |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | monthly job | PDF storage on Cloudflare R2 |
| `HEALTHCHECK_MONTHLY_URL` | monthly job | Heartbeat ping at start and finish |
| `APP_URL` | dashboard, jobs | Public URL used in client report links |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | dashboard on Vercel | Lets PDFs print on protected preview deployments |
| `NEXT_DIST_DIR` | dashboard build | Optional build directory (default `.next`) |

Production secrets live in GitHub Actions secrets, Vercel environment
variables and `wrangler secret`, never in the repository; gitleaks scans every
push.

---

## Deploying to Vercel

The dashboard and landing page deploy to Vercel with **no code changes and no
environment variables**. The full step-by-step walkthrough, with every
setting and a troubleshooting table, is in
**[docs/vercel-deployment.md](docs/vercel-deployment.md)**.

| | Your computer | Vercel |
| --- | --- | --- |
| Data | Demo agency, or Postgres | Same |
| PDF browser | Playwright's Chromium | `@sparticuz/chromium` 153, with `playwright-core` pinned to the matching 1.63.0 |
| PDF time limit | none | 60 seconds; a cold start takes 3 to 6 |
| Jobs and uptime | run locally on demand | GitHub Actions and Cloudflare Workers, not Vercel |

### Steps

1. **Import the repository.** At [vercel.com](https://vercel.com) choose **Add New → Project** and import ReportPilot.
2. **Set Root Directory to `apps/web`.** Vercel detects Next.js. `apps/web/vercel.json` already sets the install command (from the repository root, for npm workspaces) and the build command.
3. **Deploy.** No variables are needed for the demo. Add `APP_URL` and, for real data, `DATABASE_URL` later under **Settings → Environment Variables**, then redeploy.

Every push to `main` then deploys to production, and every pull request gets a
preview URL.

### How it works on Vercel

- [`packages/report/src/pdf.ts`](packages/report/src/pdf.ts) detects Vercel (`VERCEL` or `AWS_LAMBDA_FUNCTION_NAME`) and launches `@sparticuz/chromium` through `playwright-core-serverless`, an npm alias for `playwright-core@1.63.0`, the release built for Chromium 153. Locally it uses the full `playwright` package.
- It filters `@sparticuz/chromium`'s `--single-process` flag, which lets closing one page take the whole browser down, and `--headless`, which Playwright sets itself.
- `outputFileTracingRoot` in [`next.config.ts`](apps/web/next.config.ts) traces dependencies from the monorepo root, and `outputFileTracingIncludes` ships `@sparticuz/chromium`'s compressed browser with the PDF function, because it is read from disk at run time and file tracing cannot see it.
- One browser is shared per function instance and each report's PDF is kept in memory, so only the first download after a cold start pays the launch cost.
- On protected preview deployments the PDF route sends `VERCEL_AUTOMATION_BYPASS_SECRET` as `x-vercel-protection-bypass`, so printing its own page does not hit the login screen.
- CI runs [`scripts/serverless-pdf-smoke.ts`](scripts/serverless-pdf-smoke.ts) on Linux with `VERCEL=1`, which prints a real PDF through this exact path on every push.

Vercel's Hobby plan is for personal, non-commercial use. Client work should run
on a Pro account or on Cloudflare.

---

## Architecture

```mermaid
flowchart LR
    W["<b>Uptime Worker</b><br/>Cloudflare cron<br/>every 5 minutes"]
    A["<b>Daily job</b><br/>backfill, daily clicks,<br/>alerts<br/>05:30 every day"]
    S["<b>Snapshot job</b><br/>PageSpeed, CrUX,<br/>sitemaps, URL Inspection<br/>every Monday"]
    DB[("Postgres")]
    P["<b>Monthly pipeline</b><br/>GitHub Actions, hourly 1st to 8th<br/>each client at 06:00 local<br/><br/>Collect<br/>Calculate<br/>Insights<br/>Narrative<br/>Render PDF"]
    D["<b>Dashboard</b><br/>Next.js on Vercel<br/>sign in, review, approve"]
    E["<b>Client</b><br/>email, PDF and<br/>private link"]
    R["<b>Resend</b><br/>delivery webhook"]

    W -->|"checks, downtime alerts"| DB
    A -->|"aggregates, alerts"| DB
    S -->|"speed, indexing"| DB
    DB <-->|"every stage saved"| P
    DB <--> D
    D -->|"approved"| P
    P -->|"send"| E
    D -->|"send now"| E
    R -->|"delivered, bounced"| D
```

An npm workspaces monorepo. Every package ships TypeScript source; Next.js and
`tsx` compile it, so there is no build step between packages.

| Workspace | Depends on | Purpose |
| --- | --- | --- |
| `packages/core` | nothing | Pure functions: changes, search opportunities, vitals, uptime, the rules engine, narrative, number check |
| `packages/demo` | core | A seeded, deterministic sample agency shaped exactly like the collectors' output |
| `packages/charts` | react | Server-rendered SVG charts that read colours from CSS variables |
| `packages/report` | core, charts | The A4 report as React components; HTML and PDF rendering |
| `packages/integrations` | core | Search Console, PageSpeed, CrUX, RDAP and TLS over plain `fetch` |
| `packages/db` | core, demo | Drizzle schema, generated migration, seed, retention |
| `apps/web` | core, demo, charts, report | Dashboard, landing page, print route and PDF download |
| `workers/uptime` | core | Cloudflare Worker: checks, incidents, alerts, nightly rollup |
| `jobs/pipeline` | everything | Monthly and weekly jobs and their command line |

### Data flow

```
collectors ──► CollectedData ──► buildReport() ──► ReportData ──► templateNarrative() ──► Narrative
 (integrations,                   core/report.ts                   core/narrative.ts
  pg-store, demo)                                                        │
                                                                         ▼
                                                    ReportDocument (packages/report) ──► PDF
```

- **`CollectedData`** ([`core/types.ts`](packages/core/src/types.ts)) is everything one site needs for one month. Each source may be `null`, and nothing downstream assumes it isn't.
- **`buildReport`** is pure and deterministic: KPIs with month-on-month and year-on-year changes, opportunities, movers, vitals ratings, an uptime summary, status lights and ranked findings.
- **Findings** ([`core/insights.ts`](packages/core/src/insights.ts)) carry the formatted figures their sentences quote, which is what makes the number check possible.
- **`ReportDocument`** renders identically in the dashboard (scaled with a CSS transform) and in Chromium for the PDF.

---

## The monthly pipeline

[`jobs/pipeline/src/runner.ts`](jobs/pipeline/src/runner.ts). For each active
site, `runSite(site, period, deps)`:

| Stage | What happens | Reliability |
| --- | --- | --- |
| Plan | Work out each client's month from their time zone; process only sites whose report day has reached 06:00 locally; upsert the report on `(site_id, period)` | Pure, tested scheduling; a unique index means re-running never duplicates |
| Collect | Search Console (this month, last month, last year, 13-month trend; earlier months from the archive the backfill filled), speed snapshot, uptime, sitemaps and URL Inspection | Sources are independent; a failure is recorded and the section says "unavailable" |
| Calculate and insights | `buildReport` | Pure, unit-tested |
| Narrative | Template text, optionally rewritten by AI | The number check decides |
| Render | PDF stored under `reports/<org>/<site>/<period>/v<n>.pdf`, with a `report_versions` row | Size check (8 MB); versioned keys; a re-render or send makes a new version |
| Review | Auto-send clients are approved and audit-logged; others wait at `draft` | Nothing reaches a client without approval |
| Deliver | Email with PDF, private link and plain-text alternative; Resend's id and delivery status stored | Sent once; bounces flag the contact through the webhook; dry runs write the email to `output/` |

Every stage runs inside `withRetry` (three attempts, exponential backoff),
writes a `job_runs` row per attempt and saves its output before the next
starts, so a failed run resumes at the stage that failed. A site whose month
Search Console has not finalised waits and is retried on the next hourly run.
Healthchecks.io is pinged at start and finish.

### Between reports

| Job | Schedule | What it does |
| --- | --- | --- |
| Uptime worker | Every 5 minutes | Keyword check, two-failure rule, TLS handshake result; an incident and a downtime alert are written together |
| Daily alerts | 05:30 UTC | Finishes owed 16-month backfills, refreshes 40 days of daily clicks, then raises or resolves alerts: SSL (21 and 7 days), domain (30 and 10), clicks down 30% on the previous four weeks, a Core Web Vital 20% worse and no longer good, key pages out of the index |
| Weekly snapshot | Mondays 05:00 UTC | PageSpeed median of three, CrUX history, URL Inspection, `sitemaps.list`, SSL and domain expiry |
| Resend webhook | On delivery events | Stores delivered, bounced or complained; a bounce flags the contact and raises an alert |

Each alert has a dedupe key, so a condition emails once per window, and alerts
whose condition clears resolve themselves.

---

## How figures are calculated

All in [`packages/core`](packages/core/src), each with unit tests.

| Figure | Definition |
| --- | --- |
| Change | `(current - previous) / previous`; no value when the previous month is 0 or missing. 1,000 → 1,200 is +20.0% |
| Trend | Changes under 2% are flat. Average position is better when it falls |
| Striking distance | Queries at positions 8 to 20 with at least 100 impressions, largest audience first |
| Low CTR | Pages with at least 500 impressions in the top 20 whose CTR is under half the typical CTR for their position; missed clicks = impressions × expected CTR − clicks |
| Movers | Click change per page and query between months; a page missing in one month counts as 0 |
| Top-10 movement | Queries crossing position 10 in either direction |
| Branded split | Queries matching the client's brand pattern (case-insensitive) vs the rest |
| Core Web Vitals | Google's thresholds: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 are good; passing means all three good |
| Lab score | Median of three Lighthouse runs per page and device |
| Uptime | Successful checks over all checks, averaged across days; an incident opens only after two failures 30 seconds apart |
| Status lights | Search: act at −15% clicks, watch below −5%. Speed: act if any vital is poor. Reliability: act under 99% uptime or under 7 days of SSL |

---

## The number check

[`core/number-check.ts`](packages/core/src/number-check.ts). AI is only ever
asked to *rewrite* the template summary. Its text is accepted only if every
number in it appears in the source (after normalising commas, signs and
trailing zeros), it keeps at least half of the source's figures, and it is not
trivially short. Otherwise the template is used. Only aggregated metrics are
sent, never contact details, and AI can be turned off per client. See
[ADR 0004](docs/adr/0004-number-check.md).

---

## Security and privacy

- **Google access** is read-only: a service account added as a Restricted user, revocable by the client at any time.
- **Report links** use random 128-bit tokens, expire after 90 days, can be revoked, and are served with `X-Robots-Tag: noindex` and `no-referrer`.
- **Sign-in** is by one-time email link (15 minutes, single use, only a SHA-256 hash stored). Sessions are HMAC-signed cookies checked in middleware for every dashboard route. The print page needs a session or a five-minute signed URL.
- **Roles:** owners manage branding; managers review, approve and send; viewers read. The rules live in one tested module ([`core/workflow.ts`](packages/core/src/workflow.ts)) used by both the database layer and the demo.
- **Every query** is scoped by organisation, and tests try to read another agency's rows; row-level security policies enforce the same rule in Postgres ([`packages/db/sql`](packages/db/sql/row-level-security.sql), tested on PGlite).
- **Input** to every server action and to the jobs' environment is validated with Zod.
- **Headers:** `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` and a restrictive `Permissions-Policy` on every page.
- **Retention:** raw uptime checks are deleted after 90 days; client contact emails are the only personal data ([privacy](docs/privacy.md)).

---

## Testing

| Layer | Where | What it proves |
| --- | --- | --- |
| Unit | `packages/core/test` | Every calculation has a known answer; reports are deterministic; the number check rejects invented figures |
| Contract | `packages/integrations/test` | Pagination, retries, auth and parsing against recorded responses, never live Google |
| Worker | `workers/uptime/test` | The two-failure rule, keyword checks, recovery and the nightly rollup |
| Pipeline | `jobs/pipeline/test` | Idempotency, resume after failure, partial data, the approval gate, dry runs, AI fallback, per-client scheduling, versions, the archive, backfill, alerts, env validation |
| Database | `packages/db/test` | The dashboard's queries and writes on PGlite with the real migrations: workflow, org isolation, share links, bounces, sign-in tokens, row-level security |
| End to end | `e2e/` | Onboard → generate → approve → send → email captured; revoking links; persistence; sign-in, forged cookies and roles; review flow, alerts, `noindex` links, reduced motion, hero above the fold on seven screen sizes, no horizontal scroll at four widths |
| Accessibility | `e2e/a11y.spec.ts` | axe on every page type against WCAG 2.2 AA |
| Visual | `e2e/pdf.spec.ts` | Each PDF page against an approved snapshot |
| Serverless | `scripts/serverless-pdf-smoke.ts` | The Vercel PDF path prints a real PDF on Linux |

CI runs all of them, plus ESLint and a gitleaks secret scan, on every push.
`scripts/db-mode-smoke.ts` drives the app in database mode through a browser
(see [trying the database mode locally](#trying-the-database-mode-locally)).

---

## Project structure

```
apps/web
  src/app                 routes: landing, (app) dashboard pages, print, r/[token], api
  src/components          shell, ui, dashboard, review, landing, alerts, onboarding, settings
  src/lib/data.ts         data access (demo agency, computed once per process)
  vercel.json             Vercel install and build commands
packages/core             calculations, insights, narrative, number check
packages/report           the A4 report, HTML and PDF rendering
packages/charts           SVG charts
packages/integrations     Google APIs, RDAP, TLS
packages/db               Drizzle schema, migrations, seed, row-level security
packages/demo             the sample agency
workers/uptime            Cloudflare Worker
jobs/pipeline             monthly and weekly jobs, CLI
e2e                       Playwright tests
docs                      specification, ADRs, guides, screenshots
scripts                   screenshots, serverless smoke test
```

---

## Extending it

### Add an insight rule

1. Add the rule to [`core/insights.ts`](packages/core/src/insights.ts), returning a `Finding` whose `facts` hold every figure its sentence uses.
2. Give it an `action` if it should appear in next month's recommendations.
3. Add a unit test with a known answer.

### Change the design

Tokens are in [`apps/web/src/app/globals.css`](apps/web/src/app/globals.css):
colour, type scale, radii, one easing curve, three durations and the signature
gradients. Components never use raw values. The PDF's look is in
[`packages/report/src/styles.ts`](packages/report/src/styles.ts). See the
[design system](docs/design.md).

### Upgrading Chromium on Vercel

`@sparticuz/chromium` and `playwright-core-serverless` must target the same
Chromium version:

1. Find the newest `@sparticuz/chromium` release; its major version is the Chromium major, for example 153.
2. Find the `playwright-core` release built for that Chromium in Playwright's release notes.
3. Update both in [`packages/report/package.json`](packages/report/package.json), for example `"@sparticuz/chromium": "153.0.0"` and `"playwright-core-serverless": "npm:playwright-core@1.63.0"`.
4. Push. The serverless smoke test in CI fails if they do not match.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| A page takes 10 seconds or more the first time in dev | Normal for dev mode, which compiles on first visit. Use `npm run build && npm start` to judge speed |
| `next build` fails with *no direct app page entry found for /_not-found* | A dev server is writing to the same `.next` folder. Stop it, or build with `NEXT_DIST_DIR=.next-prod` |
| The PDF button returns 503 locally | Run `npx playwright install chromium` |
| The PDF button returns 503 on Vercel | See [Vercel troubleshooting](docs/vercel-deployment.md#troubleshooting) |
| Demo run fails with *React is not defined* | Run it from the repository root, where `tsconfig.json` sets the JSX runtime |
| `Search Console: 403` | The service account is not a user on that property ([guide](docs/search-console-setup.md)) |

More operational cases are in the [runbook](docs/runbook.md).

---

## Limitations

- Search Console covers organic Google search only. GA4 is planned.
- There is no screen for inviting team members; users and memberships are added with the seed script or SQL. Sign-in is by email link only.
- The database code is tested on PGlite and smoke-tested in a browser; no CI job runs against a hosted Neon or Supabase database.
- Live Google, PageSpeed and Resend calls are covered by contract tests on recorded responses, not called from tests.
- PDF visual baselines are per machine; CI generates its own on each run.
- In the demo, uploaded logos are shown in the preview but not kept (each visitor's changes live in a small cookie).
- Uptime is checked from one region. Workers cannot read a peer certificate, so expiry dates come from the weekly job; the worker records whether the TLS handshake succeeded.
- Accessibility is checked with axe on every page type; a full screen-reader audit has not been done.
