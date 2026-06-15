import { describe, expect, it } from "vitest";
import { isManager } from "@/lib/utils";
import type { Role } from "@/types/app";

describe("role permissions", () => {
  it("keeps pricing/admin rights limited to admin and chef", () => {
    const roles: Role[] = ["admin", "chef", "vorarbeiter", "mitarbeiter"];
    expect(Object.fromEntries(roles.map((role) => [role, isManager(role)]))).toEqual({
      admin: true,
      chef: true,
      vorarbeiter: false,
      mitarbeiter: false
    });
  });
});
