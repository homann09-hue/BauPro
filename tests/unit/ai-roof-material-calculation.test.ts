import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFallbackJobDraft } from "@/lib/ai/job-drafts";
import { calculateRuleResult, type CalculationInput } from "@/lib/material-calculations";
import type { MaterialCalculationRule } from "@/types/app";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function input(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    roof_form: "satteldach",
    material_type: "tonziegel",
    length_m: null,
    width_m: null,
    area_m2: 100,
    roof_pitch: 35,
    eaves_length_m: 18,
    ridge_length_m: 10,
    verge_length_m: 14,
    valley_length_m: 4,
    wall_connection_length_m: 3,
    penetrations_count: 1,
    roof_windows_count: 2,
    dormers_count: 2,
    chimneys_count: 1,
    waste_percent: 20,
    ...overrides
  };
}

function rule(overrides: Partial<MaterialCalculationRule>): MaterialCalculationRule {
  return {
    id: "rule-1",
    company_id: null,
    rule_key: "test_rule",
    roof_type: "steildach",
    name: "Test",
    material_name: "Testmaterial",
    catalog_item_id: null,
    unit: "Stueck",
    calculation_method: "area",
    factor: 1,
    spacing_m: null,
    waste_applies: true,
    sort_order: 1,
    active: true,
    ...overrides
  };
}

describe("AI-assisted roof material calculation", () => {
  it("calculates dormer and chimney based roof accessories with waste", () => {
    expect(calculateRuleResult(rule({ calculation_method: "dormers_count" }), input()).totalQuantity).toBe(3);
    expect(calculateRuleResult(rule({ calculation_method: "chimneys_count" }), input()).totalQuantity).toBe(2);
  });

  it("extracts a usable roof measurement draft without an OpenAI key", () => {
    const draft = createFallbackJobDraft(
      "Kunde Müller, Satteldach Tonziegel, Adresse Dachdeckerstraße 12, 120 m2, Dachneigung 35 Grad, First 12 m, Traufe 24 m, Ortgang 16 m, 2 Dachfenster"
    );

    expect(draft.order_type).toBe("steildach");
    expect(draft.roof_form).toBe("satteldach");
    expect(draft.material_type).toBe("tonziegel");
    expect(draft.customer_name).toBe("Müller");
    expect(draft.jobsite_address).toContain("Dachdeckerstraße");
    expect(draft.dimensions.area_m2).toBe(120);
    expect(draft.dimensions.ridge_length_m).toBe(12);
    expect(draft.dimensions.eaves_length_m).toBe(24);
    expect(draft.dimensions.verge_length_m).toBe(16);
    expect(draft.dimensions.roof_windows_count).toBe(2);
    expect(draft.internal_notes).toContain("Regelbasierter Fallback");
  });

  it("ships fallback rules for typical roofer material needs", () => {
    const orderMaterials = source("lib/order-materials.ts");

    for (const key of [
      "steildach_dachziegel",
      "steildach_dachlatten",
      "steildach_konterlatten",
      "steildach_unterspannbahn",
      "steildach_befestigung",
      "steildach_firstrolle",
      "steildach_ortgang",
      "steildach_kehlblech",
      "flachdach_dampfsperre",
      "flachdach_daemmung",
      "flachdach_voranstrich",
      "entwaesserung_dachrinne",
      "entwaesserung_rinnenhalter",
      "entwaesserung_fallrohr"
    ]) {
      expect(orderMaterials).toContain(key);
    }

    expect(orderMaterials).toContain("calculationContext");
    expect(orderMaterials).toContain("includePrices ? \"inventory_items\" : \"inventory_items_public\"");
  });

  it("wires form, action and AI helper as confirmation-only proposal", () => {
    const form = source("components/forms/material-calculation-form.tsx");
    const action = source("lib/actions/material-calculation-actions.ts");
    const ai = source("lib/ai/material-calculation.ts");
    const wizard = source("app/(app)/ai/job-wizard/page.tsx");
    const jobActions = source("lib/actions/ai-job-actions.ts");
    const jobDrafts = source("lib/ai/job-drafts.ts");

    expect(form).toContain('name="roof_form"');
    expect(form).toContain('name="material_type"');
    expect(form).toContain('name="dormers_count"');
    expect(form).toContain('name="chimneys_count"');
    expect(form).toContain('name="use_ai"');
    expect(form).toContain("müssen fachlich kontrolliert werden");

    expect(action).toContain("suggestRoofMaterialCalculation");
    expect(action).toContain("checkAiLimit");
    expect(action).toContain("await checkRateLimit(`ai:material-calculation");
    expect(action).toContain("missing_quantity");
    expect(action).toContain('source: "ai"');
    expect(action).toContain("review_notice");
    expect(action).not.toContain('formData, "company_id"');

    expect(ai).toContain("createStructuredAiResponse");
    expect(ai).toContain("material_calculation");
    expect(ai).toContain("Keine Statik");
    expect(ai).toContain("keine verbindliche Fachplanung");

    expect(wizard).toContain("requireManager");
    expect(wizard).toContain('name="roof_form"');
    expect(wizard).toContain('name="material_type"');
    expect(wizard).toContain("Entwurf - fachlich prüfen");
    expect(wizard).toContain("createOrderFromAiDraftAction");
    expect(jobActions).toContain("structuredJobInput");
    expect(jobActions).toContain("Eingabe ist zu lang");
    expect(jobActions).toContain("requireManager");
    expect(jobActions).toContain("createOrderFromAiDraftAction");
    expect(jobDrafts).toContain("isOpenAiConfigured");
    expect(jobDrafts).toContain("regel-fallback");
    expect(jobDrafts).toContain("Keine automatische Bestellung");
  });
});
