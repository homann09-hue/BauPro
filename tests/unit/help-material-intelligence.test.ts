import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canSeeHelpTip, helpTipByKey } from "@/lib/help/help-content";
import { calculateMaterialAvailability, summarizeAvailability } from "@/lib/inventory/availability";
import { parseMaterialConsumptionText } from "@/lib/inventory/consumption";
import { planPurchaseSuggestion } from "@/lib/inventory/purchase-planning";
import { canReserveMaterial } from "@/lib/inventory/reservations-logic";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("help and material intelligence", () => {
  it("shows manager help only to chef and worker help to operational roles", () => {
    expect(canSeeHelpTip("chef", "manager")).toBe(true);
    expect(canSeeHelpTip("admin", "manager")).toBe(true);
    expect(canSeeHelpTip("vorarbeiter", "manager")).toBe(false);
    expect(canSeeHelpTip("mitarbeiter", "manager")).toBe(false);
    expect(canSeeHelpTip("mitarbeiter", "worker")).toBe(true);
    expect(canSeeHelpTip("vorarbeiter", "worker")).toBe(true);
    expect(helpTipByKey("material_control_center")?.audience).toBe("manager");
  });

  it("calculates missing material, ordered fallback and summary risk", () => {
    const missing = calculateMaterialAvailability({
      requiredQuantity: 20,
      stockQuantity: 12,
      reservedQuantity: 4,
      minimumStock: 5,
      unit: "Stueck",
      locationName: "Fahrzeug 1",
      locationType: "Fahrzeuglager"
    });
    const ordered = calculateMaterialAvailability({
      requiredQuantity: 10,
      stockQuantity: 2,
      orderedQuantity: 8,
      unit: "Rollen",
      locationType: "Lieferant/offen bestellt"
    });

    expect(missing.availableQuantity).toBe(8);
    expect(missing.missingQuantity).toBe(12);
    expect(missing.riskLevel).toBe("red");
    expect(ordered.riskLevel).toBe("blue");
    expect(summarizeAvailability([missing, ordered]).riskLevel).toBe("red");
  });

  it("plans purchase suggestions from stock gaps without price data", () => {
    const suggestion = planPurchaseSuggestion({
      materialName: "Unterspannbahn",
      unit: "m2",
      requiredQuantity: 120,
      stockQuantity: 80,
      reservedQuantity: 20,
      minimumStock: 30,
      jobsiteName: "Musterstrasse"
    });

    expect(suggestion?.quantityToBuy).toBe(60);
    expect(suggestion?.urgency).toBe("kritisch");
    expect(JSON.stringify(suggestion)).not.toMatch(/purchase_price|sales_price|price_net|price_gross|margin|markup/i);
  });

  it("prevents double planning through reservation availability math", () => {
    expect(canReserveMaterial({ stockQuantity: 10, alreadyReservedQuantity: 4, requestedQuantity: 6 })).toEqual({
      ok: true,
      availableQuantity: 6,
      missingQuantity: 0
    });
    expect(canReserveMaterial({ stockQuantity: 10, alreadyReservedQuantity: 7, requestedQuantity: 6 })).toEqual({
      ok: false,
      availableQuantity: 3,
      missingQuantity: 3
    });
  });

  it("parses spoken consumption drafts for later confirmation", () => {
    const drafts = parseMaterialConsumptionText("Verbraucht 3 Rollen Unterspannbahn und 12 Stück Spenglerschrauben.");

    expect(drafts).toHaveLength(2);
    expect(drafts[0]).toMatchObject({ quantity: 3, unit: "Rollen" });
    expect(drafts[1].materialName.toLowerCase()).toContain("spenglerschrauben");
  });

  it("persists help state and material intelligence in schema with RLS", () => {
    const schema = source("supabase/schema.sql");
    const migration = source("supabase/migrations/20260616_help_material_intelligence.sql");

    for (const sql of [schema, migration]) {
      expect(sql).toContain("create table if not exists public.user_help_state");
      expect(sql).toContain("create table if not exists public.bring_list_availability_snapshots");
      expect(sql).toContain("create table if not exists public.material_movements");
      expect(sql).toContain("alter table public.user_help_state force row level security");
      expect(sql).toContain("alter table public.material_movements force row level security");
      expect(sql).toContain("create or replace function public.consume_inventory_item");
    }
  });

  it("keeps employee routes free of material price fields and gates the control center", () => {
    const employeePages = [
      source("app/(app)/material-melden/page.tsx"),
      source("app/(app)/bring-lists/page.tsx"),
      source("app/(app)/bring-lists/[id]/page.tsx")
    ].join("\n");

    expect(employeePages).not.toMatch(/purchase_price|sales_price|price_net|price_gross|margin_total|markup_percent/);
    expect(source("app/(app)/materials/control-center/page.tsx")).toContain("requireManager");
  });
});
