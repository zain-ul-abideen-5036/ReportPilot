import { formatPeriod, prettyUrl, type Narrative } from "@reportpilot/core";
import type { PipelineSite } from "../store";

/**
 * The deliver stage: an email with a short summary in the body, the PDF
 * attached, a private web link, and a plain-text alternative.
 */

export interface Email {
  from: string;
  to: string[];
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  attachments: Array<{ filename: string; content: string }>;
  headers: Record<string, string>;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function composeEmail(site: PipelineSite, period: string, narrative: Narrative, link: string, pdf: Uint8Array, reportId: string): Email {
  const month = formatPeriod(period);
  const first = site.contacts[0]?.name.split(" ").filter((w) => !/^(dr|mr|mrs|ms|mx)$/i.test(w))[0] ?? "there";
  const subject = `Your ${month} website report: ${prettyUrl(site.url)}`;
  const highlights = narrative.highlights.slice(0, 3);
  const { primary } = site.brand;

  const text = [
    `Hi ${first},`,
    "",
    narrative.summary,
    "",
    ...highlights.map((h) => `- ${h}`),
    "",
    `The full report is attached as a PDF. You can also read it online (link valid for 90 days):`,
    link,
    "",
    `${site.managerName}`,
    site.brand.name,
    "",
    site.brand.footer,
  ].join("\n");

  const html = `<!doctype html><html lang="en-GB"><body style="margin:0;background:#f5f3ee;font-family:Helvetica,Arial,sans-serif;color:#1b1d1b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden">
<tr><td style="height:6px;background:${primary}"></td></tr>
<tr><td style="padding:32px 36px 8px;font-size:13px;color:#7b7f7a">${esc(site.brand.name)} · ${esc(month)}</td></tr>
<tr><td style="padding:0 36px;font-family:Georgia,serif;font-size:26px;line-height:1.2">Your ${esc(month)} report for ${esc(site.clientName)}</td></tr>
<tr><td style="padding:20px 36px 0;font-size:15px;line-height:1.6">Hi ${esc(first)},</td></tr>
<tr><td style="padding:12px 36px 0;font-size:15px;line-height:1.6">${esc(narrative.summary)}</td></tr>
<tr><td style="padding:12px 36px 0"><ul style="margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:#4b4f4b">${highlights.map((h) => `<li style="margin:6px 0">${esc(h)}</li>`).join("")}</ul></td></tr>
<tr><td style="padding:28px 36px"><a href="${esc(link)}" style="display:inline-block;background:${primary};color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px">Read the full report</a>
<p style="margin:12px 0 0;font-size:12px;color:#7b7f7a">The PDF is attached too. This link is private to you and expires in 90 days.</p></td></tr>
<tr><td style="padding:0 36px 32px;font-size:14px;line-height:1.5">${esc(site.managerName)}<br><span style="color:#7b7f7a">${esc(site.brand.name)}</span></td></tr>
</table>
<p style="font-size:11px;color:#a3a7a1;margin:16px 0 0">${esc(site.brand.footer)}</p>
</td></tr></table></body></html>`;

  return {
    from: `${site.brand.senderName} <${site.brand.senderEmail}>`,
    to: site.contacts.map((c) => c.email),
    replyTo: site.brand.senderEmail,
    subject,
    html,
    text,
    attachments: [{ filename: `${site.clientName} - ${month}.pdf`.replace(/[^\w .&-]/g, ""), content: Buffer.from(pdf).toString("base64") }],
    // Lets bounce webhooks find the report again.
    headers: { "X-Entity-Ref-ID": reportId },
  };
}

export type Sender = (email: Email) => Promise<{ id: string }>;

export function resendSender(apiKey: string, fetcher: typeof fetch = fetch): Sender {
  return async (email) => {
    const res = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: email.from, to: email.to, reply_to: email.replyTo, subject: email.subject,
        html: email.html, text: email.text, attachments: email.attachments, headers: email.headers,
      }),
    });
    if (!res.ok) throw new Error(`Resend: ${res.status} ${await res.text()}`);
    return (await res.json()) as { id: string };
  };
}
