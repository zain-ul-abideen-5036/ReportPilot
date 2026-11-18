import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReportDocument } from "./Document";
import type { ReportInput } from "./types";

/**
 * Render the report to a complete HTML document, then to PDF with a real
 * Chromium. The same React components the dashboard previews, so what the
 * account manager approves is exactly what the client receives.
 */

const FONTS =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,400..600,60;1,9..144,400,60&family=Hanken+Grotesk:wght@400;500;600;700&display=block";

export function renderReportHtml(input: ReportInput): string {
  const body = renderToStaticMarkup(createElement(ReportDocument, input));
  const title = `${input.client.name} · ${input.report.period}`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>html,body{margin:0;background:#fff}</style>
</head>
<body>${body}</body>
</html>`;
}

export interface PdfOptions {
  /** Reuse an existing browser across many reports in one job. */
  browser?: import("playwright").Browser;
  /** Hard ceiling; anything bigger usually means an image slipped in. */
  maxBytes?: number;
}

export async function renderReportPdf(input: ReportInput, opts: PdfOptions = {}): Promise<Uint8Array> {
  const html = renderReportHtml(input);
  const { chromium } = await import("playwright");
  const browser = opts.browser ?? (await chromium.launch());
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      // Accessible output: tagged structure and a heading outline.
      tagged: true,
      outline: true,
    });
    await page.close();
    const max = opts.maxBytes ?? 8 * 1024 * 1024;
    if (pdf.byteLength > max) throw new Error(`PDF is ${(pdf.byteLength / 1048576).toFixed(1)} MB, over the ${max / 1048576} MB limit`);
    return pdf;
  } finally {
    if (!opts.browser) await browser.close();
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
