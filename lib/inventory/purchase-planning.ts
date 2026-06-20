import { calculateMaterialAvailability, type MaterialAvailability } from "@/lib/inventory/availability";

export type PurchasePlanningInput = {
  materialName: string;
  unit: string;
  requiredQuantity: number;
  stockQuantity: number;
  reservedQuantity?: number;
  minimumStock?: number;
  orderedQuantity?: number;
  jobsiteName?: string | null;
  bringListTitle?: string | null;
};

export type PurchasePlanItem = {
  materialName: string;
  quantityToBuy: number;
  unit: string;
  reason: string;
  urgency: "normal" | "hoch" | "kritisch";
  availability: MaterialAvailability;
};

export function planPurchaseSuggestion(input: PurchasePlanningInput): PurchasePlanItem | null {
  const availability = calculateMaterialAvailability(input);
  if (availability.reorderQuantity <= 0) return null;

  const context = [input.jobsiteName, input.bringListTitle].filter(Boolean).join(" · ");
  const urgency = availability.riskLevel === "red" ? "kritisch" : availability.riskLevel === "yellow" ? "hoch" : "normal";
  const reason =
    availability.missingQuantity > 0
      ? `Fehlt fuer ${context || "Mitbringliste"}`
      : `Nach Mindestbestand nachfuellen${context ? ` · ${context}` : ""}`;

  return {
    materialName: input.materialName,
    quantityToBuy: availability.reorderQuantity,
    unit: input.unit,
    reason,
    urgency,
    availability
  };
}
