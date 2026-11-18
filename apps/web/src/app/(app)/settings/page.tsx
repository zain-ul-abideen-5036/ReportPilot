import type { Metadata } from "next";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { BrandingStudio } from "@/components/settings/BrandingStudio";
import { getSite, now, org, period } from "@/lib/data";

export const metadata: Metadata = { title: "Branding" };

export default function SettingsPage() {
  const row = getSite("site_harlow")!;
  return (
    <>
      <Topbar crumbs={[{ label: "Settings" }, { label: "Branding" }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader
          eyebrow="White label"
          title="Your brand on every report"
          description="Clients see your name, colours and address, never ours. Changes apply to the next reports generated."
        />
        <BrandingStudio
          initial={{ name: org.name, primary: org.primary, accent: org.accent, senderName: org.senderName, senderEmail: org.senderEmail, footer: org.footer }}
          sample={{ report: row.report, narrative: row.narrative, client: row.client.name, preparedBy: row.manager.name, generatedAt: now.toISOString() }}
        />
      </div>
    </>
  );
}
