# Privacy and data handling

ReportPilot processes website performance data on behalf of agencies. This
page records what is stored, why, for how long, and who can see it. It is
the basis for an agency's own privacy notice to its clients.

## What we store

| Data | Personal? | Purpose | Retention |
| --- | --- | --- | --- |
| Search Console aggregates (clicks, impressions, CTR, position by day, top queries and pages) | No | Monthly reports | Kept while the client is active |
| PageSpeed and Chrome UX Report figures | No | Speed section of the report | Kept while the client is active |
| Raw uptime checks (status, response time, error text) | No | Incident detection | **90 days**, then deleted nightly |
| Daily uptime rollups and incidents | No | Uptime section and history | Kept while the client is active |
| Client contact names and email addresses | **Yes** | Delivering reports | Until the client or contact is removed |
| Agency user names and email addresses | **Yes** | Signing in, audit log | Until the user is removed |
| Audit log entries | Indirectly (user ids) | Accountability for approvals and sends | Kept with the organisation |

Search Console query data is aggregated by Google and anonymises rare
queries; ReportPilot never receives information about individual searchers.

## Where it is processed

- **Database:** Postgres on Neon or Supabase (EU region recommended for UK
  and EU agencies).
- **PDF storage:** Cloudflare R2.
- **Email:** Resend.
- **Optional AI wording:** Google Gemini. Only the template summary and
  highlights are sent, which contain aggregated metrics, never contact
  details. Free AI tiers may use inputs to improve their models, which is why
  AI can be turned off per client.

## Access

- Agency users see only their own organisation's clients. Every query is
  scoped by organisation; optional row-level security policies enforce the
  same rule in the database.
- Clients never have accounts. They receive a PDF and a private link: a
  random 128-bit token that expires after 90 days, can be revoked, and is
  served with `noindex` and `no-referrer` headers.
- Google access is read-only (a Restricted Search Console user) and can be
  revoked by the client at any time.

## Requests

- **Deletion:** removing a contact deletes their name and email; removing a
  client deletes all of that client's data through cascading foreign keys.
- **Access:** an agency owner can export a client's stored data from the
  database on request.
- **Bounces:** an email that bounces marks the contact so reports stop going
  to it; the address is not retained elsewhere.
