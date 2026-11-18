import Link from "next/link";
import { Sparkline } from "@reportpilot/charts";
import { formatCompact, prettyUrl } from "@reportpilot/core";
import type { SiteRow } from "@/lib/data";
import { Delta } from "@/components/ui/Delta";
import { Monogram } from "@/components/ui/Monogram";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusLight } from "@/components/ui/StatusLight";

function Lights({ row }: { row: SiteRow }) {
  const s = row.report.status;
  return (
    <span className="flex gap-1">
      <StatusLight light={s.search} area="Search" />
      <StatusLight light={s.speed} area="Speed" />
      <StatusLight light={s.reliability} area="Reliability" />
    </span>
  );
}

/**
 * Every site at a glance. A real table on wide screens; on phones each row
 * becomes a compact card with the same fields in the same order.
 */
export function PortfolioTable({ rows }: { rows: SiteRow[] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-lg bg-raised shadow-raised md:block">
        <table className="w-full text-left text-body">
          <thead>
            <tr className="border-b border-line text-small text-ink-3">
              <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Client</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Health</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Clicks</th>
              <th scope="col" className="hidden px-3 py-2.5 font-medium xl:table-cell"><span className="sr-only">13-month trend</span></th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Uptime</th>
              <th scope="col" className="py-2.5 pr-5 pl-3 font-medium">Report</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const clicks = row.report.search?.kpis.find((k) => k.key === "clicks");
              const uptime = row.report.uptime?.summary.uptimePct;
              return (
                <tr key={row.site.id} className="group relative transition-colors duration-(--duration-fast) hover:bg-surface">
                  <td className="py-3 pr-3 pl-5">
                    <Link href={`/reports/${row.site.id}`} className="flex items-center gap-3 after:absolute after:inset-0">
                      <Monogram name={row.client.name} initials={row.client.initials} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{row.client.name}</span>
                        <span className="block truncate text-small text-ink-3">{prettyUrl(row.site.url)}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3"><Lights row={row} /></td>
                  <td className="px-3 py-3 text-right">
                    {clicks ? (
                      <>
                        <span className="block tnum font-medium text-ink">{formatCompact(clicks.value)}</span>
                        <Delta change={clicks.mom} />
                      </>
                    ) : <span className="text-ink-4">n/a</span>}
                  </td>
                  <td className="hidden px-3 py-3 xl:table-cell">
                    {clicks && <Sparkline values={clicks.spark} width={104} height={28} label={`Clicks, last 13 months`} />}
                  </td>
                  <td className="px-3 py-3 text-right tnum">
                    {uptime !== undefined ? (
                      <span className={uptime < 99.9 ? "text-watch" : "text-ink-2"}>{uptime.toFixed(2)}%</span>
                    ) : <span className="text-ink-4">n/a</span>}
                  </td>
                  <td className="py-3 pr-5 pl-3"><StatusBadge status={row.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="stagger flex flex-col gap-2 md:hidden">
        {rows.map((row) => {
          const clicks = row.report.search?.kpis.find((k) => k.key === "clicks");
          return (
            <li key={row.site.id}>
              <Link href={`/reports/${row.site.id}`} className="press block rounded-lg bg-raised p-4 shadow-raised">
                <div className="flex items-start gap-3">
                  <Monogram name={row.client.name} initials={row.client.initials} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{row.client.name}</p>
                    <p className="truncate text-small text-ink-3">{prettyUrl(row.site.url)}</p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-micro text-ink-3">Clicks</p>
                    <p className="tnum font-display text-title text-ink">{clicks ? formatCompact(clicks.value) : "n/a"}</p>
                    {clicks && <Delta change={clicks.mom} />}
                  </div>
                  {clicks && <Sparkline values={clicks.spark} width={96} height={30} />}
                  <Lights row={row} />
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
