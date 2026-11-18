# ReportPilot: design specification

**Automated monthly client reports for web agencies**

| | |
| --- | --- |
| Author | Zain Ul Abideen |
| Status | MVP implemented; see [Delivery status](#12-delivery-status) |
| Last updated | November 2026 |
| Repository | [github.com/zain-ul-abideen-5036/ReportPilot](https://github.com/zain-ul-abideen-5036/ReportPilot) |

---

## Summary

Every month, each client of a web agency receives a branded PDF covering
their search performance, site speed and uptime, with a plain-English summary
of what changed and what to do next. ReportPilot produces that report
automatically, holds it for an account manager to review and approve, and
sends it. It runs entirely on free tiers.

The design goal is not only to automate the work but to do it more reliably
than a person would: the same day every month, the same calculations every
time, honest about missing data, and with alerts between reports when
something breaks.

---

## 1. The problem

Agencies typically spend **two to four hours per client per month** on
reporting: exporting Search Console data, running PageSpeed, checking uptime,
pasting screenshots into slides, writing commentary and emailing it. With 20
clients that is 40 to 80 hours a month of repetitive work, and the result
varies with whoever wrote it that month.

ReportPilot reduces this to about **ten minutes per client**, the time to read
the draft, add a note and approve. It also does three things a manual process
rarely manages:

- reports go out on the same day every month;
- figures are calculated identically every time, so months can be compared;
- problems are caught when they happen, not at the end of the month.

### Users

| Role | Needs |
| --- | --- |
| Agency owner | Brand settings, client list, delivery overview |
| Account manager | Review drafts, add commentary, approve and send, see alerts |
| Client (read-only) | Receives the PDF and a private web link; never needs an account |

---

## 2. Scope

### MVP (implemented)

- Multi-client dashboard: agency → clients → sites
- Integrations: Google Search Console, PageSpeed Insights, Chrome UX Report
  History, uptime checks every five minutes, SSL and domain expiry
- Monthly pipeline: collect → calculate → write → render → review → send
- White-label branding: logo, colours, sender name and footer per agency
- Approval workflow: Draft → In review → Approved → Sent, with manager notes
- Alerts between reports: downtime, SSL or domain expiring, traffic drops,
  Core Web Vitals regressions, key pages dropping out of the index

### Later (v2)

- GA4 (Analytics Data API) for sessions, conversions and traffic sources
- Client portal with report history
- Weekly "pulse" emails; Slack and Teams alerts
- White-label custom domain for report links

### Out of scope

Paid search, social media and Bing data; billing; multi-region uptime probes.

---

## 3. Architecture

```
                         ┌──────────────────────────────┐
                         │  Dashboard (Next.js)          │
                         │  clients · drafts · approvals │
                         │  branding · alerts · pipeline │
                         └──────────────┬───────────────┘
                                        │
                              ┌─────────▼─────────┐
                              │  Postgres          │
                              │  (Neon / Supabase) │
                              └──┬───────┬───────┬─┘
                 every 5 min     │       │       │     monthly (2nd–4th, 06:00)
        ┌────────────────────────┘       │       └──────────────────────────┐
┌───────▼─────────┐             weekly   │               ┌──────────────────▼───────────┐
│ Uptime worker    │      ┌──────────────▼───────┐       │ Report pipeline               │
│ Cloudflare cron  │      │ Snapshot job          │       │ GitHub Actions + Playwright   │
│ HTTP + keyword   │      │ PageSpeed median of 3 │       │ collect · calculate ·         │
│ → incidents      │      │ CrUX · URL Inspection │       │ insights · narrative ·        │
│ → alerts         │      │ SSL and domain expiry │       │ render · review · deliver     │
└──────────────────┘      └───────────────────────┘       └──────────────┬───────────────┘
                                                                         │ on approval
                                                             ┌───────────▼───────────┐
                                                             │ Resend: email + PDF    │
                                                             │ + private web link     │
                                                             └────────────────────────┘
```

**Why it is split this way**

- Uptime needs a frequent schedule, so it runs on Cloudflare Workers' free
  cron triggers.
- PDF rendering needs a real Chromium and runs once a month, so it runs on
  GitHub Actions, where minutes are free.
- The dashboard is an ordinary web app.
- Every pipeline stage writes its result to the database, so a failed run
  resumes from where it stopped instead of starting again.

The dashboard's report preview and the PDF are rendered from **the same React
components**, so what the account manager approves is exactly what the client
receives.

---

## 4. Technology and cost

| Layer | Choice | Free limit (check current terms) | Notes |
| --- | --- | --- | --- |
| Dashboard | Next.js 15, React 19, Tailwind v4 | Free | Vercel Hobby is non-commercial; Cloudflare allows commercial use |
| Database | Postgres on Neon or Supabase | About 0.5 GB | Store aggregates, not raw rows (§7) |
| ORM | Drizzle | Free | Migrations generated from the schema |
| Uptime | Cloudflare Workers cron | 100,000 requests a day | 50 sites × 288 checks = 14,400 |
| Jobs | GitHub Actions | 2,000 min a month (private repo) | Monthly run ≈ 1–2 min per site |
| PDF | Playwright `page.pdf()` | Free | Tagged and outlined for accessibility |
| Charts | Hand-written server-rendered SVG | Free | Crisp in print, no runtime JavaScript |
| Files | Cloudflare R2 | 10 GB, no egress fees | Versioned keys per report |
| Email | Resend | 3,000 a month, 100 a day | SPF, DKIM and DMARC on the sending domain |
| AI wording (optional) | Gemini free tier | Rate-limited | Template fallback and number check (§9) |
| Heartbeat | Healthchecks.io | 20 checks | Alerts if the monthly job doesn't run |
| CI and security | GitHub Actions, Dependabot, gitleaks | Free | |

**Running cost: £0** for a portfolio deployment or a small agency with up to
about 50 sites.

---

## 5. Data sources

### Google Search Console

- **Authentication.** A Google Cloud service account. Each client adds its
  email to their Search Console property as a *Restricted* user. This avoids
  OAuth app verification and is read-only by design; clients can revoke it at
  any time.
- **Endpoints.** `searchanalytics.query` (date, query, page, device, country,
  with `dataState: "final"`), `sitemaps.list`, and the URL Inspection API for
  key pages (quota: 2,000 a day per property).
- **Timing.** Data lags two to three days. The job runs on the 2nd, 3rd and
  4th; a site whose month is not final yet waits and is retried.
- **Paging.** Up to 25,000 rows per request, with `startRow` pagination.

### PageSpeed Insights and the Chrome UX Report

- Lighthouse lab results plus real-visitor field data, free with an API key.
- Lab scores vary between runs, so the weekly job runs each key page **three
  times and keeps the median**, for mobile and desktop, homepage plus up to
  five key pages.
- The CrUX History API provides 25 weeks of real-visitor LCP, INP and CLS, so
  trend lines need no history of our own.

### Uptime (built in-house)

- A Worker requests each site every five minutes and records status, response
  time and errors. A site counts as **up only if the page contains expected
  text** (for example the brand name): a 200 response showing an error page
  is down.
- **Confirmation rule:** an incident opens only after two consecutive
  failures, the second a re-check 30 seconds later. This keeps false alarms
  out of inboxes.
- Daily rollups store uptime %, average and p95 response time and incident
  count. Raw checks are kept for 90 days.

### SSL and domain expiry

Certificate expiry from the TLS handshake; domain expiry from RDAP, the free,
structured replacement for WHOIS.

---

## 6. The report

A branded A4 PDF of eight pages:

1. **Cover**: agency mark, client, site, month, prepared by.
2. **Executive summary**: three status lights (search, speed, reliability),
   three to five plain-English highlights, and a KPI scorecard (clicks,
   impressions, CTR, average position) with month-on-month and
   year-on-year change and 13-month sparklines.
3. **Search performance**: daily clicks against the previous month, top
   queries and pages, biggest movers, device split, branded vs non-branded.
4. **Opportunities**: striking-distance keywords (positions 8–20 with real
   demand), pages with a CTR below half of what their position usually earns,
   keywords entering or leaving the top 10, and indexing health.
5. **Page speed**: real-visitor Core Web Vitals with 25-week trends, lab
   scores, and the top three speed opportunities.
6. **Uptime and reliability**: uptime %, daily strip, response-time trend,
   incident timeline, days until SSL and domain renewal.
7. **Next month**: the account manager's note and ranked recommendations.
8. **Appendix**: definitions, method, known limits and data freshness.

**Partial data is handled honestly.** If PageSpeed fails, that page says
"Speed data unavailable this month" rather than showing zeros or failing the
whole report.

**Delivery.** An email with a short summary in the body, the PDF attached, a
private web link (random 128-bit token, expires in 90 days, `noindex`), and a
plain-text alternative.

---

## 7. Data model

```
organizations(id, name, brand_logo_key, brand_primary, brand_accent, sender_name, sender_email, footer)
users(id, email, name)        memberships(user_id, org_id, role: owner|manager|viewer)
clients(id, org_id, name, contacts jsonb, timezone, report_day, manager_id, auto_send, ai_enabled, status)
sites(id, client_id, url, gsc_property, branded_regex, key_pages text[], uptime_keyword, active)

uptime_checks(site_id, checked_at, ok, status, ms, error)          raw, kept 90 days
uptime_daily(site_id, day, uptime_pct, avg_ms, p95_ms, incidents)  rollup, kept forever
incidents(id, site_id, started_at, resolved_at, cause, notified_at)
tls_domain(site_id, cert_expires_at, issuer, domain_expires_at, checked_at)

gsc_daily(site_id, day, clicks, impressions, ctr, position)
gsc_monthly_query(site_id, month, query, …)                        top 1,000 a month
gsc_monthly_page(site_id, month, page, …)                          top 500 a month
gsc_monthly_dim(site_id, month, dimension, key, clicks, impressions)
psi_runs(site_id, url, strategy, run_date, perf_score, lcp, cls, tbt, fcp, opportunities jsonb)
crux_weekly(site_id, url_or_origin, week, form_factor, lcp_p75, inp_p75, cls_p75)
index_status(site_id, url, checked_at, verdict, coverage_state, last_crawl)

reports(id, site_id, period, status, collected, data, narrative, manager_notes, pdf_key,
        share_token, share_expires_at, approved_by, approved_at, sent_at, version)
        unique (site_id, period)
job_runs(id, kind, site_id, period, stage, status, attempts, error, started_at, finished_at)
audit_log(id, org_id, user_id, action, entity, entity_id, at, meta jsonb)
alerts(id, site_id, kind, severity, state, title, detail, dedupe_key, raised_at, resolved_at)
```

**Storage discipline.** Monthly aggregates, not every row Search Console
returns: 50 sites × 1,000 queries × 12 months is about 600,000 rows, which
fits comfortably in a free database.

---

## 8. The monthly pipeline

| Stage | What happens | Reliability measure |
| --- | --- | --- |
| 0 Plan | Create one report per active site, keyed on `site_id + period` | Idempotent: a unique index means re-running never duplicates |
| 1 Collect | Search Console (this month, last month, same month last year), speed snapshot, uptime rollups, indexing | Sources are independent; exponential backoff on 429 and 5xx |
| 2 Calculate | Changes, striking distance, movers, branded split, uptime, Core Web Vitals | Pure functions with unit tests: same input, same output |
| 3 Insights | A rules engine produces ranked findings, each carrying its figures | Findings can only quote their own figures |
| 4 Narrative | Templates phrase the findings; AI optionally rewrites the summary | Number check: any figure not in the source → AI text discarded |
| 5 Render | HTML with brand tokens → Playwright PDF (A4, tagged, outlined) | Size check; saved to R2 under a versioned key |
| 6 Review | Draft appears in the dashboard; the manager adds a note and approves, or auto-send is on | Every change is versioned and audit-logged |
| 7 Deliver | Email with PDF and private link | Retries; bounces flag the contact; dry-run mode |
| 8 Monitor | Heartbeat pings at start and finish | An email if the job didn't run or stalled |

---

## 9. Security, privacy and compliance

- **Least privilege.** The service account is a Restricted (read-only)
  Search Console user.
- **Secrets** live in GitHub Actions secrets and hosting environment
  variables, never in the repository; gitleaks scans every push.
- **Access control.** Every query is scoped by organisation; optional
  Postgres row-level security policies are provided for Supabase. Roles:
  owner, manager, viewer.
- **Report links.** Random 128-bit tokens with expiry and revocation,
  `noindex` and `no-referrer` headers.
- **GDPR.** We store business metrics, not personal data. Client contact
  emails are the only personal data; they are documented and deletable.
  Raw uptime data is kept for 90 days.
- **AI privacy.** Free AI tiers may use inputs to improve their products, so
  only aggregated metrics are sent, never contact details, and AI can be
  turned off per client.
- **Email authentication.** SPF, DKIM and DMARC on the sending domain.

---

## 10. Quality and engineering practice

- **Unit tests (Vitest)** for every calculation with known answers; the
  spec's example, 1,000 → 1,200 clicks is +20.0%, is a test.
- **Contract tests** against recorded API responses, so tests never call Google.
- **End-to-end tests (Playwright)** for the review flow, onboarding, alerts,
  reduced motion and `noindex` links, on desktop and mobile.
- **PDF visual regression**: each report page compared with an approved
  snapshot.
- **Dry-run mode** generates every report without sending.
- **CI on every push**: typecheck, tests, build, end-to-end, secret scan.
- **Accessibility**: WCAG 2.2 AA dashboard, tagged PDF with a heading
  outline, status always shown with an icon and a label as well as colour.

---

## 11. Onboarding a client

1. Add the client: name, contact, time zone, report day.
2. Add the site: URL, up to five key pages, brand terms, uptime keyword.
3. Connect Search Console: the app shows the service-account email and a
   three-step guide; *Test connection* confirms access.
4. Uptime starts immediately; 16 months of Search Console history are
   backfilled so the first report already has year-on-year comparisons.
5. *Generate sample report* produces the PDF in about a minute.

---

## 12. Delivery status

| Week | Milestone | Status |
| --- | --- | --- |
| 1 | Repository, CI, schema, organisations, clients, sites | Done |
| 2 | Uptime worker, incidents, alerts, SSL and domain checks | Done |
| 3 | Search Console via service account, aggregates | Done |
| 4 | PageSpeed median of three, CrUX history, sitemaps, URL Inspection | Done |
| 5 | Calculations and insights engine with unit tests | Done |
| 6 | Report template, SVG charts, PDF rendering, storage | Done |
| 7 | Review and approval flow, delivery, private links, branding | Done (demo mode) |
| 8 | Narrative with number check, dry run, visual tests, docs, demo data | Done |

**Known gaps** are listed honestly in the [README](../README.md#known-gaps).
The most significant: dashboard actions update local state in demo mode and
are not yet persisted through server actions, and authentication is not yet
wired to a provider.

---

## 13. Success measures

| Measure | How it is measured |
| --- | --- |
| Time saved | Manual reporting minutes vs review-and-approve minutes per client |
| Reliability | Reports delivered on schedule, job success rate, average retries |
| Accuracy | Report figures match the Search Console interface (spot-check five sites) |
| Alert quality | False-positive rate of downtime alerts under the two-failure rule |
| Client value | Opportunities surfaced per report (striking-distance keywords, low-CTR pages) |

---

## 14. Constraints

- Search Console covers organic Google search only, not ads, Bing or
  analytics. GA4 is the v2 answer.
- Search Console data is two to three days behind and anonymises rare
  queries, so query totals never quite equal site totals. The appendix says so.
- Uptime runs from one region. Cloudflare's network makes it reliable, but it
  is not true multi-region monitoring.
- Free tiers change their limits and terms. Vercel Hobby is non-commercial;
  Cloudflare is the commercial-safe free option.
- PageSpeed lab scores vary. The median of three reduces this but does not
  remove it.

---

## Why this is production-grade rather than a prototype

- an approval workflow, versioned and audit-logged;
- jobs that can safely re-run and resume;
- a number check on AI-written text;
- service-account authentication that avoids OAuth verification;
- data-retention discipline;
- honest handling of partial failures;
- heartbeat monitoring of scheduled jobs;
- visual regression tests for the PDF.
