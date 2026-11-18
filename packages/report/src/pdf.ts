/**
 * Print a URL to an A4 PDF. Used by the dashboard, which renders the
 * report at /print/[id] with Next.js and lets Chromium print that page.
 * Kept free of react-dom/server so it can be imported from route handlers.
 */
export const PDF_OPTIONS = {
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  tagged: true,
  outline: true,
} as const;

export async function printUrlToPdf(url: string, { cookie, maxBytes = 8 * 1024 * 1024 }: { cookie?: string; maxBytes?: number } = {}): Promise<Uint8Array> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext(cookie ? { extraHTTPHeaders: { cookie } } : {});
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf(PDF_OPTIONS);
    if (pdf.byteLength > maxBytes) throw new Error(`PDF is ${(pdf.byteLength / 1048576).toFixed(1)} MB, over the limit`);
    return pdf;
  } finally {
    await browser.close();
  }
}
