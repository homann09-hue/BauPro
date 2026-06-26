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
    title: "Ressourcen",
    permissions: [{ key: "vehicles.manage", label: "Fahrzeuge/Lagerorte verwalten" }]
  }
] as const;

export const managerOnlyPermissionKeys = [
  "quotes.view",
  "quotes.create",
  "prices.purchase.view",
  "prices.sales.view"
] as const;

export const adminOnlyPermissionKeys = [
  "settings.edit",
  "users.permissions.manage",
  "billing.manage",
  "features.manage",
  "integrations.manage",
  "security.manage",
  "privacy.manage",
  "api.manage"
] as const;

export type EmployeePermissionKey = (typeof employeePermissionGroups)[number]["permissions"][number]["key"];
export type ManagerOnlyPermissionKey = (typeof managerOnlyPermissionKeys)[number];
export type AdminOnlyPermissionKey = (typeof adminOnlyPermissionKeys)[number];
export type PermissionKey = EmployeePermissionKey | ManagerOnlyPermissionKey | AdminOnlyPermissionKey;

export const assignableEmployeePermissionKeys = employeePermissionGroups.flatMap((group) =>
  group.permissions.map((permission) => permission.key)
) as EmployeePermissionKey[];

export const allPermissionKeys = [...assignableEmployeePermissionKeys, ...managerOnlyPermissionKeys, ...adminOnlyPermissionKeys] as PermissionKey[];
export const chefPermissionKeys = [...assignableEmployeePermissionKeys, ...managerOnlyPermissionKeys] as PermissionKey[];

const permissionSet = new Set<string>(allPermissionKeys);
const assignablePermissionSet = new Set<string>(assignableEmployeePermissionKeys);
const managerOnlyPermissionSet = new Set<string>(managerOnlyPermissionKeys);
const adminOnlyPermissionSet = new Set<string>(adminOnlyPermissionKeys);

export function isPermissionKey(value: string): value is PermissionKey {
  return permissionSet.has(value);
}

export function isManagerOnlyPermission(value: string) {
  return managerOnlyPermissionSet.has(value);
}

export function isAdminOnlyPermission(value: string) {
  return adminOnlyPermissionSet.has(value);
}

export function isAssignableEmployeePermission(value: string): value is EmployeePermissionKey {
  return assignablePermissionSet.has(value);
}

export function isFullAccessRole(role?: Role | null) {
  return role === "admin";
}

export function normalizePermissionKeys(values: Iterable<string>) {
  return [...new Set([...values].filter(isPermissionKey))].sort();
}

export function effectivePermissionKeys(role: Role, grantedPermissions: Iterable<string>) {
  if (isFullAccessRole(role)) return allPermissionKeys;
  if (role === "chef") return chefPermissionKeys;
  return normalizePermissionKeys(grantedPermissions).filter(
    (permission) => !isManagerOnlyPermission(permission) && !isAdminOnlyPermission(permission)
  );
}

export function hasAppPermission(role: Role, grantedPermissions: Iterable<string>, permission: PermissionKey) {
  if (isFullAccessRole(role)) return true;
  if (role === "chef") return !isAdminOnlyPermission(permission);
  if (isManagerOnlyPermission(permission)) return false;
  if (isAdminOnlyPermission(permission)) return false;
  return normalizePermissionKeys(grantedPermissions).includes(permission);
}
