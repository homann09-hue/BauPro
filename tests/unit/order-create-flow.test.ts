import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("new order flow", () => {
  it("validates all business-critical Pflichtfelder serverseitig", () => {
    const actions = source("lib/actions/order-actions.ts");
    const createOrderAction = actions.slice(
      actions.indexOf("export async function createOrderAction"),
      actions.indexOf("export async function updateOrderDimensionsAction")
    );

    expect(createOrderAction).toContain('requiredFormString(formData, "title", "Auftragstitel")');
    expect(createOrderAction).toContain('requiredFormString(formData, "jobsite_address", "Baustellenadresse")');
    expect(createOrderAction).toContain('requiredFormString(formData, "description", "Beschreibung")');
    expect(createOrderAction).toContain('requiredDateString(formData, "start_date", "Startdatum")');
    expect(createOrderAction).toContain("requiredOrderStatusValue(formData)");
    expect(actions).toContain("Bitte einen Kunden auswaehlen oder einen neuen Kunden anlegen.");
  });

  it("kennzeichnet dieselben Pflichtfelder im Formular fuer klare Nutzerfuehrung", () => {
    const form = source("components/forms/order-wizard-form.tsx");

    expect(form).toContain('name="customer_id"');
    expect(form).toContain('name="status" defaultValue="anfrage" required');
    expect(form).toContain('name="start_date" type="date" required');
    expect(form).toContain('label="Beschreibung"');
    expect(form).toContain('name="description"');
    expect(form).toContain('placeholder="Leistungsumfang, Zustand, Kundenwunsch"');
    expect(form).toContain("required");
  });

  it("verdrahtet die direkte Chef-Kostenkalkulation im Formular und speichert sie serverseitig", () => {
    const form = source("components/forms/order-wizard-form.tsx");
    const actions = source("lib/actions/order-actions.ts");
    const detailPage = source("app/(app)/orders/[id]/page.tsx");

    expect(form).toContain('name="material_cost_per_m2"');
    expect(form).toContain('name="material_manual_total_net"');
    expect(form).toContain('name="labor_hours_estimated"');
    expect(form).toContain('name="labor_employee_count"');
    expect(form).toContain('name="internal_labor_rate_net"');
    expect(form).toContain("Arbeitsmarge");
    expect(form).toContain('name="travel_flat_rate"');
    expect(form).toContain('name="travel_trip_count"');
    expect(form).toContain("Abrechenbare km");
    expect(form).toContain('name="tile_type"');
    expect(form).toContain('name="hip_length_m"');
    expect(form).toContain("Dachdecker-Materialbedarf");
    expect(form).toContain("Preiswarnungen");
    expect(form).toContain("Live-Kalkulation");
    expect(form).toContain("Angebotsvorschau");
    expect(form).toContain("Kunde und Baustelle");
    expect(form).toContain("Materialkosten");
    expect(form).toContain("Arbeitskosten");
    expect(form).toContain("Fahrtkosten");
    expect(form).toContain("Geschätzte Marge");
    expect(form).toContain("Auftrag speichern");
    expect(form).toContain("Angebot als PDF erstellen");
    expect(form).toContain("Bearbeiten");
    expect(form).toContain("offer-print-mode");
    expect(actions).toContain('.from("job_estimates")');
    expect(actions).toContain('.from("job_estimate_items")');
    expect(actions).toContain("calculateRoofingMaterialsFromInventory");
    expect(actions).toContain("orderCostEstimateSummary");
    expect(actions).toContain('"labor_employee_count"');
    expect(actions).toContain('"internal_labor_rate_net"');
    expect(actions).toContain('"travel_trip_count"');
    expect(actions).toContain("material_ek_total");
    expect(actions).toContain("total_gross");
    expect(detailPage).toContain("OrderCostEstimatePanel");
    expect(detailPage).toContain("context.canManage ? <OrderCostEstimatePanel");
  });
});
