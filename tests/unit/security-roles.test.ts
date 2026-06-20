import { describe, expect, it } from "vitest";
import { canOperate, isForeman, isManager } from "@/lib/utils";
import type { Role } from "@/types/app";

describe("role permissions", () => {
  it("keeps pricing/admin rights limited to admin and chef", () => {
    const roles: Role[] = ["admin", "chef", "vorarbeiter", "mitarbeiter", "kunde"];
    expect(Object.fromEntries(roles.map((role) => [role, isManager(role)]))).toEqual({
      admin: true,
      chef: true,
      vorarbeiter: false,
      mitarbeiter: false,
      kunde: false
    });
  });

  it("grants operative rights to Vorarbeiter without manager pricing rights", () => {
    expect(isForeman("vorarbeiter")).toBe(true);
    expect(canOperate("admin")).toBe(true);
    expect(canOperate("chef")).toBe(true);
    expect(canOperate("vorarbeiter")).toBe(true);
    expect(canOperate("mitarbeiter")).toBe(false);
    expect(canOperate("kunde")).toBe(false);
    expect(isManager("vorarbeiter")).toBe(false);
  });
});
