import { formatInt, formatPct, formatSeconds, formatSignedPct, urlPath } from "./format";
import type { BuiltSearch, BuiltSpeed, BuiltUptime, BuiltIndexing } from "./report";

/**
 * The rules engine. Each rule looks at calculated figures and may emit a
 * finding. A finding carries every figure its sentence uses, so the
 * narrative stage (and its AI number check) can only ever quote numbers
 * that came out of here.
 */

export type Area = "search" | "speed" | "reliability" | "indexing";
export type Severity = "positive" | "info" | "warning" | "critical";

export interface Finding {
  id: string;
  area: Area;
  severity: Severity;
  /** Ranking weight, higher shows first. */
  weight: number;
  /** One-line headline for the dashboard. */
  title: string;
  /** Plain-English sentence for the report, already formatted. */
  sentence: string;
  /** Next step, used in the recommendations section. */
  action: string | null;
  /** Formatted figures this finding is allowed to quote. */
  facts: Record<string, string>;
}

/** "1 page" / "3 pages". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

const SEVERITY_WEIGHT: Record<Severity, number> = { critical: 400, warning: 300, positive: 200, info: 100 };

function finding(f: Omit<Finding, "weight"> & { weight?: number }): Finding {
  return { ...f, weight: SEVERITY_WEIGHT[f.severity] + (f.weight ?? 0) };
}

export function searchFindings(s: BuiltSearch): Finding[] {
  const out: Finding[] = [];
  const clicks = s.kpis.find((k) => k.key === "clicks");
  if (clicks?.mom.pct != null) {
    const pct = clicks.mom.pct;
    const facts: Record<string, string> = {
      clicks: formatInt(clicks.value),
      mom: formatSignedPct(pct),
    };
    if (clicks.yoy.pct != null) facts.yoy = formatSignedPct(clicks.yoy.pct);
    const driver = s.driver ? urlPath(s.driver.key) : null;
    if (driver) facts.driver = driver;
    const yoyPart = facts.yoy ? ` and ${facts.yoy} on the same month last year` : "";
    if (pct >= 0.08) {
      out.push(finding({
        id: "clicks-up", area: "search", severity: "positive", weight: Math.round(pct * 100),
        title: `Organic clicks ${facts.mom} on last month`,
        sentence: `Organic clicks rose to ${facts.clicks}, ${facts.mom} on last month${yoyPart}${driver ? `, led by ${driver}` : ""}.`,
        action: null, facts,
      }));
    } else if (pct <= -0.08) {
      const severity: Severity = pct <= -0.25 ? "critical" : "warning";
      out.push(finding({
        id: "clicks-down", area: "search", severity, weight: Math.round(-pct * 100),
        title: `Organic clicks ${facts.mom} on last month`,
        sentence: `Organic clicks fell to ${facts.clicks}, ${facts.mom} on last month${yoyPart}${driver ? `. The largest drop was on ${driver}` : ""}.`,
        action: driver
          ? `Check ${driver} for ranking losses, recent content changes or indexing problems.`
          : "Review the pages and queries that lost the most clicks.",
        facts,
      }));
    } else {
      out.push(finding({
        id: "clicks-steady", area: "search", severity: "info", weight: 60,
        title: "Organic clicks held steady",
        sentence: `Organic clicks were steady at ${facts.clicks} (${facts.mom} on last month${yoyPart}).`,
        action: null, facts,
      }));
    }
  }

  if (s.strikingDistance.length > 0) {
    const top = s.strikingDistance[0]!;
    const total = s.strikingDistance.reduce((n, q) => n + q.impressions, 0);
    const facts = {
      count: String(s.strikingDistance.length),
      query: top.query,
      position: top.position.toFixed(1),
      impressions: formatInt(total),
    };
    out.push(finding({
      id: "striking-distance", area: "search", severity: "info", weight: 40,
      title: `${plural(s.strikingDistance.length, "keyword")} one push from page one`,
      sentence: `${plural(s.strikingDistance.length, "search term")} rank between positions 8 and 20 with ${facts.impressions} impressions between them. The biggest is "${facts.query}" at position ${facts.position}.`,
      action: `Strengthen the page ranking for "${facts.query}": expand the content, add internal links from related pages and tighten the title.`,
      facts,
    }));
  }

  if (s.lowCtr.length > 0) {
    const top = s.lowCtr[0]!;
    const missed = s.lowCtr.reduce((n, p) => n + Math.max(0, p.missedClicks), 0);
    const facts = {
      count: String(s.lowCtr.length),
      page: urlPath(top.page),
      ctr: formatPct(top.ctr),
      expected: formatPct(top.expectedCtr),
      missed: formatInt(missed),
    };
    out.push(finding({
      id: "low-ctr", area: "search", severity: "info", weight: 35,
      title: `${plural(s.lowCtr.length, "page under-earns", "pages under-earn")} clicks for their position`,
      sentence: `${plural(s.lowCtr.length, "page is", "pages are")} seen often but clicked rarely. ${facts.page} gets a ${facts.ctr} click-through rate where its position usually earns ${facts.expected}. Fixing these could add around ${facts.missed} clicks a month.`,
      action: `Rewrite the title and meta description of ${facts.page} so it answers the search more directly.`,
      facts,
    }));
  }

  if (s.topTen.entered.length > 0) {
    const facts = { count: String(s.topTen.entered.length), query: s.topTen.entered[0]!.query };
    out.push(finding({
      id: "top10-entered", area: "search", severity: s.topTen.entered.length >= 3 ? "positive" : "info", weight: 20,
      title: `${plural(s.topTen.entered.length, "new keyword")} on page one`,
      sentence: `${plural(s.topTen.entered.length, "search term")} moved onto page one this month, including "${facts.query}".`,
      action: null, facts,
    }));
  }
  if (s.topTen.dropped.length > 0) {
    const facts = { count: String(s.topTen.dropped.length), query: s.topTen.dropped[0]!.query };
    out.push(finding({
      id: "top10-dropped", area: "search", severity: s.topTen.dropped.length >= 3 ? "warning" : "info", weight: 10,
      title: `${plural(s.topTen.dropped.length, "keyword")} dropped off page one`,
      sentence: `${plural(s.topTen.dropped.length, "search term")} fell off page one, including "${facts.query}".`,
      action: `Compare the page for "${facts.query}" with the results now ranking above it.`,
      facts,
    }));
  }
  return out;
}

export function speedFindings(sp: BuiltSpeed): Finding[] {
  const out: Finding[] = [];
  const { field, assessment } = sp;
  if (assessment.passes === true) {
    const facts = { lcp: formatSeconds(field.lcp) };
    out.push(finding({
      id: "cwv-pass", area: "speed", severity: "positive",
      title: "Passes Core Web Vitals for real visitors",
      sentence: `Real visitors get a fast, stable experience: all three Core Web Vitals pass, with pages loading their main content in ${facts.lcp}.`,
      action: null, facts,
    }));
  } else if (assessment.passes === false) {
    const failing = (Object.entries(assessment.ratings) as Array<[string, string]>)
      .filter(([, r]) => r !== "good")
      .map(([k]) => k.toUpperCase());
    const facts = { failing: failing.length > 1 ? `${failing.slice(0, -1).join(", ")} and ${failing.at(-1)}` : failing.join("") };
    out.push(finding({
      id: "cwv-fail", area: "speed", severity: "warning", weight: failing.length * 10,
      title: `Fails Core Web Vitals on ${facts.failing}`,
      sentence: `The site does not pass Google's Core Web Vitals for real visitors because of ${facts.failing}.`,
      action: sp.opportunities[0]
        ? `Start with "${sp.opportunities[0].title}", the largest speed saving Lighthouse found.`
        : "Investigate the failing metric with Lighthouse on the slowest key page.",
      facts,
    }));
  }

  if (sp.inpRegression !== null && sp.inpRegression >= 0.2) {
    const facts = { change: formatSignedPct(sp.inpRegression, 0), inp: `${Math.round(field.inp ?? 0)} ms` };
    out.push(finding({
      id: "inp-regressed", area: "speed", severity: "warning", weight: 25,
      title: `Responsiveness slowed ${facts.change}`,
      sentence: `Pages respond to taps and clicks more slowly than last month: INP is ${facts.inp}, ${facts.change}.`,
      action: "Look for new third-party scripts or heavy event handlers added this month.",
      facts,
    }));
  }

  const mobile = sp.lab.filter((l) => l.strategy === "mobile");
  if (mobile.length) {
    const worst = mobile.reduce((a, b) => (b.score < a.score ? b : a));
    if (worst.score < 50) {
      const path = urlPath(worst.url);
      const facts = { score: String(Math.round(worst.score)), page: path === "/" ? "the homepage" : path };
      out.push(finding({
        id: "lab-mobile-low", area: "speed", severity: "warning", weight: 5,
        title: `Mobile lab score of ${facts.score} on ${facts.page}`,
        sentence: `${facts.page.charAt(0).toUpperCase()}${facts.page.slice(1)} scores ${facts.score} out of 100 in Lighthouse on mobile.`,
        action: `Profile ${facts.page} on a throttled mobile connection and address the top opportunity.`,
        facts,
      }));
    }
  }
  return out;
}

export function uptimeFindings(u: BuiltUptime): Finding[] {
  const out: Finding[] = [];
  const s = u.summary;
  const facts = {
    uptime: `${s.uptimePct.toFixed(2)}%`,
    incidents: String(s.incidentCount),
    downtime: `${formatInt(s.downtimeMinutes)} minutes`,
  };
  if (s.uptimePct >= 99.9) {
    out.push(finding({
      id: "uptime-good", area: "reliability", severity: "positive", weight: -50,
      title: `${facts.uptime} uptime`,
      sentence: s.incidentCount === 0
        ? `The site was up ${facts.uptime} of the month with no outages.`
        : `The site was up ${facts.uptime} of the month; ${plural(s.incidentCount, "short outage")} added up to ${facts.downtime}.`,
      action: null, facts,
    }));
  } else {
    out.push(finding({
      id: "uptime-low", area: "reliability", severity: s.uptimePct < 99 ? "critical" : "warning",
      weight: Math.round((100 - s.uptimePct) * 10),
      title: `${facts.uptime} uptime, ${plural(s.incidentCount, "outage")}`,
      sentence: `The site was up ${facts.uptime} of the month. ${plural(s.incidentCount, "outage")} added up to ${facts.downtime} of downtime.`,
      action: "Review the incident causes below with the hosting provider.",
      facts,
    }));
  }
  if (s.certDaysLeft !== null && s.certDaysLeft < 21) {
    const f = { days: String(s.certDaysLeft) };
    out.push(finding({
      id: "ssl-expiring", area: "reliability", severity: s.certDaysLeft < 7 ? "critical" : "warning", weight: 50,
      title: `SSL certificate expires in ${f.days} days`,
      sentence: `The SSL certificate expires in ${f.days} days. If it lapses, browsers will show visitors a security warning.`,
      action: "Confirm automatic certificate renewal is working, or renew it manually.",
      facts: f,
    }));
  }
  if (s.domainDaysLeft !== null && s.domainDaysLeft < 30) {
    const f = { days: String(s.domainDaysLeft) };
    out.push(finding({
      id: "domain-expiring", area: "reliability", severity: s.domainDaysLeft < 10 ? "critical" : "warning", weight: 60,
      title: `Domain expires in ${f.days} days`,
      sentence: `The domain registration expires in ${f.days} days.`,
      action: "Renew the domain and turn on auto-renew with the registrar.",
      facts: f,
    }));
  }
  return out;
}

export function indexingFindings(ix: BuiltIndexing): Finding[] {
  const out: Finding[] = [];
  const failing = ix.pages.filter((p) => p.verdict === "FAIL");
  if (failing.length) {
    const facts = { count: String(failing.length), page: urlPath(failing[0]!.url), state: failing[0]!.coverageState };
    out.push(finding({
      id: "key-page-not-indexed", area: "indexing", severity: "critical", weight: 30,
      title: `${plural(failing.length, "key page")} not indexed`,
      sentence: `${plural(failing.length, "key page is", "key pages are")} not in Google's index. ${facts.page} reports "${facts.state}".`,
      action: `Fix the cause on ${facts.page} and request indexing in Search Console.`,
      facts,
    }));
  }
  const errors = ix.sitemaps.reduce((n, s) => n + s.errors, 0);
  if (errors > 0) {
    const facts = { errors: String(errors) };
    out.push(finding({
      id: "sitemap-errors", area: "indexing", severity: "warning",
      title: `${plural(errors, "sitemap error")}`,
      sentence: `Search Console reports ${facts.errors} errors in the submitted sitemaps.`,
      action: "Remove redirected or missing URLs from the sitemap and resubmit it.",
      facts,
    }));
  }
  return out;
}

export function rankFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => b.weight - a.weight);
}
