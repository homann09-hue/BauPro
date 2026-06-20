import { employeeUser, expect, login, selectFirstNonEmptyOption, test, todayIsoDate } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

test("Mitarbeiter legt Arbeitszeit an, Chef genehmigt und exportiert CSV", async ({ page }) => {
  await login(page, employeeUser);
  await page.goto("/time-tracking/new");

  const hasJobsite = await selectFirstNonEmptyOption(page.getByLabel("Baustelle / Auftrag"));
  test.skip(!hasJobsite, "Demo-Daten fehlen: Mitarbeiter hat keine zugewiesene Baustelle.");

  await page.getByLabel("Datum").fill(todayIsoDate());
  await page.getByLabel("Tätigkeit / Beschreibung").fill("E2E Test: Unterspannbahn verlegt und Baustelle dokumentiert.");
  await page.getByRole("button", { name: "Einreichen" }).click();
  await expect(page).toHaveURL(/\/time-tracking/);
  await expect(page.getByText(/Arbeitszeit wurde gespeichert/)).toBeVisible();

  await page.getByRole("button", { name: "Abmelden" }).click();
  await login(page);
  await page.goto("/time-tracking/daily?range=today");

  await expect(page.getByRole("heading", { name: "Tagesstunden" })).toBeVisible();
  const approveButton = page.getByRole("button", { name: "Genehmigen" }).first();
  await expect(approveButton).toBeVisible();
  await approveButton.click();
  await expect(page.getByText(/Status wurde gespeichert|Genehmigt/)).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Tages-CSV/ }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});
