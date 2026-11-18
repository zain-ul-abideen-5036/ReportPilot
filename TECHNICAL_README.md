# ReportPilot: technical documentation

How the code fits together, for anyone working on it. The *why* lives in the
[design specification](docs/SPEC.md) and the
[architecture decisions](docs/adr/README.md); this page is the *how*.

## Repository layout

An npm workspaces monorepo. Every package ships TypeScript source; Next.js
and `tsx` compile it, so there is no build step between packages.

| Workspace | Depends on | Purpose |
| --- | --- | --- |
| `packages/core` | nothing | Pure functions: changes, search opportunities, vitals, uptime, the rules engine, narrative, number check |
| `packages/demo` | core | A seeded, deterministic sample agency shaped exactly like the collectors' output |
| `packages/charts` | react | Server-rendered SVG charts reading colours from CSS variables |
| `packages/report` | core, charts | The A4 report as React components; HTML and PDF rendering |
| `packages/integrations` | core | Search Console, PageSpeed, CrUX, RDAP and TLS, over plain `fetch` |
| `packages/db` | core, demo | Drizzle schema, generated migration, seed, retention |
| `apps/web` | core, demo, charts, report | Next.js dashboard, landing page, print route and PDF download |
| `workers/uptime` | core | Cloudflare Worker: checks, incidents, alerts, nightly rollup |
| `jobs/pipeline` | everything | Monthly and weekly jobs and their CLI |

## Data flow

```
collectors ──► CollectedData ──► buildReport() ──► ReportData ──► templateNarrative() ──► Narrative
 (integrations,                   (core/report.ts)                 (core/narrative.ts)
  pg-store, demo)                                                        │
                                                                         ▼
                                                     ReportDocument (packages/report) ──► PDF
```

- **`CollectedData`** (`core/types.ts`) is everything one site needs for one
  month. Each source may be `null`; nothing downstream assumes it isn't.
- **`buildReport`** is pure and deterministic. It produces KPIs with
  month-on-month and year-on-year changes, opportunities, movers, vitals
  ratings, an uptime summary, status lights and ranked findings.
- **Findings** (`core/insights.ts`) carry the formatted figures their
  sentences quote. The narrative can only use those strings, which is what
  makes the AI number check possible.
- **`ReportDocument`** renders identically in the dashboard (scaled with a
  CSS transform) and in Chromium for the PDF.

## The pipeline

`jobs/pipeline/src/runner.ts`. One call to `runSite(site, period, deps)`:

1. `ensureReport`: upsert on `(site_id, period)`.
2. Skip if already `sent`.
3. For each stage not yet done (collect → calculate/insights → narrative →
   render), run it with `withRetry` (three attempts, exponential backoff),
   record a `job_runs` row per attempt, and save the output on the report.
4. Review: auto-send clients are approved and audit-logged; others stop at
   `draft` and wait for a person.
5. Deliver approved reports once. Dry runs write the email to `output/`.

Dependencies are injected (`RunDeps`): store, collectors, renderer, file
store, sender, rewriter, heartbeat, clock. The tests run the real runner
against the in-memory store and demo collectors.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dashboard on port 3000 with the demo agency |
| `npm run demo` | Monthly pipeline end to end with demo data; PDFs to `output/` |
| `npm test` | Vitest: core, integrations, worker and pipeline |
| `npm run typecheck` | `tsc` in every workspace |
| `npm run build` | Production build of the dashboard |
| `npm run test:e2e` | Playwright against a production build (desktop and mobile) |
| `npx tsx jobs/pipeline/src/cli.ts monthly --period 2026-10 --dry-run` | Real run against `DATABASE_URL`, sending nothing |
| `npm run generate -w @reportpilot/db` | Regenerate the migration after a schema change |
| `node scripts/screenshot.mjs http://localhost:3100` | Refresh the README screenshots |

## Testing strategy

| Layer | Where | What it proves |
| --- | --- | --- |
| Unit | `packages/core/test` | Every calculation has a known answer; reports are deterministic; the number check rejects invented figures |
| Contract | `packages/integrations/test` | Pagination, retries, auth and response parsing against recorded responses, never live Google |
| Worker | `workers/uptime/test` | The two-failure rule, keyword checks, recovery and nightly rollup |
| Pipeline | `jobs/pipeline/test` | Idempotency, resume after failure, partial data, the approval gate, dry runs, AI fallback |
| End to end | `e2e/` | Review flow, onboarding, alerts, `noindex` links, reduced motion, no horizontal overflow at four widths |
| Visual | `e2e/pdf.spec.ts` | Each PDF page against an approved snapshot |

## Front-end conventions

- Tokens live in `apps/web/src/app/globals.css`: colour, type scale, radii,
  one easing curve, three durations and z-index layers. Components never use
  raw values.
- One light theme, "Paper & Pine", with a pine-to-brass signature gradient
  (`.bg-brand`, `.text-gradient`, `.rule-gradient`).
- Motion animates `transform` and `opacity` only. Landing reveals use CSS
  scroll timelines; nothing listens to `scroll`. Reduced motion collapses
  every animation to its end state, and a test checks headings stay opaque.
- Status is always an icon plus a label plus colour.
- Tables become cards below 768 px; every grid has a single-column base.

## Environment

See [`.env.example`](.env.example). Nothing is required for the demo.
Production secrets live in GitHub Actions secrets and `wrangler secret`, never
in the repository; gitleaks runs on every push.
