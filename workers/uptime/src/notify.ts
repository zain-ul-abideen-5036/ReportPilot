import type { MonitoredSite } from "./check";

/** Sends downtime and recovery emails to the site's account manager. */
export interface Notifier {
  down(site: MonitoredSite, cause: string, at: Date): Promise<void>;
  up(site: MonitoredSite, at: Date): Promise<void>;
}

const time = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export function resendNotifier(apiKey: string | undefined, from: string, fallbackTo: string | undefined, fetcher: typeof fetch = fetch): Notifier {
  async function send(to: string | null, subject: string, text: string) {
    const recipient = to ?? fallbackTo;
    if (!apiKey || !recipient) return; // alerts disabled in this environment
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: recipient, subject, text }),
    });
    if (!res.ok) throw new Error(`Resend: ${res.status}`);
  }
  return {
    down: (site, cause, at) =>
      send(site.notify, `Down: ${site.clientName}`, `${site.url} has been down since ${time(at)} (confirmed by a second check 30 seconds later).\n\nCause: ${cause}\n\nYou'll get another email when it recovers.`),
    up: (site, at) =>
      send(site.notify, `Recovered: ${site.clientName}`, `${site.url} is back up as of ${time(at)}. The incident has been closed and will appear in this month's report.`),
  };
}

/** For tests and dry runs. */
export function memoryNotifier() {
  const sent: Array<{ kind: "down" | "up"; siteId: string; cause?: string }> = [];
  const notifier: Notifier = {
    async down(site, cause) { sent.push({ kind: "down", siteId: site.id, cause }); },
    async up(site) { sent.push({ kind: "up", siteId: site.id }); },
  };
  return { notifier, sent };
}
