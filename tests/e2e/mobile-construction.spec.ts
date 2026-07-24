import { type Page } from "@playwright/test";
import { E2E_NAVIGATION_TIMEOUT, employeeUser, expect, login, selectFirstNonEmptyOption, test, testPng } from "./fixtures";

const loadingSelectors = [
  ".animate-spin",
  ".skeleton-line",
  '[aria-label="Inhalt wird geladen"]',
  '[aria-label="Dashboard-Details werden geladen"]',
  '[aria-label="Formular wird geladen"]'
].join(",");

function escapePathForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

test("Mitarbeiter nutzt die Baustellen-Bottom-Navigation ohne Browserfehler", async ({ page }) => {
  const browserIssues: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") browserIssues.push(message.text());
  });
  page.on("pageerror", (error) => {
    browserIssues.push(error.message);
  });

  await login(page, employeeUser);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  await expect(page.getByText(/Mein Arbeitstag|Heute auf Baustelle|Mein Einsatz heute/).first()).toBeVisible();

  const bottomNav = page.locator("nav").last();
  for (const label of ["Heute", "Baustellen", "Zeiten", "Material", "Berichte"]) {
    await expect(bottomNav.getByRole("link", { name: label })).toBeVisible();
  }

  await bottomNav.getByRole("link", { name: "Material" }).click();
  await expect(page).toHaveURL(/\/material-melden/);
  await expect(page.locator('input[name*="price"], input[name*="purchase"], input[name*="sales"]').first()).toHaveCount(0);
  await expect(page.getByText("Preis- und Einkaufsdaten bleiben ausgeblendet")).toBeVisible();
  await expectNoEndlessLoading("mobile Material", page);

  await bottomNav.getByRole("link", { name: "Zeiten" }).click();
  await expect(page).toHaveURL(/\/time-tracking/);
  await expectNoEndlessLoading("mobile Zeiten", page);

  expect(browserIssues).toEqual([]);
});

test("Mitarbeiter kann Zeitformular und Foto-Upload mobil starten", async ({ page }) => {
  await login(page, employeeUser);

  await page.goto("/time/new", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("time-entry-form")).toBeVisible();

  const jobsiteSelected = await selectFirstNonEmptyOption(page.locator('select[name="job_id"]'));
  test.skip(!jobsiteSelected, "Demo-Mitarbeiter hat keine zugewiesene Baustelle.");

  await page.getByLabel("Tätigkeit / Beschreibung").fill("Mobile E2E-Prüfung: Arbeitszeit auf Baustelle erfasst.");
  await expect(page.getByRole("button", { name: "Als Entwurf speichern" })).toBeVisible();

  await page.goto("/berichte/neu", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("report-form")).toBeVisible();
  await expect(page.getByText("Foto aufnehmen")).toBeVisible();
  await expectNoEndlessLoading("mobile Bericht", page);
  const photoInput = page.locator('[data-testid="photos-file-input"]');
  await photoInput.setInputFiles(testPng);
  await expect.poll(async () => photoInput.evaluate((input) => (input as HTMLInputElement).files?.length ?? 0)).toBe(1);

  await page.goto("/materials/inventory", { waitUntil: "domcontentloaded" });
  const inventoryAction = page.getByRole("link", { name: "Material buchen" });
  if ((await inventoryAction.count()) > 0) {
    await expect(inventoryAction).toBeVisible();
  }
  await expectNoEndlessLoading("mobile Inventory", page);

  const quickNav = page.locator("nav").last();
  const quickTargets = ["/time-tracking", "/berichte", "/baustellen", "/dashboard"];
  for (const href of quickTargets) {
    const link = quickNav.locator(`a[href="${href}"]`).first();
    if ((await link.count()) > 0) {
      await link.click();
      await expect(page).toHaveURL(new RegExp(`.*${escapePathForRegExp(href)}`), { timeout: E2E_NAVIGATION_TIMEOUT });
      await expectNoEndlessLoading(`mobile Schnellnavigation ${href}`, page);
    }
  }
});
