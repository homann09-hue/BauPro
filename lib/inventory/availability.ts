import type { InventoryLocationType } from "@/types/app";

export type MaterialAvailabilityRisk = "green" | "yellow" | "red" | "blue";

export type MaterialAvailabilityInput = {
  requiredQuantity: number;
  stockQuantity: number;
  reservedQuantity?: number;
  minimumStock?: number;
  orderedQuantity?: number;
  unit: string;
  locationName?: string | null;
  locationType?: InventoryLocationType | "Lieferant/offen bestellt" | null;
  vehicleName?: string | null;
};

export type MaterialAvailability = {
  requiredQuantity: number;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  reorderQuantity: number;
  unit: string;
  locationName: string | null;
  locationType: string | null;
  vehicleName: string | null;
  riskLevel: MaterialAvailabilityRisk;
  statusLabel: string;
};

function positive(value?: number | null) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export function calculateMaterialAvailability(input: MaterialAvailabilityInput): MaterialAvailability {
  const requiredQuantity = positive(input.requiredQuantity);
  const stockQuantity = positive(input.stockQuantity);
  const reservedQuantity = positive(input.reservedQuantity);
  const minimumStock = positive(input.minimumStock);
  const orderedQuantity = positive(input.orderedQuantity);
  const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
  const missingQuantity = Math.max(0, requiredQuantity - availableQuantity);
  const afterUse = Math.max(0, availableQuantity - requiredQuantity);
  const reorderQuantity = Math.max(0, missingQuantity, minimumStock - afterUse);

  let riskLevel: MaterialAvailabilityRisk = "green";
  let statusLabel = "Alles da";

  if (missingQuantity > 0 && orderedQuantity >= missingQuantity) {
    riskLevel = "blue";
    statusLabel = "Bestellt / unterwegs";
  } else if (missingQuantity > 0) {
    riskLevel = "red";
    statusLabel = "Fehlt";
  } else if (minimumStock > 0 && afterUse < minimumStock) {
    riskLevel = "yellow";
    statusLabel = "Knapp";
  }

  return {
    requiredQuantity,
    stockQuantity,
    reservedQuantity,
    availableQuantity,
    missingQuantity,
    reorderQuantity,
    unit: input.unit,
    locationName: input.locationName ?? null,
    locationType: input.locationType ?? null,
    vehicleName: input.vehicleName ?? null,
    riskLevel,
    statusLabel
  };
}

export function summarizeAvailability(items: MaterialAvailability[]) {
  const criticalCount = items.filter((item) => item.riskLevel === "red").length;
  const warningCount = items.filter((item) => item.riskLevel === "yellow").length;
  const orderedCount = items.filter((item) => item.riskLevel === "blue").length;
  const missingPositions = items.filter((item) => item.missingQuantity > 0).length;

  return {
    totalPositions: items.length,
    criticalCount,
    warningCount,
    orderedCount,
    missingPositions,
    riskLevel: criticalCount > 0 ? "red" : warningCount > 0 ? "yellow" : orderedCount > 0 ? "blue" : "green",
    statusLabel:
      criticalCount > 0
        ? "Fehlt / kritisch"
        : warningCount > 0
          ? "Knapp / prüfen"
          : orderedCount > 0
            ? "Bestellt / unterwegs"
            : "Alles da"
  } as const;
}
