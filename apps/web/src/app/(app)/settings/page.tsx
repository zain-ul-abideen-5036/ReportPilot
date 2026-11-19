import type { Metadata } from "next";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrandingStudio } from "@/components/settings/BrandingStudio";
import { getWorkspace } from "@/lib/data";

export const metadata: Metadata = { title: "Branding" };

export default async function SettingsPage() {
  const ws = await getWorkspace();
  const { period, org } = ws;
  const row = ws.sites.find((r) => r.site.id === "site_harlow") ?? ws.sites[0];
  return (
    <>
      <Topbar crumbs={[{ label: "Settings" }, { label: "Branding" }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader
          eyebrow="White label"
          title="Your brand on every report"
          description="Clients see your name, colours and address, never ours. Changes apply to the next reports generated."
        />
        {row ? (
          <BrandingStudio
            initial={{ name: org.name, primary: org.primary, accent: org.accent, senderName: org.senderName, senderEmail: org.senderEmail, footer: org.footer, logoUrl: org.logoUrl }}
            sample={{ report: row.report, narrative: row.narrative, client: row.client.name, preparedBy: row.manager.name, generatedAt: row.generatedAt }}
            canManage={ws.user.role === "owner"}
            demo={ws.mode === "demo"}
          />
        ) : (
          <p className="text-body text-ink-3">Add a client first. The preview uses one of their reports.</p>
        )}
      </div>
    </>
  );
}
