# Runbook

What to do when something goes wrong. Each entry starts from what you would
see.

## "Monthly job did not run" email from Healthchecks

1. Open GitHub → Actions → **Monthly reports**. If there is no run, GitHub's
   scheduler skipped it (this happens at busy times). Run it manually.
2. If the run failed, open the log. Lines are JSON; search for
   `"level":"error"`.
3. The pipeline resumes where it stopped, so re-running is always safe.

## A report shows "Needs attention"

A stage failed three times. The pipeline page shows which stage and the last
error.

| Error | Action |
| --- | --- |
| `PageSpeed Insights: 429 Quota exceeded` | Wait an hour and re-run, or approve without the speed section; the report already says it is unavailable |
| `Search Console: 403` | The client removed the service account. Ask them to re-add it ([guide](search-console-setup.md)) |
| `Chromium crashed` / render timeout | Re-run. If it repeats, check the report data for an unusually large table |
| `Resend: 422` | The sender domain is not verified, or a contact address is invalid |

## A site is reported down but loads fine

1. Check the incident cause on the alerts page.
2. `Expected text not found on page` usually means the site changed its
   wording. Update the uptime keyword on the site settings.
3. `Connection timed out` from one check only is filtered by the two-failure
   rule; if incidents open, the site really failed twice, 30 seconds apart.

## Search Console figures differ from the report

- The report uses `dataState: final`; the Search Console interface may show
  fresher, provisional data.
- Query and page tables exclude anonymised queries, so they sum to less than
  the site totals. The appendix explains this to clients.
- Average position is impression-weighted across the month, matching
  Search Console's own calculation.

## Re-sending a report

A sent report cannot be sent again from the dashboard: the workflow allows
`approved → sent` once, so neither a re-run nor a double click can email a
client twice. If a client needs it again, forward the PDF (every sent version
is kept in R2 under `reports/<org>/<site>/<period>/v<n>.pdf`) or share the
web link from the review page.

## A report email bounced

1. The alerts page shows **Report email to … bounced**, and the client page
   marks the contact.
2. Correct the address with the client. Until then the pipeline skips that
   contact, so next month's report is not sent into the void.
3. If bounces never appear at all, check the Resend webhook points at
   `/api/webhooks/resend` and that `RESEND_WEBHOOK_SECRET` matches; an unsigned
   or stale request gets a 401.

## "Daily job did not run" email from Healthchecks

Open GitHub → Actions → **Daily alerts**. The job only runs on schedule when
the repository variable `ENABLE_JOBS` is `true`. Each site is independent,
so one failing site is logged and the rest still get their alerts. Alerts are
deduplicated, so re-running it is safe and does not send duplicate emails.

## A new client's first report has no year-on-year figures

The 16-month backfill has not run yet. It runs on the next daily job, or
straight away from **Actions → Backfill Search Console history** with the site
id. A site is marked backfilled only when every month succeeded, so gaps are
retried the next day.

## Nobody can sign in

- No email arrives: check `RESEND_API_KEY` and the `AUTH_EMAIL_FROM` domain.
  Without a key, the link is printed to the server log.
- "That sign-in link has expired": links last 15 minutes and work once. Ask
  for a new one.
- Everyone was signed out: `AUTH_SECRET` changed, which invalidates every
  session. That is also how to sign everyone out on purpose.

## Rotating secrets

1. Create the new key (service account key, Resend key, R2 token).
2. Update the GitHub secret, the Vercel variable and, for the worker,
   `wrangler secret put`. Rotating `AUTH_SECRET` signs everyone out.
3. Run the monthly workflow in dry-run mode to confirm.
4. Delete the old key at the provider.
