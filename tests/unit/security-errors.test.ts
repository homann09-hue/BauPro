import { describe, expect, it } from "vitest";
import { SafeActionError, safeErrorMessage, safeErrorStatus } from "@/lib/security/errors";

describe("safe action errors", () => {
  it("only exposes explicit safe messages to the UI", () => {
    expect(safeErrorMessage(new SafeActionError("Kein Zugriff."))).toBe("Kein Zugriff.");
    expect(safeErrorMessage(new Error('relation "supplier_offers" does not exist'), "Allgemeiner Fehler.")).toBe("Allgemeiner Fehler.");
  });

  it("maps rate limit errors to 429", () => {
    expect(safeErrorStatus(new SafeActionError("Zu viele Anfragen in kurzer Zeit. Bitte versuche es gleich erneut."))).toBe(429);
    expect(safeErrorStatus(new SafeActionError("Rate Limit konnte nicht geprüft werden."))).toBe(429);
    expect(safeErrorStatus(new SafeActionError("Falsche Eingabe."))).toBe(400);
    expect(safeErrorStatus(new Error("interner Fehler"))).toBe(500);
  });
});
