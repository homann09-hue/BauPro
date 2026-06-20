import type { BringListItemType } from "@/types/app";

export type AutoBringListSourceType = "order_material" | "order_template" | "planning_vehicle" | "planning_equipment";

export type AutomaticBringListItemDraft = {
  name: string;
  quantity: number;
  unit: string;
  itemType: BringListItemType;
  materialId: string | null;
  inventoryItemId: string | null;
  sourceType: AutoBringListSourceType;
  sourceRef: string;
  vehicleId: string | null;
  requiredVehicleId: string | null;
  notes: string | null;
};

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function mergeAutomaticBringListItems(items: AutomaticBringListItemDraft[]) {
  const merged = new Map<string, AutomaticBringListItemDraft>();

  for (const item of items) {
    const name = normalizeName(item.name);
    if (!name) continue;
    const key = [item.sourceType, item.sourceRef, item.inventoryItemId ?? item.materialId ?? name.toLowerCase(), item.unit].join(":");
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...item, name });
      continue;
    }

    existing.quantity += item.quantity;
    existing.notes = [existing.notes, item.notes].filter(Boolean).join(" - ") || null;
  }

  return [...merged.values()];
}
