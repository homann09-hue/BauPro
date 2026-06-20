export type MaterialMovementType = "purchase" | "transfer" | "reserve" | "consume" | "return" | "correction" | "loss" | "break";

export type MaterialMovementDraft = {
  companyId: string;
  inventoryItemId: string;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  jobsiteId?: string | null;
  bringListId?: string | null;
  quantity: number;
  unit: string;
  movementType: MaterialMovementType;
  createdBy: string;
  notes?: string | null;
};

export function validateMaterialMovement(draft: MaterialMovementDraft) {
  if (!draft.companyId || !draft.inventoryItemId || !draft.createdBy) {
    return { ok: false as const, message: "Firma, Material und Nutzer sind erforderlich." };
  }
  if (!Number.isFinite(draft.quantity) || draft.quantity <= 0) {
    return { ok: false as const, message: "Menge muss groesser als 0 sein." };
  }
  if (draft.movementType === "transfer" && !draft.fromLocationId && !draft.toLocationId) {
    return { ok: false as const, message: "Umlagerung braucht mindestens Quelle oder Ziel." };
  }
  return { ok: true as const };
}
