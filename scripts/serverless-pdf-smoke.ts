/**
 * Proves the Vercel PDF path works: forces the serverless branch, so the
 * report package launches @sparticuz/chromium through the pinned
 * playwright-core, and prints a page to PDF. Linux only (that is what the
 * serverless Chromium is built for); run in CI.
 *
 *   VERCEL=1 npx tsx scripts/serverless-pdf-smoke.ts
 */
process.env.VERCEL ??= "1";

const { printUrlToPdf, isServerless } = await import("../packages/report/src/pdf");
if (!isServerless) throw new Error("Expected the serverless branch; set VERCEL=1");

const html = "<!doctype html><html><body style='font-family:sans-serif'><h1>ReportPilot</h1><p>Serverless PDF smoke test.</p></body></html>";
const started = Date.now();
const pdf = await printUrlToPdf(`data:text/html,${encodeURIComponent(html)}`);
const header = Buffer.from(pdf.subarray(0, 5)).toString();
if (header !== "%PDF-") throw new Error(`Not a PDF: ${header}`);
console.log(`Serverless Chromium printed a ${pdf.byteLength} byte PDF in ${Date.now() - started} ms.`);
process.exit(0);
