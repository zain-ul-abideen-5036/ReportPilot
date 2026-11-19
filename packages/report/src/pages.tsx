import { Sparkline, SplitBar, TrendChart, UptimeStrip, VitalTrend, splitTone } from "@reportpilot/charts";
import {
  THRESHOLDS, formatCls, formatCompact, formatDayShort, formatDuration, formatInt, formatMs, formatPct,
  formatPosition, formatSeconds, prettyUrl, urlPath, type Kpi, type VitalName,
} from "@reportpilot/core";
import { ChangeText, Kicker, LightTile, Page, Unavailable } from "./parts";
import type { ReportContext } from "./types";

const DEVICE: Record<string, string> = { MOBILE: "Mobile", DESKTOP: "Desktop", TABLET: "Tablet" };
const COUNTRY: Record<string, string> = {
  gbr: "United Kingdom", irl: "Ireland", usa: "United States", aus: "Australia", deu: "Germany", fra: "France", esp: "Spain",
  can: "Canada", nld: "Netherlands", ind: "India", pak: "Pakistan", nzl: "New Zealand", ita: "Italy", bel: "Belgium",
  swe: "Sweden", che: "Switzerland", pol: "Poland", prt: "Portugal", are: "UAE", zaf: "South Africa", sgp: "Singapore", zzz: "Unknown",
};

/** Search Console reports countries as ISO 3166 alpha-3 codes ("gbr"). */
export function countryName(code: string): string {
  return COUNTRY[code.toLowerCase()] ?? code.toUpperCase();
}

function kpiValue(k: Kpi): string {
  if (k.key === "ctr") return formatPct(k.value);
  if (k.key === "position") return formatPosition(k.value);
  return formatCompact(k.value);
}

/* 01 · Cover ------------------------------------------------------------ */

