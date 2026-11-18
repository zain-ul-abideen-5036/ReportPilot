import { Sidebar } from "@/components/shell/Sidebar";
import { currentUser, listAlerts, org, period, statusCounts } from "@/lib/data";
import { formatPeriodShort } from "@reportpilot/core";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const counts = statusCounts();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const openAlerts = listAlerts().filter((a) => a.state === "open").length;
  return (
    <div className="grain min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-(--z-toast) focus:rounded-md focus:bg-raised focus:px-3 focus:py-2 focus:shadow-raised">
        Skip to content
      </a>
      <Sidebar
        orgName={org.name}
        user={{ name: currentUser.name, initials: currentUser.initials, role: currentUser.role }}
        badges={{ review: counts.in_review + counts.draft, alerts: openAlerts }}
        cycle={{ label: `${formatPeriodShort(period)} reports`, sent: counts.sent, total }}
      />
      <div className="min-w-0 flex-1">
        <main id="main" className="mx-auto w-full max-w-[1320px] min-w-0 px-4 pb-16 sm:px-6 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
