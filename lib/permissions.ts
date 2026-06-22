import type { Role } from "@/types/app";

export const employeePermissionGroups = [
  {
    id: "orders",
    title: "Aufträge",
    permissions: [
      { key: "orders.view", label: "Aufträge ansehen" },
      { key: "orders.create", label: "Aufträge erstellen" },
      { key: "orders.edit", label: "Aufträge bearbeiten" },
      { key: "orders.delete", label: "Aufträge löschen" }
    ]
  },
  {
    id: "customers",
    title: "Kunden",
    permissions: [
      { key: "customers.view", label: "Kunden ansehen" },
      { key: "customers.edit", label: "Kunden bearbeiten" },
      { key: "customer_requests.view", label: "Kundenanfragen ansehen" },
      { key: "customer_requests.edit", label: "Kundenanfragen bearbeiten" }
    ]
  },
  {
    id: "quotes_prices",
    title: "Angebote & Preise",
    permissions: [
      { key: "quotes.view", label: "Angebote/Kalkulationen ansehen" },
      { key: "quotes.create", label: "Angebote/Kalkulationen erstellen" },
      { key: "prices.purchase.view", label: "EK-Preise sehen" },
      { key: "prices.sales.view", label: "VK-Preise sehen" }
    ]
  },
  {
    id: "inventory",
    title: "Lager",
    permissions: [
      { key: "inventory.view", label: "Lager ansehen" },
      { key: "inventory.edit", label: "Lager bearbeiten" },
      { key: "materials.order", label: "Material bestellen" }
    ]
  },
  {
    id: "time",
    title: "Zeiten",
    permissions: [
      { key: "time.team.view", label: "Mitarbeiterzeiten ansehen" },
      { key: "time.team.edit", label: "Mitarbeiterzeiten bearbeiten" }
    ]
  },
  {
    id: "reports",
    title: "Fotos & Berichte",
    permissions: [
      { key: "photos.upload", label: "Fotos hochladen" },
      { key: "photos.delete", label: "Fotos löschen" },
      { key: "reports.create", label: "Berichte erstellen" },
      { key: "reports.approve", label: "Berichte freigeben" }
    ]
  },
  {
    id: "administration",
    title: "Verwaltung",
    permissions: [
      { key: "vehicles.manage", label: "Fahrzeuge/Lagerorte verwalten" },
      { key: "settings.edit", label: "Einstellungen bearbeiten" },
      { key: "users.permissions.manage", label: "Benutzer/Rechte verwalten" }
    ]
  }
] as const;

export type PermissionKey = (typeof employeePermissionGroups)[number]["permissions"][number]["key"];

export const allPermissionKeys = employeePermissionGroups.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
) as PermissionKey[];

const permissionSet = new Set<string>(allPermissionKeys);

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionSet.has(value);
}

export function isFullAccessRole(role?: Role | null) {
  return role === "admin" || role === "chef";
}

export function normalizePermissionKeys(values: Iterable<string>) {
  return [...new Set([...values].filter(isPermissionKey))].sort();
}

export function effectivePermissionKeys(role: Role, grantedPermissions: Iterable<string>) {
  if (isFullAccessRole(role)) return allPermissionKeys;
  return normalizePermissionKeys(grantedPermissions);
}

export function hasAppPermission(role: Role, grantedPermissions: Iterable<string>, permission: PermissionKey) {
  return isFullAccessRole(role) || normalizePermissionKeys(grantedPermissions).includes(permission);
}