export function Cover({ ctx }: { ctx: ReportContext }) {
  return (
    <section id="page-1" className="rp-page rp-cover" aria-label="Cover">
      <div className="rp-cover-band" />
      <div className="rp-cover-inner">
        <div className="rp-cover-brand">
          {ctx.org.logoUrl
            ? <img src={ctx.org.logoUrl} alt="" height={30} />
            : <span className="rp-cover-logo">{ctx.org.initials ?? ctx.org.name.slice(0, 2).toUpperCase()}</span>}
          {ctx.org.name}
        </div>
        <div className="rp-cover-main">
          {ctx.client.logoUrl && <img className="rp-cover-client-logo" src={ctx.client.logoUrl} alt={`${ctx.client.name} logo`} />}
          <p className="rp-cover-month">Monthly report · {ctx.monthLabel}</p>
          <h1 className="rp-cover-client">{ctx.client.name}</h1>
          <p className="rp-cover-sub">Search, speed and reliability for {prettyUrl(ctx.report.siteUrl)}</p>
          <dl className="rp-cover-meta">
            <div><dt>Prepared by</dt><dd>{ctx.preparedBy}</dd></div>
            <div><dt>Reporting period</dt><dd>{ctx.monthLabel}</dd></div>
            <div><dt>Data</dt><dd>{ctx.report.freshness.searchFinal ? "Final" : "Provisional"}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}

/* 02 · Executive summary ----------------------------------------------- */

export function Summary({ ctx }: { ctx: ReportContext }) {
  const { report, narrative } = ctx;
  const clicks = report.search?.kpis.find((k) => k.key === "clicks");
  const vitals = report.speed?.assessment.passes;
  const up = report.uptime?.summary;
  return (
    <Page ctx={ctx} folio={2}>
      <Kicker index="01">Executive summary</Kicker>
      <h2 className="rp-title">{ctx.monthLabel} at a glance</h2>
      <p className="rp-lede">{narrative.summary}</p>

      <div className="rp-section rp-lights">
        <LightTile area="Search" light={report.status.search}
          note={clicks?.mom.pct != null ? `Clicks ${clicks.mom.pct >= 0 ? "up" : "down"} ${Math.abs(clicks.mom.pct * 100).toFixed(1)}% on last month` : "Search data unavailable"} />
        <LightTile area="Speed" light={report.status.speed}
          note={vitals === true ? "Passes Core Web Vitals" : vitals === false ? "Fails Core Web Vitals" : "Speed data unavailable"} />
        <LightTile area="Reliability" light={report.status.reliability}
          note={up ? `${up.uptimePct.toFixed(2)}% uptime, ${up.incidentCount} ${up.incidentCount === 1 ? "outage" : "outages"}` : "Uptime data unavailable"} />
      </div>

      <div className="rp-section">
        <h3 className="rp-h3">What happened this month</h3>
        <ol className="rp-highlights">
          {narrative.highlights.map((h) => <li key={h}>{h}</li>)}
        </ol>
      </div>

      {report.search && (
        <div className="rp-section" style={{ marginTop: "auto" }}>
          <h3 className="rp-h3">Scorecard <span>month on month, year on year, last 13 months</span></h3>
          <div className="rp-kpis">
            {report.search.kpis.map((k) => (
              <div className="rp-kpi" key={k.key}>
                <p className="rp-kpi-label">{k.label}</p>
                <p className="rp-kpi-value">{kpiValue(k)}</p>
                <div className="rp-kpi-deltas">
                  <div><ChangeText change={k.mom} direction={k.direction} mode={k.key === "position" ? "abs" : "pct"} /> <span>vs last month</span></div>
                  <div><ChangeText change={k.yoy} direction={k.direction} mode={k.key === "position" ? "abs" : "pct"} /> <span>vs last year</span></div>
                </div>
                <div className="rp-kpi-spark">
                  <Sparkline values={k.spark} width={140} height={30} invert={k.key === "position"} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Page>
  );
}

/* 03 · Search performance ---------------------------------------------- */

export function Search({ ctx }: { ctx: ReportContext }) {
  const s = ctx.report.search;
  return (
    <Page ctx={ctx} folio={3}>
      <Kicker index="02">Search performance</Kicker>
      <h2 className="rp-title">How people found the site on Google</h2>
      {!s ? (
        <div className="rp-section"><Unavailable title="Search data unavailable this month">Search Console could not be reached. The next report will include both months.</Unavailable></div>
      ) : (
        <>
          <figure className="rp-section">
            <h3 className="rp-h3">Daily clicks <span>solid: {ctx.monthLabel} · dashed: previous month</span></h3>
            <TrendChart
              title={`Daily organic clicks in ${ctx.monthLabel}`}
              width={674} height={128}
              labels={s.daily.map((d) => formatDayShort(d.day))}
              series={[
                { name: "Previous month", values: s.dailyPrevious.map((d) => d.clicks), variant: "ghost" },
                { name: "Clicks", values: s.daily.map((d) => d.clicks), variant: "primary" },
              ]}
            />
            <h3 className="rp-h3" style={{ marginTop: 6 }}>Daily impressions <span>how often the site appeared in results</span></h3>
            <TrendChart
              title={`Daily impressions in ${ctx.monthLabel}`}
              width={674} height={78} labelCount={4}
              labels={s.daily.map((d) => formatDayShort(d.day))}
              series={[
                { name: "Previous month", values: s.dailyPrevious.map((d) => d.impressions), variant: "ghost" },
                { name: "Impressions", values: s.daily.map((d) => d.impressions), variant: "secondary" },
              ]}
            />
          </figure>

          <div className="rp-section rp-grid-2">
            <div>
              <h3 className="rp-h3">Top search terms</h3>
              <table className="rp-table">
                <thead><tr><th>Query</th><th className="num">Clicks</th><th className="num">Pos.</th></tr></thead>
                <tbody>
                  {s.topQueries.slice(0, 8).map((q) => (
                    <tr key={q.query}><td className="label">{q.query}</td><td className="num">{formatInt(q.clicks)}</td><td className="num">{formatPosition(q.position)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="rp-h3">Top pages</h3>
              <table className="rp-table">
                <thead><tr><th>Page</th><th className="num">Clicks</th><th className="num">CTR</th></tr></thead>
                <tbody>
                  {s.topPages.slice(0, 8).map((p) => (
                    <tr key={p.page}><td className="label">{urlPath(p.page)}</td><td className="num">{formatInt(p.clicks)}</td><td className="num">{formatPct(p.ctr)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rp-section rp-grid-2">
            <div>
              <h3 className="rp-h3">Biggest movers <span>pages, clicks vs last month</span></h3>
              <table className="rp-table">
                <tbody>
                  {[...s.pageMovers.gainers.slice(0, 3), ...s.pageMovers.losers.slice(0, 3)].map((m) => (
                    <tr key={m.key}>
                      <td className="label">{urlPath(m.key)}</td>
                      <td className={`num ${m.delta > 0 ? "rp-up" : "rp-down"}`}>{m.delta > 0 ? "+" : "−"}{formatInt(Math.abs(m.delta))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <h3 className="rp-h3">Devices and countries <span>share of clicks</span></h3>
              <SplitBar title="Clicks by device" parts={s.devices.map((d) => ({ label: d.key, value: d.clicks }))} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr", gap: 14, marginTop: 8 }}>
                <table className="rp-table">
                  <tbody>
                    {s.devices.map((d, i) => (
                      <tr key={d.key}>
                        <td><span className="rp-dot" style={{ background: splitTone(i), marginRight: 6 }} />{DEVICE[d.key] ?? d.key}</td>
                        <td className="num">{formatPct(d.share, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <table className="rp-table">
                  <tbody>
                    {s.countries.slice(0, 4).map((c) => (
                      <tr key={c.key}>
                        <td className="label">{countryName(c.key)}</td>
                        <td className="num">{formatPct(c.share, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {s.branded && (
                <p className="rp-muted" style={{ marginTop: 12, fontSize: 10 }}>
                  <strong style={{ color: "var(--rp-ink)" }}>{formatPct(s.branded.nonBrandedShare, 0)}</strong> of clicks came from people who did not search for the brand by name.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

/* 04 · Opportunities ----------------------------------------------------- */

export function Opportunities({ ctx }: { ctx: ReportContext }) {
  const s = ctx.report.search;
  const ix = ctx.report.indexing;
  return (
    <Page ctx={ctx} folio={4}>
      <Kicker index="03">Opportunities</Kicker>
      <h2 className="rp-title">Where the next clicks will come from</h2>
      <p className="rp-lede">Search terms close to page one, and pages Google already shows but people rarely click. Both are usually cheaper to improve than new content.</p>
      {s ? (
        <>
          <div className="rp-section">
            <h3 className="rp-h3">One push from page one <span>positions 8–20, by impressions</span></h3>
            <table className="rp-table">
              <thead><tr><th>Search term</th><th className="num">Impressions</th><th className="num">Clicks</th><th className="num">Position</th></tr></thead>
              <tbody>
                {s.strikingDistance.slice(0, 7).map((q) => (
                  <tr key={q.query}><td className="label">{q.query}</td><td className="num">{formatInt(q.impressions)}</td><td className="num">{formatInt(q.clicks)}</td><td className="num">{formatPosition(q.position)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rp-section">
            <h3 className="rp-h3">Seen often, clicked rarely <span>CTR below half of what the position usually earns</span></h3>
            {s.lowCtr.length ? (
              <table className="rp-table">
                <thead><tr><th>Page</th><th className="num">Impressions</th><th className="num">CTR</th><th className="num">Expected</th><th className="num">Missed clicks</th></tr></thead>
                <tbody>
                  {s.lowCtr.slice(0, 5).map((p) => (
                    <tr key={p.page}><td className="label">{urlPath(p.page)}</td><td className="num">{formatInt(p.impressions)}</td><td className="num rp-down">{formatPct(p.ctr)}</td><td className="num">{formatPct(p.expectedCtr)}</td><td className="num">{formatInt(p.missedClicks)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="rp-muted">No pages fall below the expected click-through rate this month.</p>}
          </div>
          <div className="rp-section rp-grid-2">
            <div>
              <h3 className="rp-h3">New on page one</h3>
              {s.topTen.entered.length ? (
                <ul>{s.topTen.entered.slice(0, 5).map((q) => <li key={q.query} style={{ padding: "4px 0", borderBottom: "1px solid var(--rp-line)" }}><span className="rp-up">{"↑"}</span> {q.query} <span className="rp-muted">· {formatPosition(q.position)}</span></li>)}</ul>
              ) : <p className="rp-muted">None this month.</p>}
            </div>
            <div>
              <h3 className="rp-h3">Dropped off page one</h3>
              {s.topTen.dropped.length ? (
                <ul>{s.topTen.dropped.slice(0, 5).map((q) => <li key={q.query} style={{ padding: "4px 0", borderBottom: "1px solid var(--rp-line)" }}><span className="rp-down">{"↓"}</span> {q.query} <span className="rp-muted">· was {formatPosition(q.previousPosition)}</span></li>)}</ul>
              ) : <p className="rp-muted">None this month.</p>}
            </div>
          </div>
        </>
      ) : <div className="rp-section"><Unavailable title="Search data unavailable this month">Opportunities need Search Console data.</Unavailable></div>}

      {ix && (
        <div className="rp-section" style={{ marginTop: "auto" }}>
          <h3 className="rp-h3">Indexing health <span>key pages in Google's index, and sitemap errors</span></h3>
          <table className="rp-table">
            <tbody>
              {ix.pages.map((p) => (
                <tr key={p.url}>
                  <td className="label">{urlPath(p.url)}</td>
                  <td className={p.verdict === "PASS" ? "rp-up" : p.verdict === "FAIL" ? "rp-down" : "rp-flat"}>{p.verdict === "PASS" ? "✓ Indexed" : p.verdict === "FAIL" ? "✕ Not indexed" : "Partly"}</td>
                  <td className="rp-muted">{p.coverageState}</td>
                </tr>
              ))}
              {ix.sitemaps.map((m) => (
                <tr key={m.path}>
                  <td className="label">Sitemap {urlPath(m.path)}</td>
                  <td className={m.errors > 0 ? "rp-down" : m.warnings > 0 ? "rp-flat" : "rp-up"}>
                    {m.errors > 0 ? `✕ ${formatInt(m.errors)} ${m.errors === 1 ? "error" : "errors"}` : m.warnings > 0 ? `${formatInt(m.warnings)} ${m.warnings === 1 ? "warning" : "warnings"}` : "✓ No errors"}
                  </td>
                  <td className="rp-muted">{formatInt(m.submitted)} URLs submitted{m.errors > 0 && m.warnings > 0 ? ` · ${formatInt(m.warnings)} warnings` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Page>
  );
}

/* 05 · Page speed -------------------------------------------------------- */

const VITAL_META: Record<VitalName, { label: string; plain: string; fmt: (v: number | null) => string }> = {
  lcp: { label: "Largest Contentful Paint", plain: "How quickly the main content appears", fmt: formatSeconds },
  inp: { label: "Interaction to Next Paint", plain: "How quickly the page responds to a tap", fmt: formatMs },
  cls: { label: "Cumulative Layout Shift", plain: "How much the layout jumps while loading", fmt: formatCls },
};
const VERDICT = { good: "Good", "needs-improvement": "Needs work", poor: "Poor", unknown: "No data" } as const;
const VERDICT_CLS = { good: "rp-good", "needs-improvement": "rp-watch", poor: "rp-act", unknown: "rp-unknown" } as const;

export function Speed({ ctx }: { ctx: ReportContext }) {
  const sp = ctx.report.speed;
  return (
    <Page ctx={ctx} folio={5}>
      <Kicker index="04">Page speed</Kicker>
      <h2 className="rp-title">How fast the site feels to real visitors</h2>
      {!sp ? (
        <div className="rp-section"><Unavailable title="Speed data unavailable this month">PageSpeed Insights did not return results for this site. Real-visitor data appears once the site has enough Chrome traffic.</Unavailable></div>
      ) : (
        <>
          <p className="rp-lede">
            Measured from real Chrome users over the last 28 days (75th percentile, mobile).
            {sp.assessment.passes ? " The site passes all three Core Web Vitals." : " Google counts a page as passing when all three are good."}
          </p>
          <div className="rp-section rp-grid-3">
            {(Object.keys(VITAL_META) as VitalName[]).map((name) => {
              const meta = VITAL_META[name];
              const rating = sp.assessment.ratings[name];
              return (
                <div className="rp-vital" key={name}>
                  <div className="rp-vital-name"><span>{meta.label}</span><span>{name.toUpperCase()}</span></div>
                  <div className="rp-vital-value">{meta.fmt(sp.field[name])}</div>
                  <div className={`rp-vital-verdict ${VERDICT_CLS[rating]}`}><span className="rp-dot" />{VERDICT[rating]}</div>
                  <VitalTrend title={`${name.toUpperCase()} over 25 weeks`} values={sp.history.map((w) => w[name])} good={THRESHOLDS[name].good} poor={THRESHOLDS[name].poor} width={200} height={54} />
                  <p className="rp-muted" style={{ marginTop: 6, fontSize: 9.5 }}>{meta.plain}</p>
                </div>
              );
            })}
          </div>

          <div className="rp-section">
            <h3 className="rp-h3">Lab scores <span>Lighthouse performance, median of three runs</span></h3>
            <table className="rp-table">
              <thead><tr><th>Page</th><th className="num">Mobile</th><th className="num">Desktop</th><th className="num">Mobile LCP</th></tr></thead>
              <tbody>
                {[...new Set(sp.lab.map((l) => l.url))].map((url) => {
                  const m = sp.lab.find((l) => l.url === url && l.strategy === "mobile");
                  const d = sp.lab.find((l) => l.url === url && l.strategy === "desktop");
                  const tone = (v?: number) => (v === undefined ? "" : v >= 90 ? "rp-up" : v >= 50 ? "" : "rp-down");
                  return (
                    <tr key={url}>
                      <td className="label">{urlPath(url)}</td>
                      <td className={`num ${tone(m?.score)}`}>{m?.score ?? "n/a"}</td>
                      <td className={`num ${tone(d?.score)}`}>{d?.score ?? "n/a"}</td>
                      <td className="num">{m ? formatSeconds(m.lcp) : "n/a"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="rp-section">
            <h3 className="rp-h3">Top speed opportunities <span>estimated saving in load time</span></h3>
            {sp.opportunities.length ? (
              <table className="rp-table">
                <tbody>
                  {sp.opportunities.map((o) => (
                    <tr key={o.id}><td>{o.title}</td><td className="rp-muted label">{urlPath(o.url)}</td><td className="num">saves ~{formatSeconds(o.savingsMs)}</td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="rp-muted">Lighthouse found no significant savings.</p>}
          </div>
        </>
      )}
    </Page>
  );
}

/* 06 · Uptime and reliability ------------------------------------------- */

export function Reliability({ ctx }: { ctx: ReportContext }) {
  const u = ctx.report.uptime;
  return (
    <Page ctx={ctx} folio={6}>
      <Kicker index="05">Uptime and reliability</Kicker>
      <h2 className="rp-title">Was the site there when people needed it?</h2>
      {!u ? (
        <div className="rp-section"><Unavailable title="Uptime data unavailable this month">Monitoring was not active for this site during the period.</Unavailable></div>
      ) : (
        <>
          <p className="rp-lede">Checked every five minutes. An outage only counts after two failed checks 30 seconds apart, and a page showing an error message counts as down even if the server replies.</p>
          <div className="rp-section rp-grid-3">
            <div><p className="rp-kpi-label">Uptime</p><p className="rp-figure">{u.summary.uptimePct.toFixed(2)}<small>%</small></p></div>
            <div><p className="rp-kpi-label">Average response</p><p className="rp-figure">{formatInt(u.summary.avgMs)}<small>ms</small></p></div>
            <div><p className="rp-kpi-label">Outages</p><p className="rp-figure">{u.summary.incidentCount}<small>{formatInt(u.summary.downtimeMinutes)} min total</small></p></div>
          </div>
          <figure className="rp-section">
            <h3 className="rp-h3">Every day in {ctx.monthLabel} <span>shorter, coloured bars are days with downtime</span></h3>
            <UptimeStrip title={`Daily uptime in ${ctx.monthLabel}`} days={u.days} width={674} height={36} />
          </figure>
          <figure className="rp-section">
            <h3 className="rp-h3">Response time <span>daily average, milliseconds</span></h3>
            <TrendChart
              title="Average response time by day"
              width={674} height={130}
              labels={u.days.map((d) => formatDayShort(d.day))}
              series={[{ name: "Average", values: u.days.map((d) => d.avgMs), variant: "primary" }]}
            />
          </figure>
          <div className="rp-section">
            <h3 className="rp-h3">Incidents</h3>
            {u.incidents.length ? (
              <table className="rp-table">
                <thead><tr><th>Started</th><th>Cause</th><th className="num">Duration</th></tr></thead>
                <tbody>
                  {u.incidents.map((i) => (
                    <tr key={i.id}>
                      <td>{new Date(i.startedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}</td>
                      <td>{i.cause}</td>
                      <td className="num">{formatDuration(i.startedAt, i.resolvedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="rp-callout"><strong>No outages this month.</strong> Every check succeeded.</p>}
          </div>
          <div className="rp-section rp-grid-2" style={{ marginTop: "auto" }}>
            <ExpiryTile label="SSL certificate" days={u.summary.certDaysLeft} warnAt={21} />
            <ExpiryTile label="Domain registration" days={u.summary.domainDaysLeft} warnAt={30} />
          </div>
        </>
      )}
    </Page>
  );
}

function ExpiryTile({ label, days, warnAt }: { label: string; days: number | null; warnAt: number }) {
  const tone = days === null ? "rp-unknown" : days < 7 ? "rp-act" : days < warnAt ? "rp-watch" : "rp-good";
  return (
    <div className="rp-light">
      <div className="rp-light-top"><span>{label}</span></div>
      <div className={`rp-light-state ${tone}`}><span className="rp-dot" />{days === null ? "Unknown" : `${days} days left`}</div>
      <p className="rp-light-note">{days !== null && days < warnAt ? "Renewal needed soon." : "No action needed."}</p>
    </div>
  );
}

/* 07 · Recommendations --------------------------------------------------- */

export function Recommendations({ ctx }: { ctx: ReportContext }) {
  return (
    <Page ctx={ctx} folio={7}>
      <Kicker index="06">Next month</Kicker>
      <h2 className="rp-title">What we recommend</h2>
      {ctx.managerNotes && (
        <div className="rp-section">
          <h3 className="rp-h3">A note from {ctx.preparedBy.split(" ")[0]}</h3>
          <p className="rp-notes">{ctx.managerNotes}</p>
          <p className="rp-sign">{ctx.preparedBy}, {ctx.org.name}</p>
        </div>
      )}
      <div className="rp-section">
        <h3 className="rp-h3">Priorities, in order</h3>
        {ctx.narrative.recommendations.length ? (
          <ol className="rp-recs">{ctx.narrative.recommendations.map((r) => <li key={r}>{r}</li>)}</ol>
        ) : <p className="rp-muted">Nothing urgent. We will keep monitoring and report back next month.</p>}
      </div>
      <div className="rp-section" style={{ marginTop: "auto" }}>
        <p className="rp-callout">
          <strong>Questions about this report?</strong> Reply to the email it came with and it will reach {ctx.preparedBy.split(" ")[0]} directly.
        </p>
      </div>
    </Page>
  );
}

/* 08 · Appendix ---------------------------------------------------------- */

export function Appendix({ ctx }: { ctx: ReportContext }) {
  const f = ctx.report.freshness;
  return (
    <Page ctx={ctx} folio={8}>
      <Kicker index="07">Appendix</Kicker>
      <h2 className="rp-title">Definitions and method</h2>
      <div className="rp-section">
        <h3 className="rp-h3">Data freshness</h3>
        <p className="rp-callout">
          Search data up to {f.searchThrough ? formatDayShort(f.searchThrough) : "n/a"}, {f.searchFinal ? "final" : "provisional"}.
          {" "}Speed data from the Chrome UX Report, 28-day rolling window. Uptime from checks every five minutes.
          {" "}Generated {new Date(ctx.generatedAt).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}.
        </p>
      </div>
      <div className="rp-section">
        <h3 className="rp-h3">Definitions</h3>
        <dl className="rp-defs">
          <dt>Clicks</dt><dd>Visits to the site from Google's organic (unpaid) search results.</dd>
          <dt>Impressions</dt><dd>How often a page from the site appeared in search results, whether or not it was scrolled into view.</dd>
          <dt>Click-through rate</dt><dd>Clicks divided by impressions.</dd>
          <dt>Average position</dt><dd>The average top-most ranking of the site in results, weighted by impressions. Lower is better.</dd>
          <dt>Core Web Vitals</dt><dd>Google's three measures of loading (LCP), responsiveness (INP) and visual stability (CLS), taken from real Chrome users.</dd>
          <dt>Lab score</dt><dd>A Lighthouse performance score from 0 to 100 on a simulated device. We run each page three times and report the median because single runs vary.</dd>
          <dt>Uptime</dt><dd>The share of five-minute checks that succeeded, averaged across days.</dd>
        </dl>
      </div>
      <div className="rp-section">
        <h3 className="rp-h3">Known limits</h3>
        <dl className="rp-defs">
          <dt>Query totals</dt><dd>Google hides rare search terms for privacy, so the query tables add up to less than the site totals.</dd>
          <dt>Scope</dt><dd>Search figures cover organic Google search only, not paid ads, Bing or analytics data.</dd>
          <dt>Monitoring</dt><dd>Uptime is checked from one region. A regional outage elsewhere might not be detected.</dd>
        </dl>
      </div>
      <p className="rp-muted" style={{ marginTop: "auto", fontSize: 9 }}>
        This report was prepared by {ctx.org.name} for {ctx.client.name}. Figures are produced by the same calculations every month so they can be compared fairly.
      </p>
    </Page>
  );
}
