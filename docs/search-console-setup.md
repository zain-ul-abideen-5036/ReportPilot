# Connecting Search Console

ReportPilot reads Search Console through a Google Cloud **service account**.
Clients grant it read-only access to their property; there is no "Sign in
with Google" step and no OAuth verification. See
[ADR 0002](adr/0002-service-account-auth.md) for why.

## One-time setup (agency)

1. In the [Google Cloud console](https://console.cloud.google.com/), create a
   project, for example `reportpilot-prod`.
2. Enable the **Google Search Console API** and the **PageSpeed Insights API**
   (APIs & Services → Library). Enable the **Chrome UX Report API** too.
3. Create a service account (IAM & Admin → Service accounts). It needs no
   project roles.
4. Create a JSON key for it and download it once.
5. Store the whole JSON as the `GOOGLE_SERVICE_ACCOUNT_JSON` secret in GitHub
   (Settings → Secrets and variables → Actions). Never commit it; gitleaks
   will block the push if you try.
6. Create an API key (APIs & Services → Credentials), restrict it to
   PageSpeed Insights and Chrome UX Report, and store it as
   `PAGESPEED_API_KEY`.

## Per client

The onboarding wizard shows these steps with the service account's address
and a copy button:

1. In Search Console, open the client's property.
2. Settings → Users and permissions → **Add user**.
3. Paste the service account email and choose **Restricted**.
4. Back in ReportPilot, press **Test connection**.

A `sc-domain:` property (the whole domain) is preferred over a URL-prefix
property because it includes every subdomain and protocol.

## Quotas to know

| API | Limit | How ReportPilot stays inside it |
| --- | --- | --- |
| Search Analytics | 1,200 queries a minute per site | About 20 requests per site per month |
| URL Inspection | 2,000 a day per property | Up to 5 key pages a week |
| PageSpeed Insights | 25,000 a day | 6 pages × 2 strategies × 3 runs = 36 per site a week |
| CrUX History | 150 a minute | One request per site a week |

## Troubleshooting

| Message | Meaning |
| --- | --- |
| `Search Console: 403 User does not have sufficient permission` | The service account has not been added to this property, or was added to a different property type |
| `Search Console has not finalised 2026-10 yet` | Normal on the 2nd. The pipeline waits and tries again the next day |
| `CrUX History: 404` | The site has too little Chrome traffic to be in the dataset. The report says "no real-visitor data yet" |
