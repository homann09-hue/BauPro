import { describe, expect, it } from "vitest";
import { safeReturnPath, withStatusMessage } from "@/lib/security/redirects";

describe("redirect security", () => {
  it("accepts only internal relative return paths", () => {
    expect(safeReturnPath("/dashboard", "/fallback")).toBe("/dashboard");
    expect(safeReturnPath("/materials/inventory?page=2", "/fallback")).toBe("/materials/inventory?page=2");
    expect(safeReturnPath("https://example.com", "/fallback")).toBe("/fallback");
    expect(safeReturnPath("//example.com/path", "/fallback")).toBe("/fallback");
    expect(safeReturnPath("dashboard", "/fallback")).toBe("/fallback");
    expect(safeReturnPath(null, "/fallback")).toBe("/fallback");
  });

  it("rejects evasive external redirect payloads", () => {
    expect(safeReturnPath("/\\example.com", "/fallback")).toBe("/fallback");
    expect(safeReturnPath("/%2f%2fexample.com", "/fallback")).toBe("/fallback");
    expect(safeReturnPath("/%5cexample.com", "/fallback")).toBe("/fallback");
    expect(safeReturnPath("/dashboard%0d%0aLocation:%20https://example.com", "/fallback")).toBe("/fallback");
    expect(safeReturnPath("/materials/catalog?q=Dachziegel%2Frot", "/fallback")).toBe("/materials/catalog?q=Dachziegel%2Frot");
  });

  it("adds status messages without dropping existing query filters", () => {
    expect(withStatusMessage("/time-tracking", "success", "Gespeichert")).toBe("/time-tracking?success=Gespeichert");
    expect(withStatusMessage("/time-tracking?status=open", "error", "Nicht erlaubt")).toBe(
      "/time-tracking?status=open&error=Nicht%20erlaubt"
    );
    expect(withStatusMessage("//example.com", "error", "Blockiert")).toBe("/dashboard?error=Blockiert");
  });
});
