import { expect, test } from "@playwright/test";

const PAGES = ["/", "/dashboard", "/reports", "/reports/site_harlow", "/clients", "/clients/cli_harlow", "/clients/new", "/alerts", "/pipeline", "/settings"];

test.describe("responsive layout", () => {
  for (const width of [360, 390, 768, 1024]) {
    test(`no horizontal page scroll at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const path of PAGES) {
        await page.goto(path);
        const { scroll, client } = await page.evaluate(() => ({
          scroll: document.documentElement.scrollWidth,
          client: document.documentElement.clientWidth,
        }));
        expect(scroll, `${path} overflows at ${width}px`).toBeLessThanOrEqual(client);
      }
    });
  }
});

test.describe("theme", () => {
  test("the product renders in its single light Paper theme, even when the system is dark", async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: "dark" });
    const page = await context.newPage();
    await page.goto("/dashboard");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(246, 242, 234)");
    await context.close();
  });
});
