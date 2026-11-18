import type { Metadata } from "next";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { Wizard } from "@/components/onboarding/Wizard";
import { period } from "@/lib/data";

export const metadata: Metadata = { title: "Add client" };

export default function NewClientPage() {
  return (
    <>
      <Topbar crumbs={[{ label: "Clients", href: "/clients" }, { label: "Add client" }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader className="mx-auto max-w-2xl" title="Add a client" description="About five minutes. The first report is ready as soon as Search Console is connected." />
        <Wizard />
      </div>
    </>
  );
}
