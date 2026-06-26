import { expect, login, test, todayIsoDate } from "./fixtures";

test("Chef erstellt kompletten Auftrag mit Aufmass, Material- und Kostenkalkulation", async ({ page }) => {
  const suffix = Date.now();
  const title = `E2E Auftrag Dachsanierung ${suffix}`;
  const customerCompany = `E2E Dachkunde ${suffix}`;
  const address = "Dachdeckerstrasse 12, 50667 Koeln";

  await login(page);
  await page.goto("/orders/new", { waitUntil: "domcontentloaded" });

  const form = page.locator("form").filter({ hasText: "Angebotsvorschau" }).first();
  await form.locator('select[name="customer_id"]').selectOption("new");
  await form.locator('input[name="new_customer_company"]').fill(customerCompany);
  await form.locator('input[name="new_customer_contact_person"]').fill("Erika E2E");
  await form.locator('input[name="new_customer_phone"]').fill("+49 221 123456");
  await form.locator('input[name="new_customer_email"]').fill(`auftrag-${suffix}@example.invalid`);

  await form.locator('input[name="title"]').fill(title);
  await form.locator('select[name="order_type"]').selectOption("steildach");
  await form.locator('select[name="status"]').selectOption("angebot");
  await form.locator('select[name="priority"]').selectOption("hoch");
  await form.locator('input[name="start_date"]').fill(todayIsoDate());
  await form.locator('textarea[name="jobsite_address"]').fill(address);
  await form.locator('textarea[name="description"]').fill("E2E Testauftrag: Hauptdach neu eindecken, Lattung erneuern, Unterspannbahn verlegen.");
  await form.locator('textarea[name="internal_notes"]').fill("Automatisierter QA-Test ohne echte Kundendaten.");

  await form.locator('input[name="length_m"]').fill("12");
  await form.locator('input[name="width_m"]').fill("8");
  await form.locator('input[name="roof_pitch"]').fill("38");
  await form.locator('input[name="eaves_length_m"]').fill("24");
  await form.locator('input[name="ridge_length_m"]').fill("12");
  await form.locator('input[name="verge_length_m"]').fill("16");
  await form.locator('input[name="valley_length_m"]').fill("4");
  await form.locator('input[name="hip_length_m"]').fill("3");
  await form.locator('input[name="waste_percent"]').fill("15");

  await expect(form.locator('input[name="area_m2"]')).toHaveValue("96");
  await expect(page.getByText("Dachdecker-Materialbedarf")).toBeVisible();

  await form.locator('input[name="labor_hours_estimated"]').fill("8");
  await form.locator('input[name="labor_employee_count"]').fill("3");
  await form.locator('input[name="internal_labor_rate_net"]').fill("38");
  await form.locator('input[name="labor_rate_net"]').fill("68");
  await form.locator('input[name="travel_km"]').fill("18");
  await form.locator('input[name="travel_trip_count"]').fill("2");
  await form.locator('input[name="travel_rate_per_km"]').fill("0,85");
  await form.locator('input[name="travel_flat_rate"]').fill("35");
  await form.locator('input[name="machine_extra_total_net"]').fill("120");
  await form.locator('input[name="vat_rate"]').fill("19");

  await expect(page.getByText("Brutto-Gesamtpreis").first()).toBeVisible();
  await expect(page.getByText("Geschätzte Marge")).toBeVisible();

  await form.getByRole("button", { name: "Auftrag speichern" }).click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+/, { timeout: 60_000 });
  await expect(
    page.getByText(/Auftrag, Maße, Materialbedarf und Kostenkalkulation wurden gespeichert|Datenbank-Update fehlt|Auftrag wurde gespeichert/)
  ).toBeVisible({
    timeout: 20_000
  });
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText(customerCompany, { exact: true }).first()).toBeVisible();
  const schemaGapVisible = await page.getByText("Datenbank-Update fehlt").isVisible().catch(() => false);
  if (schemaGapVisible) {
    await expect(page.getByText("20260711_ai_job_estimates_gap_fix.sql")).toBeVisible();
  } else {
    await expect(page.getByText("Chef-Kalkulation", { exact: true })).toBeVisible();
  }

  await page.goto(`/orders?q=${encodeURIComponent(title)}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(title)).toBeVisible();
  await expect(page.getByText(customerCompany, { exact: true }).first()).toBeVisible();
});
