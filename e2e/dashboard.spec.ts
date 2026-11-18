import { expect, test } from "@playwright/test";

test.describe("dashboard", () => {
  test("overview greets the manager and lists work waiting on them", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tom");
    await expect(page.getByRole("heading", { name: /Needs you/ })).toBeVisible();
    await expect(page.getByText("Calder Valley Vets").first()).toBeVisible();
  });

  test("review flow: approve a report and see the workflow advance", async ({ page, isMobile }) => {
    await page.goto("/reports/site_harlow");
    if (isMobile) await page.getByRole("tab", { name: "review", exact: true }).click();
    await expect(page.getByRole("list", { name: "Approval workflow" })).toBeVisible();
    await page.getByRole("button", { name: "Approve report" }).click();
    await expect(page.getByText(/Report approved/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Send now" })).toBeVisible();
  });

  test("filters reports by status", async ({ page }) => {
    await page.goto("/reports?status=sent");
    await expect(page.getByRole("heading", { level: 2, name: "Sent" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Draft" })).toHaveCount(0);
  });

  test("onboarding validates before moving on", async ({ page }) => {
    await page.goto("/clients/new");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Enter the client's business name.")).toBeVisible();
    await page.getByLabel("Business name").fill("Wren & Co");
    await page.getByLabel("Contact email").fill("hello@wren.test");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Which site are we reporting on?" })).toBeVisible();
  });

  test("alerts can be acknowledged", async ({ page }) => {
    await page.goto("/alerts");
    const first = page.locator("li", { hasText: "SSL certificate expires in 5 days" });
    await first.getByRole("button", { name: "Acknowledge" }).first().click();
    await expect(first.getByText("Acknowledged")).toBeVisible();
  });

  test("mobile navigation opens and closes", async ({ page, isMobile }) => {
    test.skip(!isMobile, "drawer only exists on small screens");
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator("#mobile-nav").getByRole("link", { name: "Alerts" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#mobile-nav")).toHaveAttribute("inert", "");
  });
});

test.describe("accessibility and motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("content is fully visible with reduced motion", async ({ page }) => {
    for (const path of ["/", "/dashboard", "/reports"]) {
      await page.goto(path);
      const h1 = page.getByRole("heading", { level: 1 });
      await expect(h1).toBeVisible();
      const minOpacity = await h1.evaluate((el) => {
        let node: Element | null = el;
        let min = 1;
        while (node) {
          min = Math.min(min, Number(getComputedStyle(node).opacity));
          node = node.parentElement;
        }
        return min;
      });
      expect(minOpacity, `${path} heading or an ancestor is transparent`).toBe(1);
    }
  });

  test("there is a skip link and every page has one h1", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });
});

test.describe("client links", () => {
  test("shared report pages are not indexable", async ({ request }) => {
    const home = await request.get("/");
    const html = await home.text();
    const token = /href="\/r\/([a-z0-9]+)"/.exec(html)?.[1];
    expect(token).toBeTruthy();
    const res = await request.get(`/r/${token}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["x-robots-tag"]).toContain("noindex");
  });

  test("unknown tokens get the designed 404", async ({ page }) => {
    const res = await page.goto("/r/not-a-real-token");
    expect(res?.status()).toBe(404);
    await expect(page.getByText("This page isn't here")).toBeVisible();
  });
});
