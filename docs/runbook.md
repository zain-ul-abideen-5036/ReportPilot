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

Reports are never sent twice automatically. To resend, open the report,
withdraw approval, approve again and press **Send now**. The audit log
records both sends.

## Rotating secrets

1. Create the new key (service account key, Resend key, R2 token).
2. Update the GitHub secret and, for the worker, `wrangler secret put`.
3. Run the monthly workflow in dry-run mode to confirm.
4. Delete the old key at the provider.
