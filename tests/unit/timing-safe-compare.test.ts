import { describe, expect, it } from "vitest";
import { timingSafeTokenCompare } from "@/lib/customer-portal/tokens";

describe("timingSafeTokenCompare", () => {
  it("gibt true fuer gleiche Strings zurueck", () => {
    expect(timingSafeTokenCompare("abc123", "abc123")).toBe(true);
  });

  it("gibt false fuer unterschiedliche Strings gleicher Laenge zurueck", () => {
    expect(timingSafeTokenCompare("abc123", "abc124")).toBe(false);
  });

  it("gibt false fuer unterschiedliche Laengen zurueck, ohne zu werfen", () => {
    expect(() => timingSafeTokenCompare("abc123", "abc1234")).not.toThrow();
    expect(timingSafeTokenCompare("abc123", "abc1234")).toBe(false);
  });
});
