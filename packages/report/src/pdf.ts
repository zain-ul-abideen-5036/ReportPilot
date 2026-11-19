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

/** True on Vercel and AWS Lambda, where there is no bundled browser to launch. */
export const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

/*
 * Flags from @sparticuz/chromium that break printing: --single-process lets
 * closing one page take the whole browser down; Playwright sets headless
 * mode itself.
 */
const UNWANTED = [/^--single-process$/, /^--headless/];

/*
 * On serverless, @sparticuz/chromium provides a Chromium small enough for a
 * function, and playwright-core is pinned (under the alias
 * playwright-core-serverless) to the release built for the same Chromium:
 * playwright-core 1.63.0 = Chromium 153 = @sparticuz/chromium 153.0.0.
 * A mismatch crashes on launch. Upgrade the two together.
 * Locally, the full playwright package and its own downloaded browser.
 */
async function launch(): Promise<Browser> {
  if (isServerless) {
    const [{ default: serverlessChromium }, { chromium }] = await Promise.all([
      import("@sparticuz/chromium"),
      import("playwright-core-serverless"),
    ]);
    serverlessChromium.setGraphicsMode = false;
    const browser = await chromium.launch({
      executablePath: await serverlessChromium.executablePath(),
      args: serverlessChromium.args.filter((a: string) => !UNWANTED.some((r) => r.test(a))),
      headless: true,
    });
    return browser as unknown as Browser;
  }
  const { chromium } = await import("playwright");
  return chromium.launch();
}

/**
 * One Chromium per server process, launched on first use and reused after.
 * Launching a browser takes one to two seconds; opening a page takes
 * milliseconds, so this is the difference between a slow PDF button and a
 * fast one.
 */
let shared: Promise<Browser> | null = null;

function browser(): Promise<Browser> {
  if (!shared) {
    shared = launch().then((b) => {
      b.on("disconnected", () => { shared = null; });
      return b;
    });
    shared.catch(() => { shared = null; });
  }
  return shared;
}

export async function printUrlToPdf(
  url: string,
  { cookie, headers = {}, maxBytes = 8 * 1024 * 1024 }: { cookie?: string; headers?: Record<string, string>; maxBytes?: number } = {},
): Promise<Uint8Array> {
  const extraHTTPHeaders = { ...headers, ...(cookie ? { cookie } : {}) };
  const context = await (await browser()).newContext(Object.keys(extraHTTPHeaders).length ? { extraHTTPHeaders } : {});
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
