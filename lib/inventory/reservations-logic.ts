import { calculateMaterialAvailability } from "@/lib/inventory/availability";

export function canReserveMaterial({
  stockQuantity,
  alreadyReservedQuantity,
  requestedQuantity
}: {
  stockQuantity: number;
  alreadyReservedQuantity: number;
  requestedQuantity: number;
}) {
  const availability = calculateMaterialAvailability({
    requiredQuantity: requestedQuantity,
    stockQuantity,
    reservedQuantity: alreadyReservedQuantity,
    unit: "Stueck"
  });

  return {
    ok: availability.missingQuantity === 0,
    availableQuantity: availability.availableQuantity,
    missingQuantity: availability.missingQuantity
  };
}
