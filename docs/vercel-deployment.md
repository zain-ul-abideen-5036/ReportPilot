# Deploying to Vercel

A step-by-step guide to putting the ReportPilot dashboard and landing page on
Vercel. The first deployment takes about ten minutes and needs no
environment variables: without a database the app runs on the bundled demo
agency, which is exactly what a portfolio or a supervisor review needs.

- [What runs where](#what-runs-where)
- [Before you start](#before-you-start)
- [Deploy from the Vercel dashboard](#deploy-from-the-vercel-dashboard)
- [Deploy from the command line](#deploy-from-the-command-line)
- [Environment variables](#environment-variables)
- [PDF downloads on Vercel](#pdf-downloads-on-vercel)
- [Preview deployments and protection](#preview-deployments-and-protection)
- [Custom domain](#custom-domain)
- [Checking the deployment](#checking-the-deployment)
- [Troubleshooting](#troubleshooting)

---

## What runs where

ReportPilot is three programs. Only the first goes on Vercel:

| Part | Where it runs | Guide |
| --- | --- | --- |
| **Dashboard and landing page** (`apps/web`) | **Vercel** | this page |
| Monthly and weekly jobs (`jobs/pipeline`) | GitHub Actions, already configured | [deployment.md](deployment.md#4-scheduled-jobs) |
| Uptime checks (`workers/uptime`) | Cloudflare Workers | [deployment.md](deployment.md#3-uptime-worker) |

On Vercel the app behaves almost exactly as on your computer:

| | Your computer | Vercel |
| --- | --- | --- |
| Data | Demo agency, or Postgres with `DATABASE_URL` | Same |
| PDF browser | Playwright's Chromium | `@sparticuz/chromium` 153, with `playwright-core` pinned to the matching 1.63.0 |
| PDF function time limit | none | 60 seconds (a cold start takes 3 to 6 seconds) |
| Repeat PDF downloads | served from memory | served from memory while the function stays warm |
| Pages | static where possible, the rest server-rendered | Same, served from Vercel's edge |

---

## Before you start

- A [Vercel](https://vercel.com) account. Sign up with GitHub so Vercel can
  see the repository.
- The repository on GitHub (it already is).
- Nothing else. The project already contains everything Vercel needs:

| File | What it does |
| --- | --- |
| [`apps/web/vercel.json`](../apps/web/vercel.json) | Installs from the repository root (npm workspaces) and builds the Next.js app |
| [`apps/web/package.json`](../apps/web/package.json) | Pins Node.js 22 |
| [`apps/web/next.config.ts`](../apps/web/next.config.ts) | Traces files from the monorepo root and ships the serverless Chromium with the PDF function |
| [`packages/report/src/pdf.ts`](../packages/report/src/pdf.ts) | Switches to `@sparticuz/chromium` when it detects Vercel |

> **Plan.** Vercel's free Hobby plan is for personal, non-commercial use,
> which covers a portfolio, a demo or a supervisor review. An agency serving
> paying clients should use a Pro plan, or deploy to Cloudflare instead.

---

## Deploy from the Vercel dashboard

1. **Create the project.** In Vercel choose **Add New → Project**, find
   **ReportPilot** in the list of your GitHub repositories and press
   **Import**.

2. **Set the root directory.** This is the one setting that matters. Under
   **Root Directory** press **Edit**, choose **`apps/web`** and confirm.
   Vercel then detects **Next.js** as the framework on its own.

3. **Leave the build settings alone.** `apps/web/vercel.json` already sets:

   | Setting | Value |
   | --- | --- |
   | Framework preset | Next.js |
   | Install command | `cd ../.. && npm ci --no-audit --no-fund` |
   | Build command | `npm run build` |
   | Output directory | Next.js default |

   The install runs from the repository root because the dashboard depends
   on the workspace packages in `packages/`.

4. **Environment variables: none for the demo.** Skip this section for now.
   See [Environment variables](#environment-variables) when you connect real
   data.

5. **Deploy.** Press **Deploy**. The first build takes two to four minutes.
   When it finishes, Vercel shows the live URL, something like
   `reportpilot-yourname.vercel.app`.

6. **Check "Include files outside the root directory".** Open
   **Settings → Build and Deployment → Root Directory** and make sure
   *Include files outside of the Root Directory in the Build Step* is
   **enabled**. It is on by default; if someone turned it off, the build
   cannot see `packages/` and fails with *Module not found:
   @reportpilot/core*.

From now on every push to `main` deploys to production, and every pull
request gets its own preview URL.

---

## Deploy from the command line

If you prefer a terminal:

```bash
npm install --global vercel
cd ReportPilot
vercel login
vercel link          # choose your scope, "Link to existing project?" No, name it ReportPilot
                     # when asked "In which directory is your code located?" answer ./apps/web
vercel               # a preview deployment
vercel --prod        # a production deployment
```

`vercel link` stores the project settings in `.vercel/`, which is already
ignored by git.

---

## Environment variables

Add these under **Settings → Environment Variables**, then **redeploy**
(variables only apply to new deployments).

| Variable | Needed for | Notes |
| --- | --- | --- |
| *(none)* | **The demo** | Runs on the bundled sample agency |
| `APP_URL` | Links in emails | Your production URL, for example `https://reportpilot.vercel.app` |
| `DATABASE_URL` | Real data | Postgres on Neon or Supabase; use the **pooled** connection string. See [deployment.md](deployment.md#1-database) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | PDFs on protected previews | Created by Vercel, see [below](#preview-deployments-and-protection) |
| `SENTRY_DSN` | Error tracking | Optional |

Secrets for the jobs (`GOOGLE_SERVICE_ACCOUNT_JSON`, `RESEND_API_KEY`, the R2
keys) belong in **GitHub Actions secrets**, not in Vercel: the dashboard does
not use them.

---

## PDF downloads on Vercel

The **PDF** button on the review page and the shared report link renders the
report with a real Chromium. Vercel functions have no browser installed, so
on Vercel the app uses [`@sparticuz/chromium`](https://github.com/Sparticuz/chromium),
a Chromium build small enough to run inside a function.

Three details make it reliable, all already in the code:

- **Matching versions.** `@sparticuz/chromium` 153.0.0 is driven by
  `playwright-core` 1.63.0, the release built for Chromium 153. It is
  installed under the alias `playwright-core-serverless` so it does not clash
  with the newer Playwright used locally and in tests. A mismatch crashes on
  launch, so the two are always upgraded together (see
  [Upgrading Chromium on Vercel](../TECHNICAL_README.md#upgrading-chromium-on-vercel)).
- **The browser files are shipped.** `@sparticuz/chromium` unpacks its
  compressed browser at run time, which Next.js file tracing cannot see, so
  `outputFileTracingIncludes` in `next.config.ts` adds those files to the PDF
  function explicitly.
- **A bad flag is removed.** `@sparticuz/chromium`'s default
  `--single-process` flag lets closing one page take the whole browser down;
  the launcher filters it out.

CI proves this path on every push: a smoke test forces the serverless branch
on GitHub's Linux runner and prints a real PDF with `@sparticuz/chromium`.

The first PDF after a quiet period takes a few seconds while the function and
browser start; after that the browser is reused and each report is served
from memory.

---

## Preview deployments and protection

By default Vercel protects **preview** deployments (the URLs for branches and
pull requests) with Vercel Authentication. Pages open fine in your own
browser because you are signed in, but the PDF function fetches the report's
print page itself, and Vercel answers that request with a login screen. The
result is a PDF of the login page.

Production deployments are not protected by default, so PDFs work there with
no setup. To make them work on previews too:

1. Open **Settings → Deployment Protection**.
2. Under **Protection Bypass for Automation** press **Add Secret**, then
   **Save**. Vercel exposes it to the project as
   `VERCEL_AUTOMATION_BYPASS_SECRET` automatically.
3. Redeploy the preview. The PDF route sends the secret in the
   `x-vercel-protection-bypass` header when it prints.

---

## Custom domain

1. **Settings → Domains → Add**, and type your domain, for example
   `reports.youragency.co.uk`.
2. Add the DNS record Vercel shows at your domain registrar: a `CNAME` to
   `cname.vercel-dns.com` for a subdomain, or an `A` record for the root
   domain.
3. Wait for the green tick (usually a few minutes; HTTPS is issued
   automatically).
4. Update `APP_URL` to the new domain and redeploy, so client links in emails
   use it.

---

## Checking the deployment

Open each of these on the live URL:

| URL | Expect |
| --- | --- |
| `/` | The landing page, with the whole hero visible on a laptop screen |
| `/dashboard` | The overview for Northfold Studio |
| `/reports/site_harlow` | The report review with the A4 preview |
| `/api/reports/site_harlow/pdf` | A PDF download (a few seconds the first time) |
| `/r/anything` | The designed 404 page |

Then check the headers of a shared report link:

```bash
curl -sI https://YOUR-URL/r/$(curl -s https://YOUR-URL/ | grep -o '/r/[a-z0-9]*' | head -1 | cut -d/ -f3) | grep -i x-robots
# x-robots-tag: noindex, nofollow
```

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails with *Module not found: @reportpilot/core* | Root directory is the repository root, or files outside the root directory are excluded | Set **Root Directory** to `apps/web` and enable *Include files outside of the Root Directory* |
| Build fails at install with *npm ci can only install with an existing package-lock.json* | The install command ran inside `apps/web` | Keep `apps/web/vercel.json`, or set the install command to `cd ../.. && npm ci` |
| `/api/reports/…/pdf` returns 503 *PDF rendering is unavailable* | The serverless Chromium did not start | Open the function log under **Deployments → your deployment → Functions**. Usually the browser files were not shipped: check `outputFileTracingIncludes` is still in `next.config.ts` |
| The PDF shows a Vercel login page | A protected preview deployment | Add a Protection Bypass for Automation secret, see [above](#preview-deployments-and-protection) |
| The PDF times out | A cold start on a busy region | Try again; the browser stays warm for later requests. The limit is set by `maxDuration` in the route |
| Fonts look different from local | Fonts are downloaded from Google at build time | Redeploy; a network blip during the build can fall back to system fonts |
| Changes to environment variables have no effect | Variables apply to new deployments only | **Deployments → ⋯ → Redeploy** |
