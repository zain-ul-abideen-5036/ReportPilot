/**
 * fetch with the reliability rules every collector shares: a timeout,
 * exponential backoff with jitter on 429 and 5xx, and errors that say
 * which API failed and why. The fetch implementation is injectable so
 * contract tests can replay recorded responses without touching Google.
 */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class ApiError extends Error {
  constructor(
    public readonly api: string,
    public readonly status: number,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(`${api}: ${status} ${message}`);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  api: string;
  fetch?: FetchLike;
  retries?: number;
  timeoutMs?: number;
  /** Base delay for backoff; tests pass 0. */
  baseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function backoffDelay(attempt: number, base: number, retryAfter?: string | null): number {
  const header = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(header) && header > 0) return Math.min(header * 1000, 60_000);
  const exp = base * 2 ** attempt;
  return Math.min(exp + Math.random() * base, 30_000);
}

export async function requestJson<T>(url: string, init: RequestInit, opts: RequestOptions): Promise<T> {
  const doFetch = opts.fetch ?? (globalThis.fetch as FetchLike);
  const retries = opts.retries ?? 3;
  const sleep = opts.sleep ?? defaultSleep;
  const base = opts.baseDelayMs ?? 500;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await doFetch(url, { ...init, signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000) });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status >= 500;
      const body = await res.text().catch(() => "");
      const message = extractMessage(body) ?? res.statusText;
      const err = new ApiError(opts.api, res.status, message, retryable);
      if (!retryable || attempt === retries) throw err;
      lastError = err;
      await sleep(backoffDelay(attempt, base, res.headers.get("retry-after")));
    } catch (err) {
      if (err instanceof ApiError && !err.retryable) throw err;
      if (attempt === retries) throw err instanceof ApiError ? err : new ApiError(opts.api, 0, String((err as Error).message ?? err), true);
      lastError = err;
      await sleep(backoffDelay(attempt, base));
    }
  }
  throw lastError;
}

function extractMessage(body: string): string | null {
  try {
    const json = JSON.parse(body) as { error?: { message?: string } | string };
    if (typeof json.error === "string") return json.error;
    return json.error?.message ?? null;
  } catch {
    return body ? body.slice(0, 200) : null;
  }
}
