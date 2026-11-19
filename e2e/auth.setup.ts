import { expect, test as setup } from "@playwright/test";

/** The landing page's "Open the demo" signs in as the sample agency's account manager. */
setup("sign in to the demo as the account manager", async ({ page }) => {
  await page.goto("/demo");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.context().storageState({ path: "e2e/.auth/manager.json" });
});
