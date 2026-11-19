/**
 * Report stylesheet. Scoped under .rp so the same markup can sit inside
 * the dashboard preview or stand alone in the PDF. Brand colours come in
 * as --rp-primary and --rp-accent; everything else is fixed so reports
 * from different agencies are equally legible.
 *
 * Page geometry: A4 at 96 dpi is 794 x 1123 px.
 */
export const REPORT_CSS = /* css */ `
.rp {
  --rp-ink: #1b1d1b;
  --rp-ink-2: #4b4f4b;
  --rp-ink-3: #7b7f7a;
  --rp-line: #e4e1da;
  --rp-paper: #ffffff;
  --rp-tint: #f6f4ef;
  --rp-good: #2e7550;
  --rp-watch: #a8701a;
  --rp-act: #a93a2d;
  --chart-line: var(--rp-primary);
  --chart-secondary: var(--rp-accent);
  --chart-ghost: #b9bcb6;
  --chart-grid: #ebe8e1;
  --chart-label: #8a8e88;
  --chart-ok: var(--rp-good);
  --chart-warn: var(--rp-watch);
  --chart-bad: var(--rp-act);
  --chart-bg: #ffffff;
  --rp-serif: var(--font-fraunces, "Fraunces"), Georgia, "Times New Roman", serif;
  --rp-sans: var(--font-hanken, "Hanken Grotesk"), "Helvetica Neue", Arial, sans-serif;
  color: var(--rp-ink);
  font-family: var(--rp-sans);
  font-size: 10.5px;
  line-height: 1.55;
  font-variant-numeric: tabular-nums;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.rp *, .rp *::before, .rp *::after { box-sizing: border-box; }
.rp h1, .rp h2, .rp h3, .rp p, .rp ol, .rp ul, .rp figure { margin: 0; padding: 0; }
.rp ol, .rp ul { list-style: none; }

.rp-page {
  position: relative;
  width: 794px;
  height: 1123px;
  padding: 64px 60px 72px;
  background: var(--rp-paper);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  break-after: page;
  page-break-after: always;
}
.rp-page:last-child { break-after: auto; page-break-after: auto; }

.rp-runhead {
  position: absolute; top: 28px; left: 60px; right: 60px;
  display: flex; justify-content: space-between;
  font-size: 9px; letter-spacing: 0.02em; color: var(--rp-ink-3);
}
.rp-runfoot {
  position: absolute; bottom: 28px; left: 60px; right: 60px;
  display: flex; justify-content: space-between; align-items: center;
  font-size: 8.5px; color: var(--rp-ink-3);
  border-top: 1px solid var(--rp-line); padding-top: 10px;
}
.rp-folio { font-weight: 600; color: var(--rp-ink-2); }

.rp-kicker {
  display: flex; align-items: center; gap: 8px;
  font-size: 9.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--rp-primary);
}
.rp-kicker b { font-family: var(--rp-serif); font-size: 13px; letter-spacing: 0; font-weight: 500; font-style: italic; text-transform: none; color: var(--rp-accent); }
.rp-title {
  margin-top: 10px !important;
  font-family: var(--rp-serif); font-weight: 400;
  font-size: 34px; line-height: 1.08; letter-spacing: -0.02em;
}
.rp-lede { margin-top: 12px !important; max-width: 560px; font-size: 12.5px; line-height: 1.6; color: var(--rp-ink-2); }
.rp-h3 { font-size: 11px; font-weight: 600; color: var(--rp-ink); margin-bottom: 8px !important; }
.rp-h3 span { font-weight: 400; color: var(--rp-ink-3); margin-left: 6px; }
.rp-section { margin-top: 28px; }
.rp-rule { height: 1px; background: var(--rp-line); margin: 24px 0; }
.rp-muted { color: var(--rp-ink-3); }
.rp-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.rp-grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

/* Cover */
.rp-cover { padding: 0; background: var(--rp-tint); }
.rp-cover-band { height: 10px; background: linear-gradient(90deg, var(--rp-primary) 0 78%, var(--rp-accent) 78% 100%); }
.rp-cover-inner { flex: 1; display: flex; flex-direction: column; padding: 56px 60px 52px; }
.rp-cover-brand { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 12px; }
.rp-cover-logo {
  width: 30px; height: 30px; border-radius: 7px; background: var(--rp-primary); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
}
.rp-cover-main { margin-top: auto; }
.rp-cover-month { font-family: var(--rp-serif); font-style: italic; font-size: 20px; color: var(--rp-accent); }
.rp-cover-client { margin-top: 10px !important; font-family: var(--rp-serif); font-weight: 400; font-size: 64px; line-height: 1; letter-spacing: -0.03em; max-width: 620px; }
.rp-cover-sub { margin-top: 18px !important; font-size: 14px; color: var(--rp-ink-2); }
.rp-cover-meta { margin-top: 56px; display: grid; grid-template-columns: repeat(3, 1fr); border-top: 1px solid rgba(0,0,0,0.12); }
.rp-cover-meta div { padding-top: 12px; }
.rp-cover-meta dt { font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--rp-ink-3); }
.rp-cover-meta dd { margin: 4px 0 0; font-size: 12px; font-weight: 500; }

/* Status lights */
.rp-lights { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.rp-light { border-radius: 8px; padding: 14px 16px; background: var(--rp-tint); }
.rp-light-top { display: flex; align-items: center; justify-content: space-between; font-size: 10px; color: var(--rp-ink-2); }
.rp-light-state { display: inline-flex; align-items: center; gap: 6px; margin-top: 6px; font-family: var(--rp-serif); font-size: 19px; letter-spacing: -0.01em; }
.rp-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
.rp-light-note { margin-top: 4px; font-size: 9.5px; color: var(--rp-ink-3); }
.rp-good { color: var(--rp-good); } .rp-good .rp-dot, .rp-dot.rp-good { background: var(--rp-good); }
.rp-watch { color: var(--rp-watch); } .rp-watch .rp-dot, .rp-dot.rp-watch { background: var(--rp-watch); }
.rp-act { color: var(--rp-act); } .rp-act .rp-dot, .rp-dot.rp-act { background: var(--rp-act); }
.rp-unknown { color: var(--rp-ink-3); } .rp-unknown .rp-dot { background: #c9ccc6; }

/* Highlights */
.rp-highlights { counter-reset: hl; display: flex; flex-direction: column; }
.rp-highlights li { counter-increment: hl; display: grid; grid-template-columns: 28px 1fr; padding: 10px 0; border-top: 1px solid var(--rp-line); font-size: 11.5px; line-height: 1.55; }
.rp-highlights li::before { content: counter(hl, decimal-leading-zero); font-family: var(--rp-serif); font-style: italic; color: var(--rp-accent); font-size: 13px; }

/* KPI scorecard */
.rp-kpis { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 2px solid var(--rp-ink); }
.rp-kpi { padding: 12px 14px 4px 0; }
.rp-kpi + .rp-kpi { padding-left: 14px; border-left: 1px solid var(--rp-line); }
.rp-kpi-label { font-size: 9.5px; color: var(--rp-ink-3); }
.rp-kpi-value { margin-top: 2px !important; font-family: var(--rp-serif); font-size: 28px; line-height: 1.1; letter-spacing: -0.02em; }
.rp-kpi-deltas { margin-top: 6px; display: flex; flex-direction: column; gap: 1px; font-size: 9.5px; }
.rp-kpi-deltas span { color: var(--rp-ink-3); }
.rp-kpi-spark { margin-top: 8px; }
.rp-up { color: var(--rp-good); font-weight: 600; }
.rp-down { color: var(--rp-act); font-weight: 600; }
.rp-flat { color: var(--rp-ink-3); font-weight: 600; }

/* Tables */
.rp-table { width: 100%; border-collapse: collapse; font-size: 10px; }
.rp-table th { text-align: left; font-weight: 500; color: var(--rp-ink-3); font-size: 9px; padding: 0 8px 6px 0; border-bottom: 1px solid var(--rp-ink); }
.rp-table td { padding: 6px 8px 6px 0; border-bottom: 1px solid var(--rp-line); vertical-align: top; }
.rp-table .num { text-align: right; white-space: nowrap; }
.rp-table th.num { text-align: right; }
.rp-table .label { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rp-bar { display: inline-block; height: 4px; border-radius: 2px; background: var(--rp-primary); opacity: 0.75; vertical-align: middle; }

/* Callouts */
.rp-callout { border-radius: 8px; background: var(--rp-tint); padding: 14px 16px; font-size: 10.5px; color: var(--rp-ink-2); }
.rp-callout strong { color: var(--rp-ink); }
.rp-unavailable { border: 1px dashed #cfcbc2; border-radius: 8px; padding: 22px; text-align: center; color: var(--rp-ink-3); font-size: 11px; }
.rp-unavailable strong { display: block; font-family: var(--rp-serif); font-size: 16px; font-weight: 400; color: var(--rp-ink-2); margin-bottom: 4px; }

/* Vitals */
.rp-vital { border-top: 2px solid var(--rp-ink); padding-top: 10px; }
.rp-vital-name { display: flex; justify-content: space-between; font-size: 9.5px; color: var(--rp-ink-3); }
.rp-vital-value { font-family: var(--rp-serif); font-size: 26px; letter-spacing: -0.02em; line-height: 1.15; }
.rp-vital-verdict { display: inline-flex; align-items: center; gap: 5px; font-size: 9.5px; font-weight: 600; margin-bottom: 8px; }

/* Big figures */
.rp-figure { font-family: var(--rp-serif); font-size: 44px; line-height: 1; letter-spacing: -0.03em; }
.rp-figure small { font-size: 16px; color: var(--rp-ink-3); margin-left: 4px; letter-spacing: 0; }

/* Notes */
.rp-notes { border-left: 3px solid var(--rp-accent); padding: 4px 0 4px 16px; font-family: var(--rp-serif); font-size: 14px; line-height: 1.55; color: var(--rp-ink); white-space: pre-wrap; }
.rp-sign { margin-top: 10px; font-size: 10px; color: var(--rp-ink-3); }
.rp-recs { counter-reset: rec; }
.rp-recs li { counter-increment: rec; display: grid; grid-template-columns: 30px 1fr; gap: 4px; padding: 11px 0; border-top: 1px solid var(--rp-line); font-size: 11.5px; }
.rp-recs li::before { content: counter(rec); width: 20px; height: 20px; border-radius: 50%; background: var(--rp-primary); color: #fff; font-size: 10px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
.rp-defs { display: grid; grid-template-columns: 120px 1fr; gap: 6px 16px; font-size: 9.5px; color: var(--rp-ink-2); }
.rp-defs dt { font-weight: 600; color: var(--rp-ink); }
.rp-defs dd { margin: 0; }

/* On screen, pages far from the viewport are not laid out or painted
   until they scroll near, which keeps an eight-page preview cheap. */
@media screen {
  .rp-page { content-visibility: auto; contain-intrinsic-size: 794px 1123px; }
}

@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0; background: #fff; }
}
`;
