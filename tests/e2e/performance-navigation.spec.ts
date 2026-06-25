import type { Page } from "@playwright/test";
import { E2E_NAVIGATION_TIMEOUT, expect, login, test } from "./fixtures";

const publicRoutes = [
  "/",
  "/login",
  "/demo",
  "/pricing",
  "/features",
  "/security",
  "/faq",
  "/legal/datenschutz",
  "/legal/agb",
  "/legal/impressum",
  "/legal/cookies"
];

const managerRoutes = [
  "/dashboard",
  "/morgen",
  "/baustellen",
  "/customers",
  "/orders",
  "/material",
  "/materials/inventory",
  "/materials/locations",
  "/materials/low-stock",
  "/bring-lists",
  "/time-tracking",
  "/berichte",
  "/team",
  "/fahrzeuge",
  "/settings",
  "/debug/system",
  "/plantafel"
];

const loadingSelectors = [
  ".animate-spin",
  ".skeleton-line",
  '[aria-label="Inhalt wird geladen"]',
  '[aria-label="Dashboard-Details werden geladen"]',
  '[aria-label="Formular wird geladen"]'
].join(",");

async function expectNoEndlessLoading(route: string, page: Page) {
  const locator = page.locator(loadingSelectors);
  const visibleCount = async () => {
    const count = await locator.count();
    let visible = 0;
    for (let index = 0; index < count; index += 1) {
      if (await locator.nth(index).isVisible().catch(() => false)) visible += 1;
    }
    return visible;
  };

  if ((await visibleCount()) === 0) return;
  await expect
    .poll(visibleCount, {
      message: `${route} hat nach 10 Sekunden noch Ladezustände sichtbar`,
      timeout: 10_000
    })
    .toBe(0);
}

async function openMeasured(page: Page, route: string) {
  const start = Date.now();
  const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: E2E_NAVIGATION_TIMEOUT });
  await expect(page.locator("body"), route).toBeVisible({ timeout: 10_000 });
  await expectNoEndlessLoading(route, page);
  return {
    status: response?.status() ?? 0,
    duration: Date.now() - start,
    url: page.url()
  };
}

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

test("öffentliche und eingeloggte Hauptseiten laden ohne Endlos-Spinner", async ({ page }, testInfo) => {
  const browserIssues: string[] = [];
  const measurements: Array<{ route: string; status: number; duration: number; url: string }> = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserIssues.push(`${page.url()} :: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    browserIssues.push(`${page.url()} :: ${error.message}`);
  });

  for (const route of publicRoutes) {
    const result = await openMeasured(page, route);
    measurements.push({ route, ...result });
    expect(result.status, route).toBeLessThan(400);
    expect(result.duration, `${route} ist ungewöhnlich langsam`).toBeLessThan(12_000);
  }

  const loginStart = Date.now();
  const landing = await login(page);
  const loginDuration = Date.now() - loginStart;
  expect(loginDuration, "Login zu Dashboard/Onboarding ist ungewöhnlich langsam").toBeLessThan(20_000);

  await openMeasured(page, "/");
  const dashboardLink = page.getByRole("link", { name: /Zum Dashboard/ }).first();
  await expect(dashboardLink).toBeVisible({ timeout: 10_000 });
  const dashboardClickStart = Date.now();
  await dashboardLink.click();
  await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: E2E_NAVIGATION_TIMEOUT });
  const dashboardClickDuration = Date.now() - dashboardClickStart;
  expect(dashboardClickDuration, "Startseite zu Dashboard ist ungewöhnlich langsam").toBeLessThan(12_000);
  await expectNoEndlessLoading("Startseite zu Dashboard", page);

  const protectedRoutes = landing === "onboarding" ? ["/onboarding"] : managerRoutes;
  for (const route of protectedRoutes) {
    const result = await openMeasured(page, route);
    measurements.push({ route, ...result });
    expect(result.status, route).toBeLessThan(400);
    expect(result.duration, `${route} ist ungewöhnlich langsam`).toBeLessThan(15_000);
  }

  await testInfo.attach("route-performance.json", {
    body: JSON.stringify({ loginDuration, dashboardClickDuration, measurements }, null, 2),
    contentType: "application/json"
  });
  expect(browserIssues).toEqual([]);
});
