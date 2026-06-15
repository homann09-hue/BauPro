import { describe, expect, it } from "vitest";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";

describe("safe action errors", () => {
  it("only exposes explicit safe messages to the UI", () => {
    expect(safeErrorMessage(new SafeActionError("Kein Zugriff."))).toBe("Kein Zugriff.");
    expect(safeErrorMessage(new Error('relation "supplier_offers" does not exist'), "Allgemeiner Fehler.")).toBe("Allgemeiner Fehler.");
  });
});
