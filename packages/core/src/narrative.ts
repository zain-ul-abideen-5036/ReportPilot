import type { Finding } from "./insights";
import type { ReportData } from "./report";
import { formatPeriod, prettyUrl } from "./format";

/**
 * The narrative stage. Templates always produce a usable summary; an AI
 * model may rewrite it for flow, but its output is only accepted if it
 * passes the number check (see number-check.ts).
 */

export interface Narrative {
  /** Opening paragraph for the executive summary. */
  summary: string;
  /** 3–5 highlight sentences. */
  highlights: string[];
  /** Recommendations for next month, from rule actions. */
  recommendations: string[];
  source: "template" | "ai";
}

export function templateNarrative(report: ReportData): Narrative {
  const month = formatPeriod(report.period);
  const site = prettyUrl(report.siteUrl);
  const highlights = pickHighlights(report.findings).map((f) => f.sentence);
  const lights = report.status;
  const needsAction = Object.entries(lights).filter(([, l]) => l === "act").map(([k]) => k);
  const opening = needsAction.length === 0
    ? `${month} was a steady month for ${site}.`
    : `${month} needs attention on ${site}: ${needsAction.join(" and ")}.`;
  const lead = highlights[0] ? ` ${highlights[0]}` : "";
  return {
    summary: `${opening}${lead}`,
    highlights,
    recommendations: report.findings
      .map((f) => f.action)
      .filter((a): a is string => Boolean(a))
      .slice(0, 5),
    source: "template",
  };
}

/**
 * Up to five highlights, at least one per area that has something to say,
 * then filled by weight. Clients skim; a summary that only talks about
 * search when the site was down for an hour is wrong.
 */
export function pickHighlights(findings: Finding[], max = 5): Finding[] {
  const chosen: Finding[] = [];
  const seenAreas = new Set<string>();
  for (const f of findings) {
    if (!seenAreas.has(f.area)) {
      chosen.push(f);
      seenAreas.add(f.area);
    }
  }
  for (const f of findings) {
    if (chosen.length >= max) break;
    if (!chosen.includes(f)) chosen.push(f);
  }
  return chosen
    .sort((a, b) => b.weight - a.weight)
    .slice(0, max);
}

/** The prompt sent to the optional AI model. Aggregates only, no contacts. */
export function aiPrompt(narrative: Narrative): string {
  return [
    "Rewrite these monthly website report notes as a short, plain-English summary for a business owner.",
    "Rules: keep every number exactly as written; do not add numbers, percentages or dates;",
    "no marketing language; British English; at most 90 words.",
    "",
    narrative.summary,
    ...narrative.highlights.map((h) => `- ${h}`),
  ].join("\n");
}
