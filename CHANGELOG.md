# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-11-19

Everything the specification asked for that 0.1.0 left as a gap.

### Added

- **Sign-in** with one-time email links (15 minutes, single use, hashed),
  HMAC-signed session cookies checked in middleware, and owner, manager and
  viewer roles enforced by one tested workflow module. The public demo signs
  in with one click and offers each role.
- **A dashboard that saves**: notes, approvals, withdrawals, Send now,
  auto-send and AI toggles, alert acknowledgement, branding with logo upload,
  revoking and reissuing client links, and onboarding all go through
  Zod-validated server actions, are written to Postgres and the audit log, or,
  in the demo, to a per-visitor cookie.
- **Sent emails** page: in test mode every report email is captured and shown
  exactly as the client would receive it.
- **Alerts between reports**: a daily job raises and auto-resolves SSL, domain,
  traffic-drop, Core Web Vitals and indexing alerts and emails each once; the
  uptime worker writes downtime alerts with the incident; bounced emails raise
  an alert.
- **Search Console archive and 16-month backfill**: monthly query, page,
  device and country aggregates and daily totals are stored; earlier months are
  read from the archive instead of the API; new sites are backfilled by the
  daily job or on demand.
- **Per-client scheduling**: the monthly workflow runs hourly from the 1st to
  the 8th and processes each client at 06:00 on their report day in their own
  time zone.
- **Report versions** (a row and a file per render and per send), PDF size
  check, Resend delivery id and status, and a signed Resend webhook that flags
  bounced contacts.
- **Report**: daily impressions chart, country split, client logo on the
  cover and sitemap errors in indexing health.
- **Weekly snapshot** collects `sitemaps.list`; the worker records the TLS
  handshake result and names TLS failures.
- **Sentry** in the dashboard (server and browser), the jobs and the worker,
  active when a DSN is set.
- **Quality**: ESLint in CI; 162 unit, contract, database and pipeline tests,
  with the database layer and row-level security tested on PGlite; 79
  Playwright tests including the full onboard → approve → send flow, roles and
  axe accessibility checks; a database-mode browser smoke test and a
  zero-install local Postgres.

### Changed

- Secondary text and amber status colours darkened slightly to pass WCAG AA
  contrast on every surface.
- Row-level security works with the app's own sign-in and covers every
  organisation-scoped table.

## [0.1.0] - 2026-11-19

The MVP: the full monthly reporting loop, runnable without keys in demo mode.

### Added

- **Dashboard**: overview with cycle progress, a "needs you" queue and time
  saved; reports grouped by status; report review with a live A4 preview,
  findings, manager notes and the approval workflow; clients, alerts,
  pipeline and branding pages; four-step onboarding wizard.
- **Landing page** with real report pages and CSS-only scroll reveals.
- **Client report**: eight branded A4 pages rendered from the same React
  components as the preview, printed to tagged, outlined PDF by Playwright.
- **Calculations**: month-on-month and year-on-year changes, striking-distance
  keywords, low-CTR pages, movers, top-10 movement, branded split, Core Web
  Vitals ratings and uptime summaries.
- **Insights and narrative**: a rules engine producing ranked findings,
  template narrative, and optional AI rewriting behind a number check.
- **Integrations**: Search Console with service-account auth and pagination,
  PageSpeed median of three, CrUX History, RDAP and TLS expiry.
- **Uptime worker** on Cloudflare: five-minute checks requiring expected
  text, the two-failure rule, incident emails, nightly rollup and retention.
- **Pipeline**: resumable, idempotent monthly runner with approval gate,
  dry-run and demo modes, R2 storage, Resend delivery and heartbeat pings;
  weekly snapshot job.
- **Database**: Drizzle schema for every table in the spec, generated
  migration, demo seed and optional row-level security.
- **Quality**: 93 unit and contract tests, Playwright end-to-end tests on
  desktop and mobile, PDF visual regression, CI with secret scanning.
- **Docs**: design specification, architecture decisions, deployment,
  Search Console setup, runbook, privacy and design system.

### Design

- One light theme, "Paper & Pine", with pine-to-brass signature gradients and
  a drifting glow; Fraunces and Hanken Grotesk; CC0 photography with an
  editorial grade; count-up figures, an animated pipeline track and a marquee.

### Fixed

- Grids without a base column overflowed on phones; screen-reader labels in
  the pipeline table escaped their scroller.

- Demo share tokens could contain a minus sign and produce broken links.
