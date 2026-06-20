import { expect, test } from "@playwright/test";

const E2E_NAVIGATION_TIMEOUT = 60_000;

test("protected app redirects anonymous mobile users to login", async ({ page }) => {
  await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: E2E_NAVIGATION_TIMEOUT });
  await expect(page).toHaveURL(/\/login/, { timeout: E2E_NAVIGATION_TIMEOUT });
  await expect(page.getByRole("heading", { name: "Einloggen" })).toBeVisible();
  await expect(page.getByLabel("E-Mail")).toBeVisible();
  await expect(page.getByLabel("Passwort")).toBeVisible();
});
