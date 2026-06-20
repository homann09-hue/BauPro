import { expect, login, selectFirstNonEmptyOption, test, testPng } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

test("Tagesbericht mit Pflichtfeldern, Foto-Upload und PDF-Export", async ({ page }) => {
  await login(page);
  await page.goto("/berichte/neu");

  await selectFirstNonEmptyOption(page.getByLabel("Baustelle"));
  await page.getByLabel("Tätigkeiten").fill("E2E Test: Dachfläche vorbereitet, Unterspannbahn verlegt und Ortgang kontrolliert.");
  await page.getByLabel("Materialverbrauch").fill("1 Rolle Unterspannbahn, 20 Latten");
  await page.getByLabel("Fotos hochladen").setInputFiles(testPng);
  await page.getByRole("button", { name: "Tagesbericht speichern" }).click();

  await expect(page).toHaveURL(/\/berichte\/[0-9a-f-]+/);
  await expect(page.getByText(/Tagesbericht wurde angelegt|Tätigkeiten/)).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "PDF herunterladen" }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/^tagesbericht_.*\.pdf$/);
});
