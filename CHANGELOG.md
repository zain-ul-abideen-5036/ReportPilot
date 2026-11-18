# Changelog

All notable changes to this project are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
