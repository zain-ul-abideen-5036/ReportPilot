# 0002: Service-account authentication for Search Console

**Status:** accepted

## Context

The obvious way to read a client's Search Console data is a "Connect with
Google" OAuth flow. The `webmasters.readonly` scope is sensitive, so a public
app needs Google's verification, which takes weeks and involves a privacy
review. Tokens also expire and need refresh handling per client.

## Decision

Use one Google Cloud service account. During onboarding the app shows its
email address; the client adds it to their property as a **Restricted**
user. The pipeline signs a JWT with the service account key (RS256 with
Node's `crypto`, no SDK) and exchanges it for a one-hour token.

## Consequences

- No verification process; it works the day the project is deployed.
- Read-only by construction, and the client can revoke access in two clicks.
- One more onboarding step for the client. The wizard explains it in three
  steps and offers a *Test connection* button.
- The key is a high-value secret. It lives only in GitHub Actions secrets
  and is covered by a dedicated gitleaks rule.
