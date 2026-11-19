import { expect, test } from "@playwright/test";

/**
 * The spec's end-to-end test: onboard a client → generate a report →
 * approve → the email is captured in test mode. Then the client link is
 * revoked and stops working. Runs against the demo, where nothing is ever
 * really sent.
 */
test("onboard a client, generate, approve, send, and capture the email", async ({ page }) => {
  // 1. Onboard
  await page.goto("/clients/new");
  await page.getByLabel("Business name").fill("Wren & Ash Florists");
  await page.getByLabel("Contact name").fill("Hana Wren");
  await page.getByLabel("Contact email").fill("hana@wrenash.test");
  await page.getByLabel("Report day").selectOption("4");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Website address").fill("https://www.wrenash-florists.test");
  await page.getByRole("button", { name: "Add page" }).click();
  await page.getByLabel("Key page 2", { exact: true }).fill("/weddings/");
  await page.getByLabel("Brand terms").fill("wren|ash");
  await page.getByRole("button", { name: "Continue" }).click();

  // 2. Search Console: the demo says plainly that it did not really check.
  await page.getByRole("button", { name: "Test connection" }).click();
  await expect(page.getByRole("status")).toContainText("Demo mode");
  await page.getByRole("button", { name: "Continue" }).click();

  // 3. Generate the first report
  await page.getByRole("button", { name: "Create and generate" }).click();
  await page.getByRole("link", { name: "Open report" }).click();
  // The page header; the embedded A4 cover carries its own h1 for the PDF outline.
  await expect(page.getByRole("heading", { level: 1 }).first()).toContainText("Wren & Ash Florists");

  // 4. Add a note, approve
  await page.getByRole("textbox", { name: "Your note to the client" }).fill("Welcome aboard. This first report sets the baseline.");
  await page.getByRole("textbox", { name: "Your note to the client" }).blur();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve report" }).click();
  await expect(page.getByText(/Report approved/)).toBeVisible();

  // 5. Send: captured, not sent
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText(/captured in test mode/)).toBeVisible();

  // 6. The captured email is in Sent emails, addressed to the contact
  await page.goto("/outbox");
  const email = page.getByRole("listitem").filter({ hasText: "wrenash-florists.test" });
  await expect(email).toContainText("hana@wrenash.test");
  await expect(email.locator("iframe")).toBeVisible();
  const frame = email.frameLocator("iframe");
  await expect(frame.getByText("Hi Hana,")).toBeVisible();

  // 7. The new client and the send show up in the audit trail
  await page.goto("/dashboard");
  await expect(page.getByText(/added a client/).first()).toBeVisible();
});

test("a revoked client link stops working, and a new one can be issued", async ({ page, context }) => {
  await page.goto("/reports/site_harlow");
  const link = await page.getByRole("link", { name: /Web version/ }).getAttribute("href");
  expect(link).toMatch(/^\/r\/[0-9a-f]{32}$/);
  const client = await context.newPage();
  await client.goto(link!);
  await expect(client.getByText("Private link for Harlow & Finch Dental")).toBeVisible();

  await page.getByRole("button", { name: "Revoke client link" }).click();
  await expect(page.getByText(/Client link revoked/)).toBeVisible();
  const res = await client.goto(link!);
  expect(res!.status()).toBe(404);

  await page.getByRole("button", { name: "Issue a new link" }).click();
  await expect(page.getByText(/New 90-day link issued/)).toBeVisible();
  const fresh = await page.getByRole("link", { name: /Web version/ }).getAttribute("href");
  expect(fresh).not.toBe(link);
});

test("notes and approvals persist across reloads", async ({ page }) => {
  await page.goto("/reports/site_pennine");
  await page.getByRole("textbox", { name: "Your note to the client" }).fill("Category pages first, then the walking boots collection.");
  await page.getByRole("textbox", { name: "Your note to the client" }).blur();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Approve report" }).click();
  await expect(page.getByText(/Report approved/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Your note to the client" })).toHaveValue("Category pages first, then the walking boots collection.");
  await expect(page.getByRole("button", { name: "Send now" })).toBeVisible();
});

test("an approved report cannot be sent twice", async ({ page }) => {
  await page.goto("/reports/site_marlowe");
  await page.getByRole("button", { name: "Send now" }).click();
  await expect(page.getByText(/captured in test mode/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Send now" })).toHaveCount(0);
  await expect(page.getByText(/Sent to Helen Marlowe/)).toBeVisible();
});
