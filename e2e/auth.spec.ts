import { expect, test } from "@playwright/test";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("dashboard pages redirect to sign-in and come back afterwards", async ({ page }) => {
    await page.goto("/reports/site_harlow");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Freports%2Fsite_harlow/);
    await page.getByRole("button", { name: /Continue as Tom Haverley/ }).click();
    await expect(page).toHaveURL(/\/reports\/site_harlow$/);
  });

  test("the print page and PDF route are not readable without a session or signature", async ({ page, request }) => {
    const print = await page.goto("/print/site_harlow");
    expect(print!.status()).toBe(404);
    const pdf = await request.get("/api/reports/site_harlow/pdf", { maxRedirects: 0 });
    expect(pdf.status()).toBe(307);
  });

  test("a forged session cookie is rejected", async ({ page, context }) => {
    await context.addCookies([{ name: "rp_session", value: "eyJ1aWQiOiJ4In0.bm9wZQ", url: "http://localhost:3200" }]);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test("client report links stay public", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Read a sample report" }).first().click();
    await expect(page.getByText(/Private link for Harlow & Finch Dental/)).toBeVisible();
  });
});

test.describe("roles", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("a viewer can read but not approve", async ({ page }) => {
    await page.goto("/demo?as=viewer");
    await page.goto("/reports/site_harlow");
    await expect(page.getByText(/signed in as a viewer/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve report" })).toHaveCount(0);
    await expect(page.getByRole("textbox", { name: "Your note to the client" })).toBeDisabled();
  });

  test("only the owner can save branding", async ({ page }) => {
    await page.goto("/demo?as=manager");
    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Save brand" })).toBeDisabled();

    await page.goto("/demo?as=owner");
    await page.goto("/settings");
    await page.getByRole("button", { name: "Cobalt" }).click();
    await page.getByRole("button", { name: "Save brand" }).click();
    await expect(page.getByText(/Brand saved/)).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("primary colour hex")).toHaveValue("#0b5cc4");
  });

  test("signing out ends the session", async ({ page }) => {
    await page.goto("/demo");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in/);
  });
});
