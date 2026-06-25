import { BASE_URL, E2E_NAVIGATION_TIMEOUT, expect, gotoAppPage, login, test } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

test("Kundenportal-Link wird erzeugt, Kunde unterschreibt Arbeitsauftrag und ungueltiger Token zeigt Fehlermeldung", async ({ browser, page }) => {
  await login(page);
  await gotoAppPage(page, "/orders");

  const firstOrder = page.locator('a.interactive-surface[href^="/orders/"]').first();
  test.skip((await firstOrder.count()) === 0, "Demo-Daten fehlen: kein Auftrag vorhanden.");
  const orderHref = await firstOrder.getAttribute("href");
  test.skip(!orderHref, "Demo-Daten fehlen: Auftragslink ohne Ziel.");
  await gotoAppPage(page, orderHref);

  await expect(page.getByTestId("work-order-form")).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });

  const workOrderTitle = `E2E Arbeitsauftrag ${Date.now()}`;
  const workOrderForm = page.getByTestId("work-order-form");
  await workOrderForm.getByLabel("Titel").fill(workOrderTitle);
  await workOrderForm.getByLabel("Kurzbeschreibung").fill("E2E Freigabe fuer Kundensignatur.");
  await workOrderForm
    .getByLabel("Leistungsbeschreibung für Kunden")
    .fill("E2E Test: Baustellenleistung pruefen und digital unterschreiben.");
  await workOrderForm.getByRole("button", { name: "Entwurf anlegen" }).click();

  await expect(page.getByText(workOrderTitle)).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });
  const createdWorkOrderCard = page.getByTestId("work-order-card").filter({ hasText: workOrderTitle }).first();
  const sendButton = createdWorkOrderCard.getByRole("button", { name: "Ins Kundenportal senden" });
  if ((await sendButton.count()) > 0) {
    await sendButton.click();
    await expect(page.getByText("Gesendet", { exact: true }).first()).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });
  }

  await page.getByRole("button", { name: "Link erzeugen" }).click();
  await expect(page.getByText("Neuer Kundenlink, nur jetzt voll sichtbar")).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });

  const portalToken = new URL(page.url()).searchParams.get("portal_token");
  expect(portalToken).toBeTruthy();
  const portalUrl = `${BASE_URL}/portal/${encodeURIComponent(portalToken ?? "")}`;
  expect(portalUrl).toContain("/portal/");

  const portalContext = await browser.newContext({ baseURL: BASE_URL });
  await portalContext.addInitScript(() => {
    window.localStorage.setItem(
      "baupro-consent-v1",
      JSON.stringify({
        version: "2026-06-15",
        essential: true,
        analytics: false,
        marketing: false,
        decidedAt: "2026-06-20T00:00:00.000Z"
      })
    );
  });
  const portalPage = await portalContext.newPage();
  await portalPage.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: E2E_NAVIGATION_TIMEOUT });
  await expect(portalPage.getByText("Sicherer Kundenbereich")).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });

  const workOrderCard = portalPage.locator("article").filter({ hasText: workOrderTitle });
  test.skip((await workOrderCard.count()) === 0, "Arbeitsauftrag wurde im Portal nicht gefunden.");
  const signForm = workOrderCard.getByTestId("portal-work-order-sign-form");
  await signForm.getByLabel("Ihr Name").fill("Anna Schmidt");
  const canvas = signForm.locator("canvas");
  await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const eventBase = {
      bubbles: true,
      cancelable: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true
    };
    element.dispatchEvent(new PointerEvent("pointerdown", { ...eventBase, clientX: rect.left + 24, clientY: rect.top + 30 }));
    element.dispatchEvent(new PointerEvent("pointermove", { ...eventBase, clientX: rect.left + 90, clientY: rect.top + 70 }));
    element.dispatchEvent(new PointerEvent("pointermove", { ...eventBase, clientX: rect.left + 155, clientY: rect.top + 42 }));
    element.dispatchEvent(new PointerEvent("pointerup", { ...eventBase, clientX: rect.left + 155, clientY: rect.top + 42 }));
  });
  await expect(signForm.locator('input[name="signature_data_url"]')).toHaveValue(/^data:image\/jpeg;base64,/);
  await signForm.getByRole("button", { name: "Auftrag bestätigen" }).click();
  await expect(workOrderCard.getByText(/Unterschrieben von Anna Schmidt/).first()).toBeVisible({
    timeout: E2E_NAVIGATION_TIMEOUT
  });

  await portalPage.goto("/portal/e2e-abgelaufen-oder-ungueltig", {
    waitUntil: "domcontentloaded",
    timeout: E2E_NAVIGATION_TIMEOUT
  });
  await expect(portalPage.getByText(/Portal-Link ist abgelaufen oder ungültig/)).toBeVisible();
  await portalContext.close();
});
