import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Lightning, Sparkle, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { formatCompact, formatPeriod, prettyUrl } from "@reportpilot/core";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { Delta } from "@/components/ui/Delta";
import { listSites, period } from "@/lib/data";

export const metadata: Metadata = { title: "Clients" };

export default function ClientsPage() {
  const rows = listSites();
  const totalClicks = rows.reduce((n, r) => n + (r.report.search?.kpis[0]?.value ?? 0), 0);
  return (
    <>
      <Topbar crumbs={[{ label: "Clients" }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader
          eyebrow={`${rows.length} clients · ${formatCompact(totalClicks)} organic clicks in ${formatPeriod(period)}`}
          title="Clients"
          description="Each client gets one report per site per month, sent to their contacts from your agency's address."
          actions={<ButtonLink href="/clients/new" variant="primary"><Plus size={15} aria-hidden />Add client</ButtonLink>}
        />
        <ul className="stagger divide-y divide-line border-y border-line">
          {rows.map((row) => {
            const clicks = row.report.search?.kpis[0];
            return (
              <li key={row.client.id}>
                <Link href={`/clients/${row.client.id}`} className="group -mx-3 grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-2 rounded-md px-3 py-4 transition-colors duration-(--duration-fast) hover:bg-sunken/60 md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto]">
                  <Monogram name={row.client.name} initials={row.client.initials} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{row.client.name}</p>
                    <p className="truncate text-small text-ink-3">{row.client.sector} · {prettyUrl(row.site.url)}</p>
                  </div>
                  <div className="col-span-3 col-start-2 row-start-2 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-3 md:col-span-1 md:col-start-auto md:row-start-auto md:w-20 md:justify-end">
                    <span>{row.manager.name}</span>
                    <span>Client since {formatPeriod(row.client.since)}</span>
                  </div>
                  <div className="hidden text-right md:block">
                    {clicks && (
                      <>
                        <p className="tnum font-medium text-ink">{formatCompact(clicks.value)} <span className="font-normal text-ink-3">clicks</span></p>
                        <Delta change={clicks.yoy} label="vs last year" />
                      </>
                    )}
                  </div>
                  <div className="col-start-3 row-start-1 flex items-center gap-2 md:col-start-auto md:row-start-auto md:w-20 md:justify-end">
                    {row.client.autoSend && <span title="Auto-send on" className="flex size-6 items-center justify-center rounded-sm bg-accent-soft text-accent"><Lightning size={13} weight="fill" aria-hidden /><span className="sr-only">Auto-send on</span></span>}
                    {row.client.aiEnabled && <span title="AI wording on" className="flex size-6 items-center justify-center rounded-sm bg-sunken text-ink-3"><Sparkle size={13} weight="fill" aria-hidden /><span className="sr-only">AI wording on</span></span>}
                    <CaretRight size={14} className="text-ink-4 transition-transform duration-(--duration-fast) group-hover:translate-x-0.5" aria-hidden />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
