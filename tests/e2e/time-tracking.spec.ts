import { employeeUser, expect, gotoAppPage, login, selectFirstNonEmptyOption, test, todayIsoDate } from "./fixtures";

test.use({ viewport: { width: 1440, height: 1000 }, isMobile: false, hasTouch: false });

test("Mitarbeiter legt Arbeitszeit an, Chef genehmigt und exportiert CSV", async ({ page }) => {
  const activityText = `E2E Test ${Date.now()}: Unterspannbahn verlegt und Baustelle dokumentiert.`;

  await login(page, employeeUser);
  await gotoAppPage(page, "/time-tracking/new");

  const form = page.getByTestId("time-entry-form");
  const hasJobsite = await selectFirstNonEmptyOption(form.locator('select[name="job_id"]'));
  test.skip(!hasJobsite, "Demo-Daten fehlen: Mitarbeiter hat keine zugewiesene Baustelle.");

  await form.locator('input[name="date"]').fill(todayIsoDate());
  const activity = form.locator('textarea[name="activity"]');
  await activity.fill(activityText);
  await expect(activity).toHaveValue(/Unterspannbahn verlegt/);
  await form.getByRole("button", { name: "Einreichen" }).click();
  await expect(page).toHaveURL(/\/time-tracking\?/, { timeout: 15_000 });
  await expect(page.getByText(/Arbeitszeit wurde gespeichert/)).toBeVisible();

  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("wirklich abmelden");
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Abmelden" }).click();
  await login(page);
  await gotoAppPage(page, "/time-tracking/daily?range=today");

  await expect(page.getByRole("heading", { name: "Tagesstunden" })).toBeVisible();
  const entryCard = page.getByTestId("daily-time-entry").filter({ hasText: activityText });
  await expect(entryCard).toBeVisible({ timeout: 15_000 });
  const approveButton = entryCard.getByRole("button", { name: "Genehmigen" });
  await expect(approveButton).toBeVisible();
  await approveButton.click();
  await expect(
    page.getByTestId("daily-time-entry").filter({ hasText: activityText }).locator("span").filter({ hasText: /Freigegeben|Genehmigt/ })
  ).toBeVisible({ timeout: 20_000 });

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Tages-CSV/ }).click()
  ]);
  expect(download.suggestedFilename()).toMatch(/\.csv$/);
});
