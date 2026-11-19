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
  test.use({ colorScheme: "dark" });

  test("the product renders in its single light Paper theme, even when the system is dark", async ({ page }) => {
    await page.goto("/dashboard");
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(246, 242, 234)");
  });
});

test.describe("above the fold", () => {
  const screens: Array<[string, number, number]> = [
    ["small phone", 360, 740],
    ["phone", 390, 844],
    ["tablet", 768, 1024],
    ["tablet landscape", 1024, 768],
    ["HD laptop", 1280, 720],
    ["1366 laptop", 1366, 768],
    ["desktop", 1920, 1080],
  ];

  for (const [name, width, height] of screens) {
    test(`hero buttons are visible without scrolling on a ${name} (${width}×${height})`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      for (const label of ["Open the demo", "Read a sample report"]) {
        const box = await page.getByRole("main").getByRole("link", { name: label }).first().boundingBox();
        expect(box, label).not.toBeNull();
        expect(box!.y + box!.height, `${label} is below the fold`).toBeLessThanOrEqual(height);
      }
      if (width >= 1024) {
        const stack = await page.locator(".hero-stack").boundingBox();
        expect(stack!.y + stack!.height, "report stack is cut off").toBeLessThanOrEqual(height + 8);
      }
    });
  }

  test("the Approve button is reachable on a 1280×720 screen", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop layout only");
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/reports/site_harlow");
    const approve = page.getByRole("button", { name: "Approve report" });
    await approve.scrollIntoViewIfNeeded();
    await expect(approve).toBeInViewport();
    await approve.click();
    await expect(page.getByText(/Report approved/)).toBeVisible();
  });
});
