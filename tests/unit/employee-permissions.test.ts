import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  allPermissionKeys,
  adminOnlyPermissionKeys,
  chefPermissionKeys,
  effectivePermissionKeys,
  employeePermissionGroups,
  hasAppPermission,
  normalizePermissionKeys
} from "@/lib/permissions";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("employee permission management", () => {
  it("defines all required Chef-granular permissions in clear groups", () => {
    const labels = employeePermissionGroups.flatMap((group) => group.permissions.map((permission) => permission.label));

    expect(labels).toEqual(
      expect.arrayContaining([
        "Aufträge ansehen",
        "Aufträge erstellen",
        "Aufträge bearbeiten",
        "Aufträge löschen",
        "Kunden ansehen",
        "Kunden bearbeiten",
        "Kundenanfragen ansehen",
        "Kundenanfragen bearbeiten",
        "Lager ansehen",
        "Lager bearbeiten",
        "Material bestellen",
        "Mitarbeiterzeiten ansehen",
        "Mitarbeiterzeiten bearbeiten",
        "Fotos hochladen",
        "Fotos löschen",
        "Berichte erstellen",
        "Berichte freigeben",
        "Fahrzeuge/Lagerorte verwalten"
      ])
    );
    expect(labels).not.toContain("Angebote/Kalkulationen ansehen");
    expect(labels).not.toContain("Angebote/Kalkulationen erstellen");
    expect(labels).not.toContain("EK-Preise sehen");
    expect(labels).not.toContain("VK-Preise sehen");
    expect(labels).not.toContain("Einstellungen bearbeiten");
    expect(labels).not.toContain("Benutzer/Rechte verwalten");
    expect(new Set(allPermissionKeys).size).toBe(allPermissionKeys.length);
  });

  it("keeps Systemadmin on system access, Chef on operative access and normalizes employee permissions", () => {
    expect(effectivePermissionKeys("admin", [])).toEqual(allPermissionKeys);
    expect(effectivePermissionKeys("chef", ["orders.view"])).toEqual(chefPermissionKeys);
    for (const permission of adminOnlyPermissionKeys) {
      expect(effectivePermissionKeys("chef", []).includes(permission)).toBe(false);
    }
    expect(effectivePermissionKeys("mitarbeiter", ["orders.view", "orders.view", "unknown"])).toEqual(["orders.view"]);
    expect(effectivePermissionKeys("vorarbeiter", ["prices.purchase.view", "quotes.create", "settings.edit", "orders.view"])).toEqual([
      "orders.view"
    ]);
    expect(normalizePermissionKeys(["customers.edit", "unknown", "orders.view"])).toEqual(["customers.edit", "orders.view"]);
    expect(hasAppPermission("mitarbeiter", ["orders.create"], "orders.create")).toBe(true);
    expect(hasAppPermission("mitarbeiter", ["orders.create"], "prices.purchase.view")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["prices.sales.view"], "prices.sales.view")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["settings.edit"], "settings.edit")).toBe(false);
    expect(hasAppPermission("mitarbeiter", ["quotes.create"], "quotes.create")).toBe(false);
    expect(hasAppPermission("chef", [], "quotes.create")).toBe(true);
    expect(hasAppPermission("chef", [], "settings.edit")).toBe(false);
    expect(hasAppPermission("admin", [], "settings.edit")).toBe(true);
  });

  it("adds Supabase RLS, helper function and audit log for employee permissions", () => {
    const migration = source("supabase/migrations/20260622_employee_permissions.sql");

    expect(migration).toContain("create table if not exists public.employee_permissions");
    expect(migration).toContain("create table if not exists public.employee_permission_audit_log");
    expect(migration).toContain("alter table public.employee_permissions force row level security");
    expect(migration).toContain("function public.has_employee_permission");
    expect(migration).toContain("'prices.purchase.view'");
    expect(migration).toContain("'settings.edit'");
    expect(migration).toContain("'users.permissions.manage'");
    expect(migration).toContain("assert_employee_permission_change_allowed");
    expect(migration).toContain("target_profile_id = auth.uid()");
    expect(migration).toContain("target_role in ('admin', 'chef')");
    expect(migration).toContain("old_values jsonb");
    expect(migration).toContain("new_values jsonb");
    expect(migration).toContain("public.has_employee_permission('orders.view')");
    expect(migration).toContain("public.has_employee_permission('reports.approve')");
  });

  it("hardens the server action against self-edits and manager-target edits", () => {
    const actions = source("lib/actions/auth-actions.ts");

    expect(actions).toContain("export async function updateEmployeePermissionsAction");
    expect(actions).toContain("const context = await requirePlatformAdmin()");
    expect(actions).toContain("id === context.userId");
    expect(actions).toContain('target.role === "admin" || target.role === "chef"');
    expect(actions).toContain('.from("employee_permissions").upsert');
    expect(actions).toContain('.from("employee_permission_audit_log").insert');
    expect(actions).toContain("old_values: { permissions: oldPermissions }");
    expect(actions).toContain("new_values: { permissions: requestedPermissions }");
    expect(actions).toContain("assignableEmployeePermissionKeys.map");
    expect(actions).toContain("filter(isAssignableEmployeePermission)");
  });

  it("adds a follow-up migration that removes legacy delegated Chef and price permissions", () => {
    const migration = source("supabase/migrations/20260712_price_permission_hardening.sql");

    expect(migration).toContain("delete from public.employee_permissions");
    expect(migration).toContain("'quotes.create'");
    expect(migration).toContain("'prices.purchase.view'");
    expect(migration).toContain("'settings.edit'");
    expect(migration).toContain("'users.permissions.manage'");
    expect(migration).toContain("employee_permissions_permission_key_check");
    expect(migration).toContain("public.can_manage_company()");
  });

  it("offers desktop right-click, mobile long-press and a visible three-dot permissions entry", () => {
    const component = source("components/team/employee-permissions-menu.tsx");
    const teamPage = source("app/(app)/team/page.tsx");

    expect(component).toContain("onContextMenu={openFromContextMenu}");
    expect(component).toContain("onTouchStart={openFromLongPress}");
    expect(component).toContain("MoreVertical");
    expect(component).toContain('name="permission"');
    expect(component).toContain("Abbrechen");
    expect(component).toContain("Speichern");
    expect(teamPage).toContain("EmployeePermissionsMenu");
    expect(teamPage).toContain("effectivePermissionKeys");
    expect(teamPage).toContain("Systemadmin und Chef werden über ihre Rolle gesteuert");
  });

  it("uses permissions in navigation and selected server-side entry points", () => {
    const shell = source("components/app-shell.tsx");
    const morePage = source("app/(app)/mehr/page.tsx");
    const orders = source("lib/actions/order-actions.ts");
    const customers = source("lib/actions/customer-actions.ts");
    const daily = source("app/(app)/time-tracking/daily/page.tsx");

    expect(shell).toContain("permissionQuickLinks");
    expect(shell).toContain('permission: "orders.view"');
    expect(morePage).toContain("Freigeschaltete Bereiche");
    expect(orders).toContain('requirePermission("orders.create"');
    expect(orders).toContain('requirePermission("orders.edit"');
    expect(customers).toContain('requirePermission("customers.edit"');
    expect(daily).toContain('requirePermission("time.team.view"');
    expect(daily).toContain('"time.team.edit"');
  });
});
