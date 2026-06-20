import { describe, expect, it } from "vitest";
import { mergeAutomaticBringListItems, type AutomaticBringListItemDraft } from "@/lib/bring-lists/auto-generate-utils";

function draft(partial: Partial<AutomaticBringListItemDraft>): AutomaticBringListItemDraft {
  return {
    name: "Unterspannbahn",
    quantity: 1,
    unit: "m2",
    itemType: "material",
    materialId: null,
    inventoryItemId: "inventory-1",
    sourceType: "order_material",
    sourceRef: "requirement-1",
    vehicleId: null,
    requiredVehicleId: null,
    notes: null,
    ...partial
  };
}

describe("automatic bring list generation", () => {
  it("merges duplicate automatic positions without losing the source", () => {
    const items = mergeAutomaticBringListItems([
      draft({ quantity: 12, notes: "Aus Auftrag" }),
      draft({ quantity: 8, notes: "Aus Materialplanung" })
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: "Unterspannbahn",
      quantity: 20,
      sourceType: "order_material",
      sourceRef: "requirement-1"
    });
    expect(items[0].notes).toContain("Aus Auftrag");
    expect(items[0].notes).toContain("Aus Materialplanung");
  });

  it("keeps different planning sources separate", () => {
    const items = mergeAutomaticBringListItems([
      draft({ name: "Transporter 1", itemType: "other", sourceType: "planning_vehicle", sourceRef: "vehicle-assignment-1", inventoryItemId: null }),
      draft({ name: "Transporter 1", itemType: "other", sourceType: "planning_vehicle", sourceRef: "vehicle-assignment-2", inventoryItemId: null })
    ]);

    expect(items).toHaveLength(2);
  });
});
