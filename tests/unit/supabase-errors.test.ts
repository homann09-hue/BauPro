import { describe, expect, it } from "vitest";
import { isMissingSchemaError, isUnsupportedVorarbeiterRoleError, migrationMissingMessage } from "@/lib/supabase/errors";

describe("Supabase error helpers", () => {
  it("detects missing schema cache and table errors", () => {
    expect(isMissingSchemaError({ code: "PGRST205", message: "Could not find the table 'public.ai_settings' in the schema cache" })).toBe(
      true
    );
    expect(isMissingSchemaError({ code: "42P01", message: "relation public.calculation_settings does not exist" })).toBe(true);
    expect(isMissingSchemaError({ code: "23505", message: "duplicate key" })).toBe(false);
  });

  it("detects old role constraints and returns friendly migration text", () => {
    expect(
      isUnsupportedVorarbeiterRoleError({
        code: "23514",
        message: 'new row for relation "profiles" violates check constraint "profiles_role_check"'
      })
    ).toBe(true);
    expect(migrationMissingMessage("KI-Auftragswizard")).toContain("Supabase-Migration fehlt");
  });
});
