/**
 * Drives the dashboard in database mode through a real browser: email
 * sign-in links, notes, approval, Send now, revoking a client link, alerts,
 * roles, the audit trail and PDF download, all persisted in Postgres.
 *
 *   npx tsx scripts/local-db.ts
 *   DATABASE_URL=postgres://postgres@127.0.0.1:5544/postgres npm run seed -w @reportpilot/db
 *   DATABASE_URL=… DATABASE_POOL_MAX=1 AUTH_SECRET=<32+ chars> EMAIL_MODE=test npm run start -w @reportpilot/web -- --port 3300 > web.log
 *   npx tsx scripts/db-mode-smoke.ts web.log
 *
 * Without RESEND_API_KEY the sign-in link is printed to the server log,
 * which is where this script reads it from.
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const base = "http://localhost:3300";
const log = process.argv[2]!;
const step = (m: string) => console.log("✓", m);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });

const linkFor = async (email: string) => {
  await page.goto(`${base}/sign-in`);
  await page.getByLabel("Work email").fill(email);
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  await page.getByText(/sign-in link is on its way/).waitFor();
  await new Promise((r) => setTimeout(r, 500));
  const lines = readFileSync(log, "utf8").split("\n").filter((l) => l.includes("sign-in link"));
  return JSON.parse(lines.at(-1)!.slice(lines.at(-1)!.indexOf("{"))).link as string;
};

// Unknown address: same answer, no link logged.
const before = readFileSync(log, "utf8").split("sign-in link").length;
await page.goto(`${base}/sign-in`);
await page.getByLabel("Work email").fill("stranger@example.test");
await page.getByRole("button", { name: "Email me a sign-in link" }).click();
await page.getByText(/sign-in link is on its way/).waitFor();
if (readFileSync(log, "utf8").split("sign-in link").length !== before) throw new Error("link issued for a stranger");
step("unknown email gets the same answer and no link");

const link = await linkFor("tom@northfold.studio");
await page.goto(link);
await page.waitForURL(/\/dashboard$/);
await page.getByRole("heading", { level: 1 }).filter({ hasText: "Tom" }).waitFor();
step("email link signs the manager in");

const again = await browser.newPage();
await again.goto(link);
await again.waitForURL(/sign-in\?error=expired/);
step("the same link cannot be used twice");

await page.goto(`${base}/reports`);
const harlow = page.getByRole("link", { name: /Harlow & Finch Dental/ }).first();
await harlow.click();
await page.waitForURL(/\/reports\/[0-9a-f-]{36}$/);
const reportUrl = page.url();
await page.getByRole("textbox", { name: "Your note to the client" }).fill("Saved in Postgres.");
await page.getByRole("textbox", { name: "Your note to the client" }).blur();
await page.getByText("Saved", { exact: true }).waitFor();
await page.getByRole("button", { name: "Approve report" }).click();
await page.getByText(/Report approved/).waitFor();
await page.reload();
if ((await page.getByRole("textbox", { name: "Your note to the client" }).inputValue()) !== "Saved in Postgres.") throw new Error("note not persisted");
await page.getByRole("button", { name: "Send now" }).waitFor();
step("notes and approval persist in the database");

await page.goto(reportUrl);
await page.getByRole("button", { name: "Send now" }).click();
await page.getByText(/captured in test mode|Sent to/).first().waitFor({ timeout: 60_000 });
await page.goto(`${base}/outbox`);
await page.getByText("ruth@harlowfinch-dental.test").first().waitFor();
step("send now printed the PDF and captured the email");

await page.goto(reportUrl);
const share = await page.getByRole("link", { name: /Web version/ }).getAttribute("href");
const client = await browser.newPage();
await client.goto(`${base}${share}`);
await client.getByText(/Private link for Harlow & Finch Dental/).waitFor();
await page.getByRole("button", { name: "Revoke client link" }).click();
await page.getByText(/Client link revoked/).waitFor();
const res = await client.goto(`${base}${share}`);
if (res!.status() !== 404) throw new Error(`revoked link returned ${res!.status()}`);
step("client link works, then 404s once revoked");

await page.goto(`${base}/alerts`);
await page.getByRole("button", { name: "Acknowledge" }).first().click();
await page.waitForTimeout(800);
await page.reload();
step(`alert acknowledged (${await page.getByText("Acknowledged", { exact: true }).count()} acknowledged after reload)`);

await page.goto(`${base}/settings`);
if (!(await page.getByRole("button", { name: "Save brand" }).isDisabled())) throw new Error("manager can save brand");
step("manager cannot save branding");

await page.goto(`${base}/dashboard`);
const feed = await page.locator("section[aria-labelledby=activity-heading] ol").innerText();
if (!/revoked the client link/.test(feed) || !/captured the \w+ email in test mode/.test(feed)) throw new Error(`audit feed missing actions:\n${feed}`);
step("audit trail shows the actions");

const pdf = await page.request.get(`${base}${reportUrl.replace(base, "").replace("/reports/", "/api/reports/")}/pdf`);
if (pdf.status() !== 200 || (await pdf.body()).subarray(0, 4).toString() !== "%PDF") throw new Error(`pdf ${pdf.status()}`);
step("PDF download works for a database report");

await browser.close();
