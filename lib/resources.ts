import type { PlanningResourceKind, PlanningResourceStatus } from "@/types/app";

export const resourceKinds = ["fahrzeug", "anhaenger", "maschine", "werkzeug", "geruest_leiter", "geraet", "sonstiges"] as const;

export const resourceStatuses = [
  "verfuegbar",
  "auf_baustelle",
  "im_fahrzeug",
  "defekt",
  "werkstatt",
  "reserviert",
  "archiviert"
] as const;

export const resourceKindLabels: Record<PlanningResourceKind, string> = {
  fahrzeug: "Fahrzeug",
  anhaenger: "Anhaenger",
  maschine: "Maschine",
  werkzeug: "Werkzeug",
  geruest_leiter: "Geruest / Leiter",
  geraet: "Geraet",
  sonstiges: "Sonstiges"
};

export const resourceStatusLabels: Record<PlanningResourceStatus, string> = {
  verfuegbar: "Verfuegbar",
  auf_baustelle: "Auf Baustelle",
  im_fahrzeug: "Im Fahrzeug",
  defekt: "Defekt",
  werkstatt: "Werkstatt",
  reserviert: "Reserviert",
  archiviert: "Archiviert"
};

export const resourceStatusBadgeClasses: Record<PlanningResourceStatus, string> = {
  verfuegbar: "bg-mint text-primary",
  auf_baustelle: "bg-blue-50 text-blue-700",
  im_fahrzeug: "bg-slate-100 text-slate-700",
  defekt: "bg-red-50 text-red-700",
  werkstatt: "bg-amber-50 text-amber-800",
  reserviert: "bg-purple-50 text-purple-700",
  archiviert: "bg-slate-100 text-slate-500"
};

export function maintenanceDueState(nextMaintenanceAt?: string | null, inspectionDueDate?: string | null) {
  const dates = [nextMaintenanceAt, inspectionDueDate].filter(Boolean) as string[];
  if (dates.length === 0) return "none" as const;

  const next = dates.sort()[0];
  const today = new Date().toISOString().slice(0, 10);
  if (next < today) return "overdue" as const;

  const inThirtyDays = new Date();
  inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30);
  if (next <= inThirtyDays.toISOString().slice(0, 10)) return "soon" as const;

  return "ok" as const;
}
