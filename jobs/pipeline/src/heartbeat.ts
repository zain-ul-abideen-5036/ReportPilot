/**
 * Healthchecks.io pings at start and finish. If the monthly job doesn't
 * run, or starts and never finishes, Healthchecks emails us. Silent when
 * no URL is configured, so local runs need nothing.
 */
export interface Heartbeat {
  start(): Promise<void>;
  success(summary?: string): Promise<void>;
  fail(summary?: string): Promise<void>;
}

export function healthchecks(url: string | undefined, fetcher: typeof fetch = fetch): Heartbeat {
  const ping = async (suffix: string, body?: string) => {
    if (!url) return;
    try {
      await fetcher(`${url.replace(/\/$/, "")}${suffix}`, { method: "POST", body, signal: AbortSignal.timeout(10_000) });
    } catch {
      // A failed ping must never fail the job; Healthchecks will notice the silence.
    }
  };
  return {
    start: () => ping("/start"),
    success: (s) => ping("", s),
    fail: (s) => ping("/fail", s),
  };
}
