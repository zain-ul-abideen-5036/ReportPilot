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

**Cloudflare** (free, commercial use allowed) or **Vercel Hobby**
(free, non-commercial). Both build `apps/web` with `npm run build`.

Set `DATABASE_URL` and `APP_URL`. Without `DATABASE_URL` the dashboard runs
in demo mode with the sample agency, which is how the public demo is hosted.

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

The monthly and weekly workflows run on GitHub Actions. Add these repository
secrets:

| Secret | Used by |
| --- | --- |
| `DATABASE_URL` | monthly, weekly |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | monthly, weekly |
| `PAGESPEED_API_KEY` | weekly |
| `RESEND_API_KEY` | monthly |
| `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | monthly |
| `GEMINI_API_KEY` (optional) | monthly |
| `HEALTHCHECK_MONTHLY_URL` (optional) | monthly |

and the repository variable `APP_URL`.

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

- Create a check on [Healthchecks.io](https://healthchecks.io) with a
  schedule of "monthly, 2nd to 4th" and a grace period of 2 hours. Put its
  ping URL in `HEALTHCHECK_MONTHLY_URL`.
- Add a [Sentry](https://sentry.io) DSN as `SENTRY_DSN` for error tracking.
