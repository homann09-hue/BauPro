import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { hasAppPermission } from "@/lib/permissions";
import { canOperate, isForeman, isManager } from "@/lib/utils";
import type { Role } from "@/types/app";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

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

  it("keeps Mitarbeiter price-free and Vorarbeiter away from Chef-only defaults", () => {
    expect(hasAppPermission("mitarbeiter", [], "prices.purchase.view")).toBe(false);
    expect(hasAppPermission("mitarbeiter", [], "prices.sales.view")).toBe(false);
    expect(hasAppPermission("mitarbeiter", ["prices.purchase.view"], "prices.purchase.view")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["prices.sales.view"], "prices.sales.view")).toBe(false);
    expect(hasAppPermission("mitarbeiter", ["quotes.view"], "quotes.view")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["quotes.create"], "quotes.create")).toBe(false);
    expect(hasAppPermission("vorarbeiter", [], "settings.edit")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["settings.edit"], "settings.edit")).toBe(false);
    expect(hasAppPermission("vorarbeiter", [], "users.permissions.manage")).toBe(false);
    expect(hasAppPermission("mitarbeiter", ["users.permissions.manage"], "users.permissions.manage")).toBe(false);

    const shell = source("components/app-shell.tsx");
    expect(shell).toContain("Vorarbeiter sieht operative Baustellen, Zeiten, Berichte und Mitbringlisten ohne Preisdetails.");
    expect(shell).toContain("Mitarbeiter sieht nur zugeordnete Baustellen, eigene Zeiten, Berichte und Mitbringlisten.");
    expect(shell).toContain("if (context.canManage)");
  });

  it("protects Chef-only pages server-side instead of only hiding navigation", () => {
    const guardedManagerPages = [
      "app/(app)/billing/page.tsx",
      "app/(app)/team/page.tsx",
      "app/(app)/suppliers/page.tsx",
      "app/(app)/materials/control-center/page.tsx",
      "app/(app)/materials/live-offers/page.tsx",
      "app/(app)/materials/online-discovery/page.tsx",
      "app/(app)/invoices/page.tsx",
      "app/(app)/invoices/new/page.tsx",
      "app/(app)/angebote-rechnungen/page.tsx",
      "app/(app)/ai/job-wizard/page.tsx"
    ];

    for (const file of guardedManagerPages) {
      expect(source(file), file).toContain("requireManager");
    }

    const settingsPage = source("app/(app)/settings/page.tsx");
    expect(settingsPage).toContain('requirePermission("settings.edit"');
    expect(hasAppPermission("mitarbeiter", ["settings.edit"], "settings.edit")).toBe(false);
    expect(hasAppPermission("vorarbeiter", ["settings.edit"], "settings.edit")).toBe(false);
  });
});
