import type { Role } from "@/types/app";

const managerRoutes = [
  "/dashboard",
  "/demo-tour",
  "/onboarding",
  "/baustellen",
  "/plantafel",
  "/orders",
  "/invoices",
  "/customers",
  "/materials/inventory",
  "/materials/control-center",
  "/materials/delivery-notes",
  "/materials/low-stock",
  "/materials/live-offers",
  "/bring-lists",
  "/bring-lists/tomorrow",
  "/time-tracking/daily",
  "/time-tracking/reports",
  "/team",
  "/settings"
];

const foremanRoutes = [
  "/dashboard",
  "/baustellen",
  "/plantafel",
  "/berichte",
  "/bring-lists",
  "/bring-lists/tomorrow",
  "/time-tracking",
  "/material-melden"
];

const employeeRoutes = [
  "/dashboard",
  "/time/new",
  "/baustellen",
  "/berichte",
  "/bring-lists",
  "/bring-lists/new",
  "/material-melden",
  "/profile"
];

export function prefetchRoutesForRole(role: Role, canManage: boolean) {
  if (canManage) return managerRoutes;
  if (role === "vorarbeiter") return foremanRoutes;
  if (role === "kunde") return [];
  return employeeRoutes;
}

export function prefetchScopesForRole(role: Role, canManage: boolean) {
  if (canManage) return ["dashboard", "jobsites", "tasks", "materials"] as const;
  if (role === "vorarbeiter") return ["dashboard", "jobsites", "tasks", "bring-lists"] as const;
  if (role === "kunde") return [] as const;
  return ["dashboard", "jobsites", "time"] as const;
}

export const PREFETCH_CACHE_TTL_MS = 120_000;
export const PREFETCH_PAYLOAD_MAX_CHARS = 90_000;
