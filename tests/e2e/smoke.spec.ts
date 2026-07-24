import { expect, login, test } from "./fixtures";

const publicRoutes = [
  "/",
  "/features",
  "/use-cases",
  "/security",
  "/pricing",
  "/about",
  "/demo",
  "/portal/e2e-abgelaufen-oder-ungueltig",
  "/login",
  "/legal/datenschutz"
];
const appRoutes = ["/dashboard", "/orders", "/baustellen", "/materials/low-stock", "/time-tracking", "/bring-lists", "/settings"];

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("mobile smoke: zentrale Seiten laden ohne Browser-Fehler", async ({ page }) => {
  const browserIssues: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserIssues.push(message.text());
  });
  page.on("pageerror", (error) => {
    browserIssues.push(error.message);
  });

  for (const route of publicRoutes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator("body"), route).toBeVisible();
  }

  const landing = await login(page);
  const protectedRoutes = landing === "onboarding" ? ["/onboarding"] : appRoutes;

  for (const route of protectedRoutes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), route).toBeLessThan(400);
    await expect(page.locator("body"), route).toBeVisible();
  }

  expect(browserIssues).toEqual([]);
});
