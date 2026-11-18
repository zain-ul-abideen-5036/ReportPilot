import { formatPeriod } from "@reportpilot/core";
import { REPORT_CSS } from "./styles";
import { Appendix, Cover, Opportunities, Recommendations, Reliability, Search, Speed, Summary } from "./pages";
import type { ReportContext, ReportInput } from "./types";

export const PAGE_COUNT = 8;

/**
 * The full client report. Rendered inside the dashboard for review and,
 * unchanged, to static HTML for Playwright to print as the PDF.
 */
export function ReportDocument(input: ReportInput & { id?: string; gap?: number }) {
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
      <Cover ctx={ctx} />
      <Summary ctx={ctx} />
      <Search ctx={ctx} />
      <Opportunities ctx={ctx} />
      <Speed ctx={ctx} />
      <Reliability ctx={ctx} />
      <Recommendations ctx={ctx} />
      <Appendix ctx={ctx} />
    </article>
  );
}
