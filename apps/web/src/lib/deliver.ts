import "server-only";
import { composeEmail } from "@reportpilot/report/email";
import { printSignature } from "./auth/server";
import { r2FromEnv } from "./r2";
import type { OrgView, SiteRow } from "./data";

/**
 * "Send now" from the dashboard, with a database configured. Prints the
 * report exactly as the pipeline would, stores the PDF as a new version
 * in R2, and sends it through Resend. With EMAIL_MODE=test or no Resend
 * key, the email is captured instead of sent.
 */
export async function deliverFromDashboard({ row, org, period, origin }: { row: SiteRow; org: OrgView; period: string; origin: string }) {
  const { printUrlToPdf } = await import("@reportpilot/report/pdf");
  const exp = Math.floor(Date.now() / 1000) + 300;
  const sig = await printSignature(row.site.id, exp);
  const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  const pdf = await printUrlToPdf(`${origin}/print/${row.site.id}?exp=${exp}&sig=${sig}`, {
    headers: bypass ? { "x-vercel-protection-bypass": bypass } : {},
  });

  const version = row.version + 1;
  const r2 = r2FromEnv();
  const pdfKey = r2 ? await r2.put(`reports/${org.id}/${row.site.id}/${period}/v${version}.pdf`, pdf, "application/pdf") : null;

  const link = `${origin}/r/${row.shareToken}`;
  const email = composeEmail(
    {
      clientName: row.client.name,
      url: row.site.url,
      contacts: [row.client.contact],
      managerName: row.manager.name,
      brand: { name: org.name, primary: org.primary, footer: org.footer, senderName: org.senderName, senderEmail: org.senderEmail },
    },
    period, row.narrative, link, pdf, row.reportId,
  );

  const key = process.env.RESEND_API_KEY;
  if (!key || process.env.EMAIL_MODE === "test") return { captured: true, deliveryId: null, pdfKey };
  const { resendSender } = await import("@reportpilot/integrations");
  const { id } = await resendSender(key)(email);
  return { captured: false, deliveryId: id, pdfKey };
}
