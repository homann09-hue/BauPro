import { expect, gotoAppPage, login, logout, test, testUser } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

test("Login mit gueltigen Credentials fuehrt zum Dashboard", async ({ page }) => {
  await login(page, testUser);
  await expect(page.getByText(/Betriebszentrale|Mein Arbeitstag/)).toBeVisible();
});

test("Login mit falschen Credentials zeigt Fehlermeldung", async ({ page }) => {
  await gotoAppPage(page, "/login");
  await page.getByLabel("E-Mail").fill(`falsch-${Date.now()}@example.invalid`);
  await page.getByLabel("Passwort").fill("definitiv-falsch");
  await page.getByRole("button", { name: "Einloggen" }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/E-Mail oder Passwort stimmt nicht|Login fehlgeschlagen|Zu viele Login-Versuche/)).toBeVisible();
});

test("Logout fuehrt zur Login-Seite", async ({ page }) => {
  await login(page);
  await logout(page);
  await expect(page.getByRole("heading", { name: "Einloggen" })).toBeVisible();
});
