import { requestJson, type FetchLike } from "./http";

/**
 * Domain expiry from RDAP, the free, structured replacement for WHOIS.
 * rdap.org redirects to the right registry for each TLD.
 */

interface RdapResponse {
  events?: Array<{ eventAction: string; eventDate: string }>;
}

export function registrableDomain(url: string): string {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const parts = host.split(".");
  // Handle common two-part public suffixes such as co.uk and com.au.
  const twoPart = /^(co|org|ac|gov|com|net)\.[a-z]{2}$/.test(parts.slice(-2).join("."));
  return parts.slice(twoPart ? -3 : -2).join(".");
}

export function parseExpiry(json: RdapResponse): string | null {
  const event = json.events?.find((e) => e.eventAction === "expiration");
  return event ? new Date(event.eventDate).toISOString() : null;
}

export async function domainExpiry(url: string, fetchImpl?: FetchLike): Promise<string | null> {
  const domain = registrableDomain(url);
  const json = await requestJson<RdapResponse>(`https://rdap.org/domain/${domain}`, { headers: { accept: "application/rdap+json" } }, {
    api: "RDAP", fetch: fetchImpl, retries: 2,
  });
  return parseExpiry(json);
}
