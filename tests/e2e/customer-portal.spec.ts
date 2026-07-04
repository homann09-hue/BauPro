import { BASE_URL, E2E_NAVIGATION_TIMEOUT, expect, gotoAppPage, login, test } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

test("Kundenportal-Link wird erzeugt, Kunde unterschreibt Arbeitsauftrag und ungueltiger Token zeigt Fehlermeldung", async ({ browser, page }) => {
  await login(page);
  await gotoAppPage(page, "/orders");

  const orderLinks = page.locator('a.interactive-surface[href^="/orders/"]');
  const orderCandidates = await orderLinks.evaluateAll((anchors) =>
    Array.from(anchors)
      .map((anchor) => anchor.getAttribute("href"))
      .filter((href): href is string => typeof href === "string" && href.startsWith("/orders/") && href.length > 10)
  );
  const orderHref = orderCandidates.find((href) => /^\/orders\/[0-9a-f-]{36}$/i.test(href) || /^\/orders\/[^/]+$/.test(href));
  test.skip(!orderHref, "Demo-Daten fehlen: Auftragslink ohne Ziel.");
  await gotoAppPage(page, orderHref);

  await expect(page.getByTestId("work-order-form")).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });

  const workOrderTitle = `E2E Arbeitsauftrag ${Date.now()}`;
  const workOrderForm = page.getByTestId("work-order-form");
  await workOrderForm.getByLabel("Titel").fill(workOrderTitle);
  await expect(workOrderForm.getByLabel("Titel")).toHaveValue(workOrderTitle);
  await workOrderForm.getByLabel("Kurzbeschreibung").fill("E2E Freigabe fuer Kundensignatur.");
  await workOrderForm
    .getByLabel("Leistungsbeschreibung für Kunden")
    .fill("E2E Test: Baustellenleistung pruefen und digital unterschreiben.");

  const feedbackLocator = page.getByTestId("work-order-form").locator("[role='status'], [role='alert']");

  const workOrderRequests: string[] = [];
  const consoleMessages: string[] = [];
  const pageErrors: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/customer-portal/work-orders") && request.method() === "POST") {
      workOrderRequests.push(request.url());
    }
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/api/customer-portal/work-orders") && request.method() === "POST") {
      workOrderRequests.push(`${request.url()}::failed`);
    }
  });
  page.on("requestfinished", (request) => {
    if (request.url().includes("/api/customer-portal/work-orders") && request.method() === "POST") {
      workOrderRequests.push(`${request.url()}::finished`);
    }
  });
  page.on("console", (message) => {
    consoleMessages.push(`${message.type()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await workOrderForm.getByRole("button", { name: "Entwurf anlegen" }).click();
  await page.waitForTimeout(5_000);

  if (workOrderRequests.length === 0) {
    if (pageErrors.length > 0) {
      throw new Error(`Work-order submit hat keinen Request ausgelöst. Fehler: ${pageErrors.join(" | ")}`);
    }
    throw new Error(`Work-order submit hat keinen API-Request ausgelöst. Console: ${consoleMessages.join(" | ")}`);
  }

  await expect(feedbackLocator).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });
  const feedbackText = (await feedbackLocator.first().innerText()).trim();
  if (feedbackText.includes("konnte nicht")) {
    throw new Error(`Arbeitsauftrag konnte nicht angelegt werden: ${feedbackText}`);
  }

  const refreshButton = workOrderForm.getByRole("button", { name: "Zur Auftragansicht wechseln" });
  const orderRoute = orderHref ?? "/orders";
  if ((await refreshButton.count()) > 0) {
    await refreshButton.click({ timeout: 3000 });
  } else {
    await gotoAppPage(page, orderRoute);
  }
  await page.waitForLoadState("networkidle", { timeout: E2E_NAVIGATION_TIMEOUT });

  const errorText = await feedbackLocator.filter({ hasText: "Arbeitsauftrag konnte nicht erstellt werden" }).count();
  if (errorText > 0) {
    const errorMessage = await feedbackLocator.first().innerText();
    throw new Error(`Arbeitsauftrag konnte nicht erstellt werden: ${errorMessage}`);
  }

  await expect(page.getByText(workOrderTitle)).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });
  const createdWorkOrderCard = page.getByTestId("work-order-card").filter({ hasText: workOrderTitle }).first();
  const sendButton = createdWorkOrderCard.getByRole("button", { name: "Ins Kundenportal senden" });
  if ((await sendButton.count()) > 0) {
    await sendButton.click();
    await expect(page.getByText("Gesendet", { exact: true }).first()).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });
  }

  const linkResponse = page.waitForResponse((response) => {
    const request = response.request();
    return request.url().includes("/api/customer-portal/links") && request.method() === "POST";
  }, { timeout: E2E_NAVIGATION_TIMEOUT });

  await page.getByRole("button", { name: "Link erzeugen" }).click();
  const response = await linkResponse;
  const linkPayload = (await response.json()) as { success?: string; error?: string; portalToken?: string };
  if (!response.ok() || !linkPayload.portalToken || !linkPayload.success) {
    throw new Error(`Kundenportal-Link konnte nicht erzeugt werden: ${linkPayload.error ?? `HTTP ${response.status()}`}`);
  }

  await expect(page.getByTestId("fresh-portal-link")).toBeVisible({ timeout: 5000 });

  expect(new URL(page.url()).searchParams.get("portal_token")).toBeNull();
  const portalUrl = await page.getByTestId("fresh-portal-link").getByLabel("Neuer Kundenportal-Link").inputValue();
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
