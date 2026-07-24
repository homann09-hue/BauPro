import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectTriggerHelperGrantIssues, expectedFunctionRevoke } from "../helpers/supabase-rpc-hardening";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("SECURITY DEFINER audit helpers", () => {
  it("runs the local audit script without trigger-helper grant findings", () => {
    const output = execFileSync("node", ["scripts/audit-security-definer-functions.mjs", "--fail-on-trigger-grants"], {
      cwd: root,
      encoding: "utf8"
    });

    expect(output).toContain("# SECURITY DEFINER Function Audit");
    expect(output).toContain("`handle_new_user`");
    expect(output).toContain("Trigger-only");
  });

  it("detects a direct authenticated grant on a trigger-only helper", () => {
    const schema = `${source("supabase/schema.sql")}\ngrant execute on function public.handle_new_user() to authenticated;\n`;
    const migration = [
      source("supabase/migrations/20260725_trigger_function_execute_hardening.sql"),
      source("supabase/migrations/20260726_material_movement_audit_trigger_revoke.sql")
    ].join("\n");

    expect(collectTriggerHelperGrantIssues({ schema, migration })).toContain("handle_new_user: direct authenticated grant found");
  });

  it("builds exact revoke statements used by schema and migrations", () => {
    expect(expectedFunctionRevoke("handle_new_user", "authenticated")).toBe(
      "revoke all on function public.handle_new_user() from authenticated"
    );
  });
});
