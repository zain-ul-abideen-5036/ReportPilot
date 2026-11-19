import { formatPeriodShort } from "@reportpilot/core";
import { Sidebar } from "@/components/shell/Sidebar";
import { getWorkspace, statusCounts } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await getWorkspace();
  const counts = statusCounts(ws);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const openAlerts = ws.alerts.filter((a) => a.state === "open").length;
  return (
    <div className="grain min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-(--z-toast) focus:rounded-md focus:bg-raised focus:px-3 focus:py-2 focus:shadow-raised">
        Skip to content
      </a>
      <Sidebar
        orgName={ws.org.name}
        orgInitials={ws.org.initials}
        demo={ws.mode === "demo"}
        user={{ name: ws.user.name, initials: ws.user.initials, role: ws.user.role }}
        badges={{ review: counts.in_review + counts.draft, alerts: openAlerts }}
        cycle={{ label: `${formatPeriodShort(ws.period)} reports`, sent: counts.sent, total }}
      />
      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto w-full max-w-[1320px] min-w-0 px-4 pb-16 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
