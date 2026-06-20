import { E2E_NAVIGATION_TIMEOUT, expect, gotoAppPage, login, selectFirstNonEmptyOption, test, testPng } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

test("Tagesbericht mit Pflichtfeldern, Foto-Upload und PDF-Export", async ({ page }) => {
  await login(page);
  await gotoAppPage(page, "/berichte/neu");

  const form = page.getByTestId("report-form");
  await expect(form).toBeVisible({ timeout: E2E_NAVIGATION_TIMEOUT });
  await selectFirstNonEmptyOption(form.locator('select[name="jobsite_id"]'));
  await form.getByLabel("Tätigkeiten").fill("E2E Test: Dachfläche vorbereitet, Unterspannbahn verlegt und Ortgang kontrolliert.");
  await form.getByLabel("Materialverbrauch").fill("1 Rolle Unterspannbahn, 20 Latten");
  await form.getByTestId("photos-file-input").setInputFiles(testPng);

  const detailUrlPromise = page.waitForURL(/\/berichte\/[0-9a-f-]+/, { timeout: E2E_NAVIGATION_TIMEOUT }).then(() => page.url());
  await form.getByRole("button", { name: "Einreichen" }).click();
  const detailUrl = new URL(await detailUrlPromise);
  await gotoAppPage(page, `${detailUrl.pathname}${detailUrl.search}`);

  await expect(page.getByText(/Tagesbericht wurde angelegt|Tätigkeiten/).first()).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "PDF herunterladen" }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/^tagesbericht_.*\.pdf$/);
});
