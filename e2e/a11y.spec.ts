import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Automated WCAG 2.2 AA checks with axe on every page type. axe catches
 * roughly a third of accessibility problems (contrast, names, roles,
 * structure); keyboard and screen-reader passes are still done by hand.
 */

const PAGES = [
  "/", "/sign-in", "/dashboard", "/reports", "/reports/site_harlow", "/clients", "/clients/cli_harlow", "/clients/new",
  "/alerts", "/pipeline", "/outbox", "/settings",
];

test.describe("axe: WCAG 2.2 AA", () => {
  test.use({ reducedMotion: "reduce" });

  for (const path of PAGES) {
    test(`no violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        // The A4 report preview is a scaled picture of a print document; it is checked as a PDF (tagged, with an outline) instead.
        .exclude(".rp")
        .analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(summary, summary.join("\n")).toEqual([]);
    });
  }
});
