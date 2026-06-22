import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
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

  it("wires form, action and AI helper as confirmation-only proposal", () => {
    const form = source("components/forms/material-calculation-form.tsx");
    const action = source("lib/actions/material-calculation-actions.ts");
    const ai = source("lib/ai/material-calculation.ts");

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
  });
});
