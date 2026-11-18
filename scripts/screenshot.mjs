// Capture dashboard screenshots for review and for the README.
// Usage: node scripts/screenshot.mjs [baseUrl] [outDir] [path ...]
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const [, , base = "http://localhost:3100", out = "docs/screenshots", ...paths] = process.argv;
const targets = paths.length ? paths : ["/dashboard"];
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "mobile", width: 390, height: 844 },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: "light" });
  const page = await context.newPage();
  for (const path of targets) {
    await page.goto(base + path, { waitUntil: "networkidle", timeout: 120_000 });
    await page.waitForTimeout(400);
    const name = path.replace(/^\//, "").replace(/[\/?=&]/g, "-") || "home";
    await page.screenshot({ path: `${out}/${name}-${vp.name}.png`, fullPage: true });
    console.log(`saved ${out}/${name}-${vp.name}.png`);
  }
  await context.close();
}
await browser.close();
