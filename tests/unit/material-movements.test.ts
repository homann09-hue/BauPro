import { describe, expect, it } from "vitest";
import { validateMaterialMovement } from "@/lib/inventory/material-movements";

const baseDraft = {
  companyId: "company-1",
  inventoryItemId: "item-1",
  jobsiteId: "job-1",
  quantity: 2,
  unit: "Stueck",
  createdBy: "user-1"
};

describe("material movement validation", () => {
  it("allows jobsite loss and break bookings for confirmed material reports", () => {
    expect(validateMaterialMovement({ ...baseDraft, movementType: "loss" })).toEqual({ ok: true });
    expect(validateMaterialMovement({ ...baseDraft, movementType: "break" })).toEqual({ ok: true });
  });

  it("rejects invalid quantities before movement persistence", () => {
    expect(validateMaterialMovement({ ...baseDraft, movementType: "consume", quantity: 0 })).toEqual({
      ok: false,
      message: "Menge muss groesser als 0 sein."
    });
  });
});
