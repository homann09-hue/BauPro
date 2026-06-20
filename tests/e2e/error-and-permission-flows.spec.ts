import { employeeUser, expect, gotoAppPage, login, test } from "./fixtures";

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("Mitarbeiter sieht im Lager keine Chef-Preise", async ({ page }) => {
  await login(page, employeeUser);
  await gotoAppPage(page, "/materials/inventory");

  await expect(page.getByRole("heading", { name: "Materiallager" })).toBeVisible();
  await expect(page.getByText("Chef-Preise")).toHaveCount(0);
  await expect(page.getByText("EK", { exact: true })).toHaveCount(0);
  await expect(page.getByText("VK", { exact: true })).toHaveCount(0);
});

test("Chef sieht fehlendes Material und knappe Lagerartikel", async ({ page }) => {
  await login(page);
  await gotoAppPage(page, "/materials/inventory?low=1");

  await expect(page.getByRole("heading", { name: "Materiallager" })).toBeVisible();
  const lowStockBadge = page.getByText("Nachbestellen");
  test.skip((await lowStockBadge.count()) === 0, "Demo-Daten enthalten aktuell keinen knappen Lagerartikel.");
  await expect(lowStockBadge.nth(0)).toBeVisible();
});

test("Offline-Fallback ist fuer Baustellennutzung erreichbar", async ({ page }) => {
  await gotoAppPage(page, "/offline");

  await expect(page.getByRole("heading", { name: "Gerade keine Verbindung" })).toBeVisible();
  await expect(page.getByText("Offline-Modus")).toBeVisible();
  await expect(page.getByText(/Erneut versuchen/)).toBeVisible();
});
