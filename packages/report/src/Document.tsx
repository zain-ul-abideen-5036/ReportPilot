import { formatPeriod } from "@reportpilot/core";
import { REPORT_CSS } from "./styles";
import { Appendix, Cover, Opportunities, Recommendations, Reliability, Search, Speed, Summary } from "./pages";
import type { ReportContext, ReportInput } from "./types";

const PAGES = [Cover, Summary, Search, Opportunities, Speed, Reliability, Recommendations, Appendix];
export const PAGE_COUNT = PAGES.length;

/**
 * The full client report. Rendered inside the dashboard for review and,
 * unchanged, to static HTML for Playwright to print as the PDF.
 */
export function ReportDocument(input: ReportInput & { id?: string; gap?: number; limit?: number }) {
  const ctx: ReportContext = { ...input, monthLabel: formatPeriod(input.report.period), pageCount: PAGE_COUNT };
  const style = {
    "--rp-primary": input.org.primary,
    "--rp-accent": input.org.accent,
    display: "flex",
    flexDirection: "column",
    gap: input.gap ?? 0,
  } as React.CSSProperties;
  return (
    <article className="rp" id={input.id} style={style} lang="en-GB">
      <style>{REPORT_CSS}</style>
      {PAGES.slice(0, input.limit ?? PAGES.length).map((P) => <P key={P.name} ctx={ctx} />)}
    </article>
  );
}
