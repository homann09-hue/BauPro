import type { Role } from "@/types/app";

const managerRoutes = [
  "/dashboard",
  "/baustellen",
  "/time-tracking/daily",
  "/berichte",
  "/materials/inventory",
  "/orders",
  "/team",
  "/plantafel",
  "/invoices",
  "/customers",
  "/bring-lists",
  "/bring-lists/tomorrow",
  "/materials/control-center",
  "/materials/delivery-notes",
  "/materials/low-stock",
  "/materials/live-offers",
  "/time-tracking/reports",
  "/onboarding",
  "/settings"
];

const foremanRoutes = [
  "/dashboard",
  "/baustellen",
  "/time-tracking",
  "/material-melden",
  "/berichte",
  "/bring-lists",
  "/bring-lists/tomorrow",
  "/plantafel"
];

const employeeRoutes = [
  "/dashboard",
  "/baustellen",
  "/time-tracking",
  "/material-melden",
  "/berichte",
  "/time/new",
  "/bring-lists",
  "/bring-lists/new",
  "/profile"
];

export function prefetchRoutesForRole(role: Role, canManage: boolean) {
  if (canManage) return managerRoutes;
  if (role === "vorarbeiter") return foremanRoutes;
  if (role === "kunde") return [];
  return employeeRoutes;
}

export function prefetchScopesForRole(role: Role, canManage: boolean) {
  if (canManage) return ["dashboard", "jobsites", "time", "materials"] as const;
  if (role === "vorarbeiter") return ["dashboard", "jobsites", "time", "bring-lists"] as const;
  if (role === "kunde") return [] as const;
  return ["dashboard", "jobsites", "time", "bring-lists"] as const;
}

export const PREFETCH_CACHE_TTL_MS = 120_000;
export const PREFETCH_PAYLOAD_MAX_CHARS = 90_000;
