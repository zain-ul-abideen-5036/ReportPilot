# Contributing

Thanks for taking the time. ReportPilot is a portfolio project, but issues
and pull requests are welcome.

## Getting set up

```bash
git clone https://github.com/zain-ul-abideen-5036/ReportPilot.git
cd ReportPilot
npm install
npx playwright install chromium
npm run dev          # dashboard with the demo agency on http://localhost:3000
npm run demo         # run the monthly pipeline end to end, PDFs in output/
```

No database or API keys are needed for any of that.

## Before opening a pull request

```bash
npm run typecheck
npm test
npm run build && npm run test:e2e
```

CI runs the same steps, plus a secret scan.

## Where things live

| Path | What it is |
| --- | --- |
| `packages/core` | Calculations, insights, narrative and the number check. Pure functions; add a test for every change |
| `packages/integrations` | Google APIs, RDAP and TLS. Contract tests replay recorded responses |
| `packages/report` | The A4 report, shared by the dashboard preview and the PDF |
| `packages/charts` | Hand-written SVG charts |
| `packages/db` | Drizzle schema and migrations |
| `packages/demo` | The seeded sample agency |
| `apps/web` | Next.js dashboard and landing page |
| `workers/uptime` | Cloudflare Worker for uptime checks |
| `jobs/pipeline` | Monthly and weekly jobs |

## Conventions

- Commit messages are short, imperative and say what changed:
  "Add striking-distance calculation", not "updates".
- Figures shown to clients come from `packages/core` only. Never compute a
  percentage in a component.
- New UI uses the tokens in `globals.css`; no raw colours, durations or
  font sizes in components. See [docs/design.md](docs/design.md).
- Copy is British English, plain and specific. No exclamation marks.

## Reporting a security problem

Please don't open an issue. See [SECURITY.md](SECURITY.md).
