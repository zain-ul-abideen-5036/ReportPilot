import type { Metadata } from "next";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Wizard } from "@/components/onboarding/Wizard";
import { getWorkspace } from "@/lib/data";

export const metadata: Metadata = { title: "Add client" };

/** The address clients add to Search Console, read from the configured key so the guide can never show the wrong one. */
function serviceAccountEmail(): string {
  try {
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (json) return (JSON.parse(json) as { client_email?: string }).client_email ?? "";
  } catch {
    // fall through to the demo address
  }
  return "reports@reportpilot-demo.iam.gserviceaccount.com";
}

export default async function NewClientPage() {
  const ws = await getWorkspace();
  const { period } = ws;
  return (
    <>
      <Topbar crumbs={[{ label: "Clients", href: "/clients" }, { label: "Add client" }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader className="mx-auto max-w-2xl" title="Add a client" description="About five minutes. The first report is ready as soon as Search Console is connected." />
        <Wizard demo={ws.mode === "demo"} serviceAccount={process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? serviceAccountEmail()} canEdit={ws.user.role !== "viewer"} />
      </div>
    </>
  );
}
