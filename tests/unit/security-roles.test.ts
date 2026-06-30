import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hasAppPermission } from "@/lib/permissions";
import { canOperate, isAdmin, isChef, isForeman, isManager } from "@/lib/utils";
import type { Role } from "@/types/app";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("role permissions", () => {
  it("separates the system admin role from the operative chef role", () => {
    const roles: Role[] = ["admin", "chef", "vorarbeiter", "mitarbeiter", "kunde"];
    expect(Object.fromEntries(roles.map((role) => [role, isManager(role)]))).toEqual({
      admin: false,
      chef: true,
      vorarbeiter: false,
      mitarbeiter: false,
      kunde: false
    });
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("chef")).toBe(false);
    expect(isChef("chef")).toBe(true);
    expect(isChef("admin")).toBe(false);
  });

  it("grants operative rights to Vorarbeiter without manager pricing rights", () => {
    expect(isForeman("vorarbeiter")).toBe(true);
    expect(canOperate("admin")).toBe(false);
    expect(canOperate("chef")).toBe(true);
    expect(canOperate("vorarbeiter")).toBe(true);
    expect(canOperate("mitarbeiter")).toBe(false);
    expect(canOperate("kunde")).toBe(false);
    expect(isManager("vorarbeiter")).toBe(false);
  });

  it("keeps Mitarbeiter price-free and Vorarbeiter away from Chef-only defaults", () => {
    expect(hasAppPermission("mitarbeiter", [], "prices.purchase.view")).toBe(false);
    expect(hasAppPermission("mitarbeiter", [], "prices.sales.view")).toBe(false);
    expect(hasAppPermission("mitarbeiter", ["prices.purchase.view"], "prices.purchase.view")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["prices.sales.view"], "prices.sales.view")).toBe(false);
    expect(hasAppPermission("mitarbeiter", ["quotes.view"], "quotes.view")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["quotes.create"], "quotes.create")).toBe(false);
    expect(hasAppPermission("chef", [], "prices.purchase.view")).toBe(true);
    expect(hasAppPermission("chef", [], "prices.sales.view")).toBe(true);
    expect(hasAppPermission("chef", [], "settings.edit")).toBe(false);
    expect(hasAppPermission("chef", [], "users.permissions.manage")).toBe(false);
    expect(hasAppPermission("admin", [], "settings.edit")).toBe(true);
    expect(hasAppPermission("admin", [], "billing.manage")).toBe(true);
    expect(hasAppPermission("vorarbeiter", [], "settings.edit")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["settings.edit"], "settings.edit")).toBe(false);
    expect(hasAppPermission("vorarbeiter", [], "users.permissions.manage")).toBe(false);
    expect(hasAppPermission("mitarbeiter", ["users.permissions.manage"], "users.permissions.manage")).toBe(false);

    const shell = source("components/app-shell.tsx");
    expect(shell).toContain("Systemadmin verwaltet firmenübergreifend");
    expect(shell).toContain("Chef steuert Baustellen, Aufträge, Material");
    expect(shell).toContain("Vorarbeiter sieht operative Baustellen, Zeiten, Berichte und Mitbringlisten ohne Preisdetails.");
    expect(shell).toContain("Mitarbeiter sieht nur zugeordnete Baustellen, eigene Zeiten, Berichte und Mitbringlisten.");
    expect(shell).toContain("if (context.isAdmin)");
    expect(shell).toContain("if (context.isChef)");
  });

  it("protects system pages with requireAdmin and operative pages with manager checks", () => {
    const guardedAdminPages = [
      "app/(app)/billing/page.tsx",
      "app/(app)/team/page.tsx",
      "app/(app)/suppliers/page.tsx",
      "app/(app)/settings/page.tsx",
      "app/(app)/debug/system/page.tsx",
      "app/(app)/settings/security/page.tsx"
    ];

    for (const file of guardedAdminPages) {
      expect(source(file), file).toContain("requireAdmin");
    }

    const guardedOperationalPages = [
      "app/(app)/materials/control-center/page.tsx",
      "app/(app)/materials/live-offers/page.tsx",
      "app/(app)/materials/online-discovery/page.tsx",
      "app/(app)/invoices/page.tsx",
      "app/(app)/invoices/new/page.tsx",
      "app/(app)/angebote-rechnungen/page.tsx",
      "app/(app)/ai/job-wizard/page.tsx"
    ];

    for (const file of guardedOperationalPages) {
      expect(source(file), file).toContain("requireManager");
    }

    expect(source("lib/actions/auth-actions.ts")).toContain("role: \"chef\"");
    expect(hasAppPermission("mitarbeiter", ["settings.edit"], "settings.edit")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["settings.edit"], "settings.edit")).toBe(false);
  });

  it("documents platform-admin cross-company RLS without opening operative tenant data", () => {
    const migration = source("supabase/migrations/20260715_platform_system_admin.sql");
    const schema = source("supabase/schema.sql");
    const teamPage = source("app/(app)/team/page.tsx");
    const authActions = source("lib/actions/auth-actions.ts");

    for (const sourceText of [migration, schema]) {
      expect(sourceText).toContain('create policy "systemadmins read all companies"');
      expect(sourceText).toContain('create policy "systemadmins read all profiles"');
      expect(sourceText).toContain('create policy "systemadmins update profiles"');
      expect(sourceText).toContain('create policy "systemadmins read company audit log"');
      expect(sourceText).toContain("public.current_role() = 'chef'");
      expect(sourceText).toContain("public.current_role() = 'admin'");
      expect(sourceText).toContain("Operative Firmendaten wie Baustellen, Kunden, Lager und Preise bleiben");
    }

    expect(migration).not.toContain('create policy "systemadmins read all customers"');
    expect(migration).not.toContain('create policy "systemadmins read all jobsites"');
    expect(migration).not.toContain('create policy "systemadmins read all inventory');
    expect(teamPage).toContain('supabase.from("companies").select("id, name")');
    expect(teamPage).toContain('name="company_id"');
    expect(authActions).toContain("targetCompanyIdFromForm");
    expect(authActions).toContain("await checkUserLimit(supabase, targetCompanyId)");
  });
});
