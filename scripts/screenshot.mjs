// Capture the README screenshots from a running build.
//
//   npm run build && npm run start -w @reportpilot/web -- --port 3100
//   node scripts/screenshot.mjs http://localhost:3100
//
// Writes PNGs to docs/screenshots/. Motion is reduced so every shot lands
// in its final state.
import { chromium } from "playwright";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const base = process.argv[2] ?? "http://localhost:3100";
const out = "docs/screenshots";

const desktop = [
  { name: "landing", path: "/", height: 900 },
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

// Other screens: an HD laptop (the size the hero is tuned for) and a tablet.
for (const [name, path, width, height] of [
  ["laptop-landing", "/", 1280, 720],
  ["tablet-landing", "/", 768, 1024],
  ["tablet-overview", "/dashboard", 768, 1024],
]) {
  const c = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1.5, reducedMotion: "reduce" });
  const page = await c.newPage();
  await page.goto(base + path, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(`saved ${name}`);
  await c.close();
}

// Landing sections as standalone pictures for the README.
{
  const c = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5, reducedMotion: "reduce" });
  const page = await c.newPage();
  await page.goto(base + "/", { waitUntil: "networkidle" });
  for (const [name, selector] of [["section-how-it-works", "#how"], ["section-the-report", "#report"]]) {
    const el = page.locator(selector);
    await el.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    // Trim the section's own vertical padding so the picture is all content.
    const clip = await el.evaluate((node) => {
      const r = node.getBoundingClientRect();
      const cs = getComputedStyle(node);
      const top = parseFloat(cs.paddingTop) - 48;
      const bottom = parseFloat(cs.paddingBottom) - 48;
      return { x: r.x + window.scrollX, y: r.y + window.scrollY + top, width: r.width, height: r.height - top - bottom };
    });
    await page.screenshot({ path: `${out}/${name}.png`, clip, fullPage: true });
    console.log(`saved ${name}`);
  }
  await c.close();
}

// The client PDF: four representative pages, side by side.
const pdf = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });
const page = await pdf.newPage();
await page.goto(`${base}/print/site_pennine`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
const sheets = page.locator(".rp-page");
const pick = [0, 1, 3, 4];
const names = ["pdf-cover", "pdf-summary", "pdf-opportunities", "pdf-speed"];
const buffers = [];
for (const [n, i] of pick.entries()) {
  const png = await sheets.nth(i).screenshot({ path: `${out}/${names[n]}.png` });
  buffers.push(png.toString("base64"));
  console.log(`saved ${names[n]}`);
}
const sheet = await (await browser.newContext({ viewport: { width: 1800, height: 700 }, deviceScaleFactor: 1.5 })).newPage();
await sheet.setContent(`<body style="margin:0;padding:48px;background:#efe9de;display:flex;gap:28px;justify-content:center">${buffers
  .map((b) => `<img src="data:image/png;base64,${b}" style="width:390px;border-radius:3px;box-shadow:0 0 0 1px rgb(52 40 22/.08),0 24px 48px -24px rgb(52 40 22/.35)">`)
  .join("")}</body>`);
await sheet.screenshot({ path: `${out}/client-pdf.png`, fullPage: true });
console.log("saved client-pdf");

await browser.close();

// Compress for GitHub: palette PNGs at high quality are a fraction of the
// size and visually identical on these flat, paper-toned screens.
const sharp = createRequire(new URL("../apps/web/package.json", import.meta.url))("sharp");
let before = 0;
let after = 0;
for (const file of (await readdir(out)).filter((f) => f.endsWith(".png"))) {
  const input = await readFile(`${out}/${file}`);
  const output = await sharp(input).png({ palette: true, quality: 92, effort: 10, compressionLevel: 9 }).toBuffer();
  before += input.length;
  if (output.length < input.length) await writeFile(`${out}/${file}`, output);
  after += Math.min(output.length, input.length);
}
console.log(`compressed ${(before / 1048576).toFixed(1)} MB to ${(after / 1048576).toFixed(1)} MB`);
