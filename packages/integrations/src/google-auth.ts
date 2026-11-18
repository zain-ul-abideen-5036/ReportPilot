import { createSign } from "node:crypto";
import { requestJson, type FetchLike } from "./http";

/**
 * Service-account authentication without the googleapis SDK. Each client
 * adds the service account's email to their Search Console property as a
 * Restricted (read-only) user, so there is no OAuth consent screen and no
 * app verification. The key lives in an environment secret, never the repo.
 */

export interface ServiceAccount {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export const SCOPES = {
  searchConsole: "https://www.googleapis.com/auth/webmasters.readonly",
} as const;

const b64url = (input: string | Buffer) =>
  Buffer.from(input).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** Build and sign the JWT assertion (RS256) for the token exchange. */
export function signAssertion(sa: ServiceAccount, scope: string, now = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({
    iss: sa.client_email,
    scope,
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
}

export function parseServiceAccount(json: string | undefined): ServiceAccount {
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  const sa = JSON.parse(json) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) throw new Error("Service account JSON is missing client_email or private_key");
  // Secrets stored in CI often have escaped newlines.
  return { ...sa, private_key: sa.private_key.replace(/\\n/g, "\n") };
}

interface CachedToken { token: string; expiresAt: number }

export class GoogleAuth {
  private cache = new Map<string, CachedToken>();

  constructor(private readonly sa: ServiceAccount, private readonly fetchImpl?: FetchLike) {}

  get email(): string {
    return this.sa.client_email;
  }

  async token(scope: string = SCOPES.searchConsole): Promise<string> {
    const cached = this.cache.get(scope);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const res = await requestJson<{ access_token: string; expires_in: number }>(
      this.sa.token_uri ?? "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: signAssertion(this.sa, scope),
        }),
      },
      { api: "Google OAuth", fetch: this.fetchImpl, retries: 2 },
    );
    this.cache.set(scope, { token: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 });
    return res.access_token;
  }
}
