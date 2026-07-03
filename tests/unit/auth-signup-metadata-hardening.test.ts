import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function block(sourceText: string, start: string, end: string) {
  const startIndex = sourceText.indexOf(start);
  const endIndex = sourceText.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return sourceText.slice(startIndex, endIndex);
}

describe("auth signup metadata hardening", () => {
  it("verhindert Rollen- und Firmenuebernahme aus clientseitiger user_metadata", () => {
    const migration = source("supabase/migrations/20260717_auth_signup_metadata_hardening.sql");
    const schema = source("supabase/schema.sql");

    for (const sql of [migration, schema]) {
      const handleNewUser = block(sql, "create or replace function public.handle_new_user()", "notify pgrst");

      expect(handleNewUser).toContain("raw_app_meta_data->>'baupro_server_created'");
      expect(handleNewUser).toContain("raw_app_meta_data->>'baupro_company_id'");
      expect(handleNewUser).toContain("raw_app_meta_data->>'baupro_role'");
      expect(handleNewUser).not.toContain("raw_user_meta_data->>'company_id'");
      expect(handleNewUser).not.toContain("raw_user_meta_data->>'role'");
      expect(handleNewUser).toContain("requested_role := 'chef'");
    }
  });

  it("markiert serverseitig angelegte Mitarbeiter ueber app_metadata", () => {
    const action = source("lib/actions/auth-actions.ts");
    const onboarding = source("lib/actions/onboarding-actions.ts");
    const demo = source("lib/demo/demo-mode.ts");

    expect(action).toContain("app_metadata");
    expect(action).toContain("baupro_server_created: true");
    expect(action).toContain("baupro_company_id: targetCompanyId");
    expect(action).toContain("baupro_role: role");

    for (const file of [action, onboarding, demo]) {
      expect(file).toContain("app_metadata");
      expect(file).toContain("baupro_server_created: true");
      expect(file).not.toMatch(/user_metadata:\s*\{[^}]*company_id:/s);
    }
  });

  it("erstellt im Bootstrap-Fallback keinen Systemadmin", () => {
    const migration = source("supabase/migrations/20260718_bootstrap_profile_role_hardening.sql");
    const schema = source("supabase/schema.sql");

    for (const sql of [migration, schema]) {
      const bootstrap = block(sql, "create or replace function public.bootstrap_my_profile()", "grant execute on function public.bootstrap_my_profile()");

      expect(bootstrap).toContain("'chef', true");
      expect(bootstrap).not.toContain("'admin', true");
      expect(bootstrap).not.toContain("raw_user_meta_data->>'role'");
    }
  });
});
