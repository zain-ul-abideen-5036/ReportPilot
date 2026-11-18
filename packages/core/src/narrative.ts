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
  const watching = Object.values(lights).includes("watch");
  const opening = needsAction.length > 0
    ? `${month} needs attention on ${site}.`
    : watching
      ? `${month} was a mixed month for ${site}.`
      : `${month} was a steady month for ${site}.`;
  return {
    summary: `${opening} ${statusSentence(lights)}`,
    highlights,
    recommendations: report.findings
      .map((f) => f.action)
      .filter((a): a is string => Boolean(a))
      .slice(0, 5),
    source: "template",
  };
}

const AREA_NAME = { search: "search", speed: "speed", reliability: "reliability" } as const;

/** "Search and speed are on track; reliability needs watching." */
export function statusSentence(lights: ReportData["status"]): string {
  const groups: Record<string, string[]> = { good: [], watch: [], act: [], unknown: [] };
  for (const [area, light] of Object.entries(lights)) groups[light]!.push(AREA_NAME[area as keyof typeof AREA_NAME]);
  const join = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
  const verb = (xs: string[]) => (xs.length === 1 ? "is" : "are");
  const parts: string[] = [];
  if (groups.good!.length) parts.push(`${join(groups.good!)} ${verb(groups.good!)} on track`);
  if (groups.watch!.length) parts.push(`${join(groups.watch!)} ${groups.watch!.length === 1 ? "needs" : "need"} watching`);
  if (groups.act!.length) parts.push(`${join(groups.act!)} ${groups.act!.length === 1 ? "needs" : "need"} action`);
  if (groups.unknown!.length) parts.push(`${join(groups.unknown!)} had no data`);
  const sentence = parts.join("; ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
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
