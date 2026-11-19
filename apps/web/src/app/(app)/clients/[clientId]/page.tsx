import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, EnvelopeSimple, Globe, Clock, FileText } from "@phosphor-icons/react/dist/ssr";
import { TrendChart, UptimeStrip, VitalTrend } from "@reportpilot/charts";
import {
  THRESHOLDS, addMonths, formatCls, formatCompact, formatMs, formatPct, formatPeriod, formatPeriodShort, formatPosition,
  formatSeconds, prettyUrl, trailingPeriods, type VitalName,
} from "@reportpilot/core";
import { Topbar } from "@/components/shell/Topbar";
import { PageHeader, SectionHeading } from "@/components/ui/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Monogram } from "@/components/ui/Monogram";
import { Delta } from "@/components/ui/Delta";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusLight } from "@/components/ui/StatusLight";
import { findClient, getWorkspace } from "@/lib/data";
import { ClientToggles } from "@/components/clients/ClientToggles";

export async function generateMetadata({ params }: { params: Promise<{ clientId: string }> }): Promise<Metadata> {
  const ws = await getWorkspace();
  const { clientId } = await params;
  return { title: ws.sites.find((r) => r.client.id === clientId)?.client.name ?? "Client" };
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

const VITALS: Array<{ key: VitalName; label: string; fmt: (v: number | null) => string }> = [
  { key: "lcp", label: "Loading (LCP)", fmt: formatSeconds },
  { key: "inp", label: "Responsiveness (INP)", fmt: formatMs },
  { key: "cls", label: "Stability (CLS)", fmt: formatCls },
];

export default async function ClientPage({ params }: { params: Promise<{ clientId: string }> }) {
  const ws = await getWorkspace();
  const { period } = ws;
  const { client, sites } = findClient(ws, (await params).clientId);
  const row = sites[0]!;
  const { report } = row;
  const s = report.search;
  const months = trailingPeriods(period, 13);

  return (
    <>
      <Topbar crumbs={[{ label: "Clients", href: "/clients" }, { label: client.name }]} period={period} />
      <div className="pt-8 md:pt-10">
        <PageHeader
          eyebrow={<span className="flex items-center gap-2"><Monogram name={client.name} initials={client.initials} size="sm" />{client.sector}</span>}
          title={client.name}
          description={row.narrative.summary}
          actions={<ButtonLink href={`/reports/${row.site.id}`} variant="primary">Open {formatPeriodShort(period)} report<ArrowRight size={15} aria-hidden /></ButtonLink>}
        />

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {s && (
              <section aria-labelledby="kpi-heading">
                <h2 id="kpi-heading" className="sr-only">Search figures</h2>
                <dl className="stagger grid grid-cols-2 border-t-2 border-ink md:grid-cols-4">
                  {s.kpis.map((k, i) => (
                    <div key={k.key} className={`py-4 ${i % 2 ? "pl-4" : "pr-4"} md:px-4 md:first:pl-0 ${i > 0 ? "md:border-l md:border-line" : ""}`}>
                      <dt className="text-small text-ink-3">{k.label}</dt>
                      <dd className="mt-1 font-display text-figure tnum text-ink">
                        {k.key === "ctr" ? formatPct(k.value) : k.key === "position" ? formatPosition(k.value) : formatCompact(k.value)}
                      </dd>
                      <dd className="mt-1"><Delta change={k.mom} direction={k.direction} mode={k.key === "position" ? "abs" : "pct"} label="vs Sep" /></dd>
                    </div>
                  ))}
                </dl>

                <figure className="draw mt-8 rounded-lg bg-raised p-5 shadow-raised">
                  <figcaption className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-body font-semibold text-ink">Organic clicks, last 13 months</span>
                    <span className="flex items-center gap-4 text-micro text-ink-3">
                      <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-accent" />Clicks</span>
                    </span>
                  </figcaption>
                  <TrendChart
                    title={`Monthly organic clicks for ${client.name}`}
                    labels={months.map((m) => `${formatPeriodShort(m)}${m.endsWith("-01") ? ` ${m.slice(2, 4)}` : ""}`)}
                    labelCount={7}
                    height={220}
                    series={[{ name: "Clicks", values: s.kpis[0]!.spark, variant: "primary" }]}
                  />
                </figure>
              </section>
            )}

            <section aria-labelledby="speed-heading" className="mt-12">
              <SectionHeading id="speed-heading" title="Real-visitor speed" meta="Chrome UX Report, 25 weeks" action={<StatusLight light={report.status.speed} showLabel />} />
              {report.speed ? (
                <div className="grid gap-6 sm:grid-cols-3">
                  {VITALS.map((v) => (
                    <div key={v.key}>
                      <p className="text-small text-ink-3">{v.label}</p>
                      <p className="font-display text-title tnum text-ink">{v.fmt(report.speed!.field[v.key])}</p>
                      <div className="draw mt-2"><VitalTrend title={`${v.label} trend`} values={report.speed!.history.map((w) => w[v.key])} good={THRESHOLDS[v.key].good} poor={THRESHOLDS[v.key].poor} /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="max-w-prose text-small text-ink-3">No real-visitor data yet. Chrome only publishes field data once a site has enough traffic; lab scores will appear after the next weekly snapshot.</p>
              )}
            </section>

            {report.uptime && (
              <section aria-labelledby="uptime-heading" className="mt-12">
                <SectionHeading id="uptime-heading" title="Uptime" meta={`${report.uptime.summary.uptimePct.toFixed(2)}% in ${formatPeriod(period)}`} action={<StatusLight light={report.status.reliability} showLabel />} />
                <UptimeStrip title="Daily uptime" days={report.uptime.days} height={36} />
                <div className="mt-2 flex justify-between text-micro text-ink-4"><span>1 Oct</span><span>31 Oct</span></div>
              </section>
            )}

            <section aria-labelledby="history-heading" className="mt-12">
              <SectionHeading id="history-heading" title="Report history" />
              <ul className="divide-y divide-line">
                {[0, 1, 2, 3, 4, 5].map((i) => {
                  const p = addMonths(period, -i);
                  return (
                    <li key={p} className="flex items-center gap-3 py-3">
                      <FileText size={16} className="text-ink-4" aria-hidden />
                      <span className="flex-1 text-body text-ink">{formatPeriod(p)}</span>
                      {i === 0 ? <StatusBadge status={row.status} /> : <StatusBadge status="sent" />}
                      <span className="hidden w-28 text-right text-small text-ink-3 sm:block">{i === 0 ? "This cycle" : `Sent ${client.reportDay + (i % 2)} ${formatPeriodShort(addMonths(p, 1))}`}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          <aside className="flex flex-col gap-8 lg:sticky lg:top-6 lg:self-start">
            <div>
              <h2 className="mb-3 text-small font-semibold text-ink">Contact</h2>
              <p className="text-body text-ink">{client.contact.name}</p>
              <p className="flex items-center gap-1.5 text-small text-ink-3"><EnvelopeSimple size={13} aria-hidden />{client.contact.email}</p>
              {client.contact.bounced && <p className="mt-1 text-micro text-act">Last report email bounced. This address is skipped until it is fixed.</p>}
            </div>
            <div>
              <h2 className="mb-3 text-small font-semibold text-ink">Site</h2>
              <p className="flex items-center gap-1.5 text-body text-ink"><Globe size={14} className="text-ink-3" aria-hidden />{prettyUrl(row.site.url)}</p>
              <p className="mt-1 text-small text-ink-3">Search Console: <span className="font-mono text-[12px]">{row.site.gscProperty}</span></p>
              <p className="mt-3 text-small text-ink-3">Key pages</p>
              <ul className="mt-1 flex flex-col gap-0.5 font-mono text-[12px] text-ink-2">
                {row.site.keyPages.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
            <div>
              <h2 className="mb-3 text-small font-semibold text-ink">Delivery</h2>
              <ul className="flex flex-col gap-2 text-small text-ink-2">
                <li className="flex items-center gap-2"><Clock size={14} className="text-ink-3" aria-hidden />Report on the {ordinal(client.reportDay)}, 06:00 {client.timezone.split("/").at(-1)!.replace("_", " ")} time</li>
              </ul>
              <div className="mt-4"><ClientToggles clientId={client.id} autoSend={client.autoSend} aiEnabled={client.aiEnabled} canEdit={ws.user.role !== "viewer"} /></div>
            </div>
            <div>
              <h2 className="mb-3 text-small font-semibold text-ink">Account manager</h2>
              <p className="flex items-center gap-2 text-body text-ink">
                <span className="flex size-6 items-center justify-center rounded-full bg-accent-soft text-[10px] font-semibold text-accent">{row.manager.initials}</span>
                {row.manager.name}
              </p>
            </div>
            <Link href="/clients" className="text-small text-ink-3 hover:text-accent">← All clients</Link>
          </aside>
        </div>
      </div>
    </>
  );
}
