import { expect, test } from "@playwright/test";

/**
 * Visual regression for the client PDF. Each A4 page of the print view is
 * compared with an approved snapshot, so a CSS change that shifts a table
 * or breaks a chart is caught before a client sees it.
 */

const PAGES = ["cover", "summary", "search", "opportunities", "speed", "uptime", "next-steps", "appendix"];

test.describe("report PDF", () => {
  test.use({ viewport: { width: 794, height: 1123 } });

  for (const siteId of ["site_harlow", "site_calder"]) {
    test(`pages match approved snapshots: ${siteId}`, async ({ page }) => {
      await page.emulateMedia({ media: "print" });
      await page.goto(`/print/${siteId}`);
      await page.evaluate(() => document.fonts.ready);
      const sheets = page.locator(".rp-page");
      await expect(sheets).toHaveCount(PAGES.length);
      for (let i = 0; i < PAGES.length; i++) {
        await expect(sheets.nth(i)).toHaveScreenshot(`${siteId}-${String(i + 1).padStart(2, "0")}-${PAGES[i]}.png`);
      }
    });
  }

  test("the PDF download is a real, reasonably sized PDF", async ({ request }) => {
    const res = await request.get("/api/reports/site_harlow/pdf");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    const body = await res.body();
    expect(body.subarray(0, 4).toString()).toBe("%PDF");
    expect(body.byteLength).toBeLessThan(8 * 1024 * 1024);
  });

  test("missing speed data is shown as unavailable, never as zeros", async ({ page }) => {
    await page.goto("/print/site_thornbury");
    await expect(page.getByText("Speed data unavailable this month")).toBeVisible();
  });
});
