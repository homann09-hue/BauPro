import { BASE_URL, expect, login, test } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

test("Kundenportal-Link wird erzeugt, ohne Login geoeffnet und ungueltiger Token zeigt Fehlermeldung", async ({ browser, page }) => {
  await login(page);
  await page.goto("/orders");

  const firstOrder = page.locator('a.interactive-surface[href^="/orders/"]').first();
  test.skip((await firstOrder.count()) === 0, "Demo-Daten fehlen: kein Auftrag vorhanden.");
  await firstOrder.click();

  await expect(page.getByText("Kundenfreigabe & Arbeitsauftrag")).toBeVisible();
  await page.getByRole("button", { name: "Link erzeugen" }).click();
  await expect(page.getByText("Neuer Kundenlink, nur jetzt voll sichtbar")).toBeVisible();

  const portalUrl = await page.locator('input[readonly][value*="/portal/"]').first().inputValue();
  expect(portalUrl).toContain("/portal/");

  const portalContext = await browser.newContext({ baseURL: BASE_URL });
  const portalPage = await portalContext.newPage();
  await portalPage.goto(portalUrl);
  await expect(portalPage.getByText("Sicherer Kundenbereich")).toBeVisible();

  await portalPage.goto("/portal/e2e-abgelaufen-oder-ungueltig");
  await expect(portalPage.getByText(/Portal-Link ist abgelaufen oder ungueltig/)).toBeVisible();
  await portalContext.close();
});
