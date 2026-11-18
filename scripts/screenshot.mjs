// Capture the README screenshots from a running build.
//
//   npm run build && npm run start -w @reportpilot/web -- --port 3100
//   node scripts/screenshot.mjs http://localhost:3100
//
// Writes PNGs to docs/screenshots/. Motion is reduced so every shot lands
// in its final state.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3100";
const out = "docs/screenshots";

const desktop = [
  { name: "landing", path: "/", height: 900 },
  { name: "landing-story", path: "/", height: 900, scrollTo: "#how", offset: -40 },
  { name: "overview", path: "/dashboard", height: 1000 },
  { name: "report-review", path: "/reports/site_harlow", height: 1000 },
  { name: "client", path: "/clients/cli_pennine", height: 1000 },
  { name: "branding", path: "/settings", height: 1000 },
  { name: "pipeline", path: "/pipeline", height: 900 },
  { name: "alerts", path: "/alerts", height: 900 },
  { name: "onboarding", path: "/clients/new", height: 900 },
];

const mobile = [
  { name: "mobile-landing", path: "/" },
  { name: "mobile-overview", path: "/dashboard" },
  { name: "mobile-review", path: "/reports/site_harlow" },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();

const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5, reducedMotion: "reduce" });
for (const shot of desktop) {
  const page = await ctx.newPage();
  await page.setViewportSize({ width: 1440, height: shot.height });
  await page.goto(base + shot.path, { waitUntil: "networkidle" });
  if (shot.scrollTo) {
    await page.evaluate(({ sel, offset }) => {
      const el = document.querySelector(sel);
      if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + offset);
    }, { sel: shot.scrollTo, offset: shot.offset ?? 0 });
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${shot.name}.png` });
  console.log(`saved ${shot.name}`);
  await page.close();
}

const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce", isMobile: true, hasTouch: true });
for (const shot of mobile) {
  const page = await phone.newPage();
  await page.goto(base + shot.path, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${shot.name}.png` });
  console.log(`saved ${shot.name}`);
  await page.close();
}

// The client PDF: four representative pages, side by side.
const pdf = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
const page = await pdf.newPage();
await page.goto(`${base}/print/site_pennine`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const sheets = page.locator(".rp-page");
const pick = [0, 1, 2, 4];
const buffers = [];
for (const i of pick) buffers.push((await sheets.nth(i).screenshot()).toString("base64"));
const sheet = await (await browser.newContext({ viewport: { width: 1800, height: 700 }, deviceScaleFactor: 1.5 })).newPage();
await sheet.setContent(`<body style="margin:0;padding:48px;background:#efe9de;display:flex;gap:28px;justify-content:center">${buffers
  .map((b) => `<img src="data:image/png;base64,${b}" style="width:390px;border-radius:3px;box-shadow:0 0 0 1px rgb(52 40 22/.08),0 24px 48px -24px rgb(52 40 22/.35)">`)
  .join("")}</body>`);
await sheet.screenshot({ path: `${out}/client-pdf.png`, fullPage: true });
console.log("saved client-pdf");

await browser.close();
