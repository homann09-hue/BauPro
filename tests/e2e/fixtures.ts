import { expect, test as base, type BrowserContext, type Locator, type Page } from "@playwright/test";

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
export const E2E_NAVIGATION_TIMEOUT = 60_000;

export const testUser = {
  email: process.env.E2E_CHEF_EMAIL || "chef@mueller-dachtechnik.example",
  password: process.env.E2E_CHEF_PASSWORD || process.env.DEMO_USER_PASSWORD || "BauProDemo!2026"
};

export const employeeUser = {
  email: process.env.E2E_EMPLOYEE_EMAIL || "max@mueller-dachtechnik.example",
  password: process.env.E2E_EMPLOYEE_PASSWORD || process.env.DEMO_USER_PASSWORD || "BauProDemo!2026"
};

export const testPng = {
  name: "baustelle-test.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lQnQ4wAAAABJRU5ErkJggg==",
    "base64"
  )
};

async function mockExternalServices(context: BrowserContext) {
  await context.addInitScript(() => {
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
  await context.route(/https:\/\/api\.openai\.com\/.*/i, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ output: [] }) });
  });
  await context.route(/https:\/\/api\.stripe\.com\/.*/i, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "mock_stripe" }) });
  });
  await context.route(/https:\/\/.*sentry\.io\/.*/i, async (route) => {
    await route.fulfill({ status: 204, body: "" });
  });
}

export const test = base.extend({
  context: async ({ context }, run) => {
    await mockExternalServices(context);
    await run(context);
  }
});

export { expect };

export type LoginLanding = "dashboard" | "onboarding";

export async function login(page: Page, user = testUser): Promise<LoginLanding> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.goto("/login", { waitUntil: "domcontentloaded", timeout: E2E_NAVIGATION_TIMEOUT });
    await page.getByLabel("E-Mail").fill(user.email);
    await page.getByLabel("Passwort").fill(user.password);
    await page.getByRole("button", { name: "Einloggen" }).click();

    try {
      await expect(page).toHaveURL(/\/(dashboard|onboarding)/, { timeout: E2E_NAVIGATION_TIMEOUT });
      return page.url().includes("/onboarding") ? "onboarding" : "dashboard";
    } catch (error) {
      if (attempt === 0 && page.url().startsWith("chrome-error://")) {
        await page.waitForTimeout(1_000);
        continue;
      }

      throw error;
    }
  }

  throw new Error("Login konnte nicht abgeschlossen werden.");
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/(\?success=|$)/, { timeout: E2E_NAVIGATION_TIMEOUT });
}

export async function selectFirstNonEmptyOption(select: Locator) {
  const options = select.locator("option");
  const count = await options.count();

  for (let index = 0; index < count; index += 1) {
    const value = await options.nth(index).getAttribute("value");
    if (value) {
      await select.selectOption(value);
      return true;
    }
  }

  return false;
}

export async function gotoAppPage(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded", timeout: E2E_NAVIGATION_TIMEOUT });
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}
