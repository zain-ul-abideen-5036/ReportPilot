# Security policy

## Reporting a vulnerability

Please report security issues privately through GitHub's
[security advisories](https://github.com/zain-ul-abideen-5036/ReportPilot/security/advisories/new)
rather than a public issue. You'll get a reply within a few days.

Helpful details: what you found, how to reproduce it, and what an attacker
could do with it.

## What is in scope

- Access to another organisation's clients or reports
- Guessing, reusing or extending private report links
- Leaking secrets (service account keys, API keys) through logs, errors or
  the client bundle
- Injection into the PDF or email templates

## How the project protects itself

- Google access is read-only through a Restricted service account.
- Secrets live in GitHub Actions secrets and hosting environment variables;
  gitleaks scans every push.
- Every query is scoped by organisation; optional Postgres row-level
  security policies are provided.
- Report links use random 128-bit tokens, expire after 90 days, can be
  revoked, and are served with `noindex` and `no-referrer`.
- The dashboard sends `X-Frame-Options: DENY`, `X-Content-Type-Options:
  nosniff` and a restrictive `Permissions-Policy`.
- Dependabot keeps dependencies current.
