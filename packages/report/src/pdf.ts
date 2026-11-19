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

type Browser = import("playwright").Browser;

/**
 * One Chromium per server process, launched on first use and reused after.
 * Launching a browser takes one to two seconds; opening a page takes
 * milliseconds, so this is the difference between a slow PDF button and a
 * fast one.
 */
let shared: Promise<Browser> | null = null;

function browser(): Promise<Browser> {
  if (!shared) {
    shared = import("playwright").then(async ({ chromium }) => {
      const b = await chromium.launch();
      b.on("disconnected", () => { shared = null; });
      return b;
    });
    shared.catch(() => { shared = null; });
  }
  return shared;
}

export async function printUrlToPdf(url: string, { cookie, maxBytes = 8 * 1024 * 1024 }: { cookie?: string; maxBytes?: number } = {}): Promise<Uint8Array> {
  const context = await (await browser()).newContext(cookie ? { extraHTTPHeaders: { cookie } } : {});
  try {
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready);
    const pdf = await page.pdf(PDF_OPTIONS);
    if (pdf.byteLength > maxBytes) throw new Error(`PDF is ${(pdf.byteLength / 1048576).toFixed(1)} MB, over the limit`);
    return pdf;
  } finally {
    await context.close();
  }
}
