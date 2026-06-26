import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type Role = "admin" | "chef" | "vorarbeiter" | "mitarbeiter" | "kunde";

const root = path.resolve(__dirname, "../..");

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function canChangeRole(params: {
  actorRole: Role;
  oldRole: Role;
  newRole: Role;
  otherActiveAdminExists: boolean;
}) {
  if (params.oldRole === params.newRole) return true;
  if (params.newRole === "admin" && params.actorRole !== "admin") return false;
  if (params.oldRole === "admin" && params.newRole !== "admin" && !params.otherActiveAdminExists) return false;
  return true;
}

describe("role escalation guard", () => {
  it("blockiert, wenn ein chef einen anderen Nutzer zu admin befoerdern will", () => {
    expect(
      canChangeRole({
        actorRole: "chef",
        oldRole: "mitarbeiter",
        newRole: "admin",
        otherActiveAdminExists: true
      })
    ).toBe(false);
  });

  it("erlaubt, wenn ein admin einen chef zu admin befoerdert", () => {
    expect(
      canChangeRole({
        actorRole: "admin",
        oldRole: "chef",
        newRole: "admin",
        otherActiveAdminExists: true
      })
    ).toBe(true);
  });

  it("blockiert, wenn der letzte admin einer Firma zu chef herabgestuft wird", () => {
    expect(
      canChangeRole({
        actorRole: "admin",
        oldRole: "admin",
        newRole: "chef",
        otherActiveAdminExists: false
      })
    ).toBe(false);
  });

  it("erlaubt die Herabstufung, wenn ein zweiter aktiver admin existiert", () => {
    expect(
      canChangeRole({
        actorRole: "admin",
        oldRole: "admin",
        newRole: "chef",
        otherActiveAdminExists: true
      })
    ).toBe(true);
  });

  it("verdrahtet die Sicherheitsgrenze in Migration, Schema, Server Action und Schema-Check", () => {
    const migration = read("supabase/migrations/20260621_role_escalation_guard.sql");
    const schema = read("supabase/schema.sql");
    const action = read("lib/actions/auth-actions.ts");
    const auth = read("lib/auth.ts");
    const schemaCheck = read("scripts/check-supabase-schema.mjs");

    for (const sql of [migration, schema]) {
      expect(sql).toContain("function public.assert_role_change_allowed");
      expect(sql).toContain("security definer");
      expect(sql).toContain("new.role = 'admin'");
      expect(sql).toContain("coalesce(actor_role, '') <> 'admin'");
      expect(sql).toContain("old.role = 'admin' and new.role <> 'admin'");
      expect(sql).toContain("p.id <> old.id");
      expect(sql).toContain("raise exception 'Keine Berechtigung fuer diese Rollenaenderung.'");
      expect(sql).toContain("before update of role on public.profiles");
      expect(sql).toContain("guard_profile_role_change_before_audit");
    }

    expect(action).toContain("await requireAdmin()");
    expect(action).toContain("Systemadmin und Chef werden über ihre Rolle gesteuert");
    expect(auth).toContain("export async function requireAdmin()");
    expect(schemaCheck).toContain("assert_role_change_allowed");
  });
});
