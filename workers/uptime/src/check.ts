/**
 * One uptime check. A site counts as up only when it answers with a
 * success status *and* the page contains the expected text. A 200 that
 * renders "Error establishing a database connection" is down.
 */

export interface MonitoredSite {
  id: string;
  url: string;
  keyword: string | null;
  state: "up" | "down";
  openIncidentId: string | null;
  clientName: string;
  notify: string | null;
}

export interface CheckResult {
  ok: boolean;
  status: number | null;
  ms: number;
  error: string | null;
}

export type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const ERROR_SIGNATURES = [
  /error establishing a database connection/i,
  /service unavailable/i,
  /502 bad gateway/i,
  /this site can.t be reached/i,
];

export async function checkSite(site: Pick<MonitoredSite, "url" | "keyword">, fetcher: Fetcher = fetch, timeoutMs = 10_000, now = () => Date.now()): Promise<CheckResult> {
  const started = now();
  try {
    const res = await fetcher(site.url, {
      redirect: "follow",
      headers: { "user-agent": "ReportPilot-Uptime/1.0 (+https://reportpilot.app/uptime)", accept: "text/html" },
      signal: AbortSignal.timeout(timeoutMs),
      cf: { cacheTtl: 0 },
    } as RequestInit);
    const ms = now() - started;
    if (res.status >= 400) return { ok: false, status: res.status, ms, error: `HTTP ${res.status} ${res.statusText}`.trim() };
    // Read at most ~512 KB; enough to find a brand name, cheap on CPU.
    const body = (await res.text()).slice(0, 512_000);
    if (site.keyword && !body.toLowerCase().includes(site.keyword.toLowerCase())) {
      return { ok: false, status: res.status, ms, error: "Expected text not found on page" };
    }
    const signature = ERROR_SIGNATURES.find((r) => r.test(body.slice(0, 20_000)));
    if (!site.keyword && signature) return { ok: false, status: res.status, ms, error: "Page shows an error message" };
    return { ok: true, status: res.status, ms, error: null };
  } catch (err) {
    const ms = now() - started;
    const name = (err as Error).name;
    const error = name === "TimeoutError" || name === "AbortError" ? `Connection timed out after ${Math.round(timeoutMs / 1000)} s` : (err as Error).message;
    return { ok: false, status: null, ms, error };
  }
}
