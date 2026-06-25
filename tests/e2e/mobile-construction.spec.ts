import { employeeUser, expect, login, selectFirstNonEmptyOption, test, testPng } from "./fixtures";

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
  await expect(page.locator('input[name*="price"], input[name*="purchase"], input[name*="sales"]')).toHaveCount(0);
  await expect(page.getByText("Preis- und Einkaufsdaten bleiben ausgeblendet")).toBeVisible();

  await bottomNav.getByRole("link", { name: "Zeiten" }).click();
  await expect(page).toHaveURL(/\/time-tracking/);

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
  const photoInput = page.locator('[data-testid="photos-file-input"]');
  await photoInput.setInputFiles(testPng);
  await expect.poll(async () => photoInput.evaluate((input) => (input as HTMLInputElement).files?.length ?? 0)).toBe(1);
});
