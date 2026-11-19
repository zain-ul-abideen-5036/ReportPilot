import type { Metadata } from "next";
import { EnvelopeSimple, Flask } from "@phosphor-icons/react/dist/ssr";
import { composeEmail } from "@reportpilot/report/email";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { getWorkspace } from "@/lib/data";
import { timeAgo } from "@/lib/time";

export const metadata: Metadata = { title: "Sent emails" };

/**
 * Emails captured in test mode: the demo, or a deployment with
 * EMAIL_MODE=test or no Resend key. Each one is shown exactly as the
 * client would receive it, built by the same function the pipeline uses.
 */
export default async function OutboxPage() {
  const ws = await getWorkspace();
  const testMode = ws.mode === "demo" || !process.env.RESEND_API_KEY || process.env.EMAIL_MODE === "test";
  const emails = ws.outbox.map((m) => {
    const row = ws.sites.find((r) => r.site.id === m.siteId);
    const html = row
      ? composeEmail(
          { clientName: row.client.name, url: row.site.url, contacts: [row.client.contact], managerName: row.manager.name, brand: { name: ws.org.name, primary: ws.org.primary, footer: ws.org.footer, senderName: ws.org.senderName, senderEmail: ws.org.senderEmail } },
          ws.period, row.narrative, row.shareToken ? `/r/${row.shareToken}` : "#", new Uint8Array(), row.reportId,
        ).html
      : null;
    return { ...m, html, client: row?.client.name ?? "Unknown client" };
  });

  return (
    <>
      <Topbar crumbs={[{ label: "Sent emails" }]} period={ws.period} />
      <div className="pt-8 md:pt-10">
        <PageHeader
          eyebrow={testMode ? "Test mode" : "Live sending"}
          title="Sent emails"
          description={testMode
            ? "Nothing leaves this server. Every report email is captured here instead, exactly as the client would see it, with the PDF attached in real sending."
            : "Reports are sent through Resend. Emails captured while EMAIL_MODE=test was on are listed here."}
        />
        {testMode && (
          <p className="mb-8 flex max-w-2xl items-start gap-2 rounded-md bg-watch-soft p-3 text-small text-ink-2">
            <Flask size={16} className="mt-0.5 shrink-0 text-watch" aria-hidden />
            Approve a report and press Send now to see its email appear here.
          </p>
        )}
        {emails.length === 0 ? (
          <p className="py-10 text-center text-small text-ink-3">No emails captured yet.</p>
        ) : (
          <ul className="flex flex-col gap-8">
            {emails.map((m, i) => (
              <li key={`${m.siteId}-${m.at}`} className="rounded-lg bg-raised p-4 shadow-raised sm:p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="flex items-center gap-2 font-medium text-ink"><EnvelopeSimple size={16} className="text-ink-3" aria-hidden />{m.subject}</p>
                  <span className="text-micro text-ink-3">{timeAgo(m.at)}</span>
                </div>
                <p className="mt-1 text-small text-ink-3">To {m.to} · {m.client} · PDF attached</p>
                {m.html && (
                  <iframe
                    title={`Email preview ${i + 1}: ${m.subject}`}
                    srcDoc={m.html}
                    sandbox=""
                    className="mt-4 h-[560px] w-full rounded-md bg-sunken hairline"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
