# Deployment

Everything below fits in free tiers. Allow about an hour the first time.

## 1. Database

1. Create a Postgres database on [Neon](https://neon.tech) or
   [Supabase](https://supabase.com). Choose a region near your clients.
2. Copy the **pooled** connection string into `DATABASE_URL`.
3. Apply the schema and, optionally, the demo agency:

   ```bash
   DATABASE_URL=… npm run migrate -w @reportpilot/db
   DATABASE_URL=… npm run seed -w @reportpilot/db     # optional
   ```

4. On Supabase, also apply the row-level security policies:

   ```bash
   psql "$DATABASE_URL" -f packages/db/sql/row-level-security.sql
   ```

## 2. Dashboard

**Vercel** is the quickest: import the repository, set the root directory to
`apps/web` and deploy. PDF downloads work there out of the box. The full
walkthrough is in **[vercel-deployment.md](vercel-deployment.md)**.

Vercel's Hobby plan is free for non-commercial use; for paying clients use a
Pro plan, or **Cloudflare**, which allows commercial use on its free plan.
Either way the dashboard builds from `apps/web` with `npm run build`.

Set `DATABASE_URL`, `AUTH_SECRET` (32 or more random characters, e.g.
`openssl rand -hex 32`), `APP_URL` and `RESEND_API_KEY` (for sign-in links
and Send now). Without `DATABASE_URL` the dashboard runs in demo mode with the
sample agency, which is how the public demo is hosted; the demo accounts are
switched off as soon as a database is configured.

Members sign in with a one-time email link. The seed script creates the
sample agency's people; for your own agency, insert your users and
memberships (role `owner`, `manager` or `viewer`) with SQL until an
invitation screen exists.

**Delivery and bounces.** In Resend, add a webhook to
`https://<your-app>/api/webhooks/resend` for `email.delivered`,
`email.bounced` and `email.complained`, and set its signing secret as
`RESEND_WEBHOOK_SECRET`. Set `EMAIL_MODE=test` on preview deployments so
nothing reaches real clients.

## 3. Uptime worker

```bash
cd workers/uptime
npx wrangler login
npx wrangler secret put DATABASE_URL
npx wrangler secret put RESEND_API_KEY
npx wrangler deploy
```

The cron triggers in `wrangler.toml` start immediately. To deploy from CI
instead, add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets and
set the repository variable `DEPLOY_WORKER=true`.

## 4. Scheduled jobs

The monthly, weekly, daily-alerts and backfill workflows run on GitHub
Actions. Add these repository secrets:

| Secret | Used by |
| --- | --- |
| `DATABASE_URL` | monthly, weekly, daily, backfill |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | monthly, weekly, daily, backfill |
| `PAGESPEED_API_KEY` | weekly |
| `RESEND_API_KEY` | monthly, daily |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | monthly |
| `GEMINI_API_KEY` (optional) | monthly |
| `HEALTHCHECK_MONTHLY_URL`, `HEALTHCHECK_DAILY_URL` (optional) | monthly, daily |
| `SENTRY_DSN` (optional) | all |

and the repository variables `APP_URL`, `ALERT_FROM` and `ENABLE_JOBS=true`
(the daily alerts job stays off on forks without it).

The monthly workflow wakes hourly from the 1st to the 8th; each site is
processed once its client's report day reaches 06:00 in their time zone, and
scheduled runs exit within seconds when no `DATABASE_URL` is set. New sites
get their 16-month backfill from the next daily run, or straight away if the
dashboard has `GITHUB_DISPATCH_TOKEN` (a fine-grained token with *Actions:
write*) and `GITHUB_REPOSITORY`.

Before the first real run, trigger **Monthly reports** manually with
*dry run* ticked. The generated PDFs and email previews are attached to the
run as an artifact.

## 5. Email

1. Add your sending domain in [Resend](https://resend.com).
2. Publish the SPF, DKIM and DMARC records it gives you. Without them,
   reports land in spam.
3. Set the agency's sender address in **Branding** to an address on that
   domain.

## 6. Monitoring

- Create two checks on [Healthchecks.io](https://healthchecks.io): the
  monthly job (expected on the report days, grace period 2 hours) in
  `HEALTHCHECK_MONTHLY_URL`, and the daily job (daily, grace 2 hours) in
  `HEALTHCHECK_DAILY_URL`.
- Add a [Sentry](https://sentry.io) DSN as `SENTRY_DSN` for the server, jobs
  and worker (`wrangler secret put SENTRY_DSN`), and as
  `NEXT_PUBLIC_SENTRY_DSN` at build time for browser errors. Only error
  messages and stack traces are sent; no report data or contacts.
