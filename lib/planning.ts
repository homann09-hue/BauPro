import type {
  MaterialAlert,
  PlanningAssignment,
  PlanningAssignmentStatus,
  PlanningResource,
  PlanningResourceType,
  PlanningView,
  Profile,
  Vehicle
} from "@/types/app";
import { resourceKindLabels } from "@/lib/resources";

export const planningStatusLabels: Record<PlanningAssignmentStatus, string> = {
  geplant: "Geplant",
  aktiv: "Aktiv",
  erledigt: "Erledigt",
  verschoben: "Verschoben",
  krank: "Krank",
  urlaub: "Urlaub",
  werkstatt: "Werkstatt",
  defekt: "Defekt",
  weiterbildung: "Weiterbildung"
};

export const planningStatusColors: Record<PlanningAssignmentStatus, { badge: string; block: string; dot: string }> = {
  geplant: { badge: "bg-blue-50 text-blue-700", block: "border-blue-200 bg-blue-50 text-blue-950", dot: "bg-info" },
  aktiv: { badge: "bg-mint text-primary", block: "border-primary/20 bg-mint text-primary-dark", dot: "bg-primary" },
  erledigt: { badge: "bg-slate-100 text-slate-700", block: "border-slate-200 bg-slate-50 text-slate-700", dot: "bg-slate-400" },
  verschoben: { badge: "bg-amber-50 text-amber-800", block: "border-amber-200 bg-amber-50 text-amber-950", dot: "bg-warning" },
  krank: { badge: "bg-red-50 text-red-700", block: "border-red-200 bg-red-50 text-red-900", dot: "bg-danger" },
  urlaub: { badge: "bg-sky-50 text-sky-700", block: "border-sky-200 bg-sky-50 text-sky-900", dot: "bg-sky-500" },
  werkstatt: { badge: "bg-stone-100 text-stone-700", block: "border-stone-200 bg-stone-50 text-stone-800", dot: "bg-stone-500" },
  defekt: { badge: "bg-red-50 text-red-700", block: "border-red-200 bg-red-50 text-red-900", dot: "bg-danger" },
  weiterbildung: { badge: "bg-purple-50 text-purple-700", block: "border-purple-200 bg-purple-50 text-purple-900", dot: "bg-purple-500" }
};

export type PlanningRow = {
  id: string;
  type: PlanningResourceType;
  label: string;
  subLabel: string;
  unavailable?: boolean;
};

export type PlanningConflict = {
  assignmentId: string;
  type: "double_booking" | "equipment_unavailable" | "material_missing";
  severity: "warning" | "critical";
  message: string;
};

export function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function addDaysIso(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function daysInRange(start: string, end: string) {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return days;
}

export function getPlanningPeriod(view: PlanningView, anchorIso: string) {
  const anchor = parseIsoDate(anchorIso);

  if (view === "month") {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0));
    return { start: isoDate(start), end: isoDate(end), days: daysInRange(isoDate(start), isoDate(end)) };
  }

  const day = anchor.getUTCDay() || 7;
  const start = new Date(anchor);
  start.setUTCDate(anchor.getUTCDate() - day + 1);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: isoDate(start), end: isoDate(end), days: daysInRange(isoDate(start), isoDate(end)) };
}

export function resourceKey(type: PlanningResourceType, id: string) {
  return `${type}:${id}`;
}

export function assignmentResourceKey(assignment: Pick<PlanningAssignment, "resource_type" | "employee_id" | "vehicle_id" | "planning_resource_id">) {
  if (assignment.resource_type === "employee" && assignment.employee_id) return resourceKey("employee", assignment.employee_id);
  if (assignment.resource_type === "vehicle" && assignment.vehicle_id) return resourceKey("vehicle", assignment.vehicle_id);
  if (assignment.resource_type === "equipment" && assignment.planning_resource_id) return resourceKey("equipment", assignment.planning_resource_id);
  return `${assignment.resource_type}:missing`;
}

export function assignmentCoversDate(assignment: Pick<PlanningAssignment, "start_date" | "end_date">, date: string) {
  return assignment.start_date <= date && assignment.end_date >= date;
}

export function datesOverlap(left: Pick<PlanningAssignment, "start_date" | "end_date">, right: Pick<PlanningAssignment, "start_date" | "end_date">) {
  return left.start_date <= right.end_date && right.start_date <= left.end_date;
}

export function buildPlanningRows({
  employees,
  vehicles,
  resources
}: {
  employees: Array<Pick<Profile, "id" | "full_name" | "email" | "role">>;
  vehicles: Array<Pick<Vehicle, "id" | "name" | "license_plate">>;
  resources: Array<Pick<PlanningResource, "id" | "name" | "resource_kind" | "status"> & { location_text?: string | null }>;
}) {
  const employeeRows = employees.map<PlanningRow>((employee) => ({
    id: employee.id,
    type: "employee",
    label: employee.full_name || employee.email || "Mitarbeiter",
    subLabel: employee.role === "vorarbeiter" ? "Vorarbeiter" : "Mitarbeiter"
  }));
  const vehicleRows = vehicles.map<PlanningRow>((vehicle) => ({
    id: vehicle.id,
    type: "vehicle",
    label: vehicle.name,
    subLabel: vehicle.license_plate || "Fahrzeug"
  }));
  const resourceRows = resources.map<PlanningRow>((resource) => ({
    id: resource.id,
    type: "equipment",
    label: resource.name,
    subLabel: resource.location_text ? `${resourceKindLabels[resource.resource_kind]} · ${resource.location_text}` : resourceKindLabels[resource.resource_kind],
    unavailable: resource.status === "defekt" || resource.status === "werkstatt" || resource.status === "auf_baustelle"
  }));

  return { employeeRows, vehicleRows, resourceRows, rows: [...employeeRows, ...vehicleRows, ...resourceRows] };
}

export function detectPlanningConflicts(assignments: PlanningAssignment[], materialAlerts: Pick<MaterialAlert, "job_id" | "severity" | "message" | "status">[]) {
  const conflicts = new Map<string, PlanningConflict[]>();
  const push = (assignmentId: string, conflict: PlanningConflict) => {
    const current = conflicts.get(assignmentId) ?? [];
    current.push(conflict);
    conflicts.set(assignmentId, current);
  };

  const byResource = new Map<string, PlanningAssignment[]>();
  for (const assignment of assignments.filter((item) => item.status !== "erledigt")) {
    const key = assignmentResourceKey(assignment);
    byResource.set(key, [...(byResource.get(key) ?? []), assignment]);

    if (
      assignment.resource_type === "equipment" &&
      (assignment.planning_resources?.status === "defekt" || assignment.planning_resources?.status === "werkstatt") &&
      assignment.status !== "defekt" &&
      assignment.status !== "werkstatt"
    ) {
      push(assignment.id, {
        assignmentId: assignment.id,
        type: "equipment_unavailable",
        severity: "critical",
        message: `${assignment.planning_resources.name} ist ${assignment.planning_resources.status}.`
      });
    }
  }

  for (const group of byResource.values()) {
    for (let leftIndex = 0; leftIndex < group.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < group.length; rightIndex += 1) {
        const left = group[leftIndex];
        const right = group[rightIndex];
        if (!datesOverlap(left, right)) continue;
        const label =
          left.resource_type === "employee"
            ? "Mitarbeiter doppelt verplant"
            : left.resource_type === "vehicle"
              ? "Fahrzeug doppelt verplant"
              : "Geraet/Ressource doppelt verplant";
        push(left.id, { assignmentId: left.id, type: "double_booking", severity: "critical", message: label });
        push(right.id, { assignmentId: right.id, type: "double_booking", severity: "critical", message: label });
      }
    }
  }

  const alertsByJobsite = new Map<string, Pick<MaterialAlert, "severity" | "message">[]>();
  for (const alert of materialAlerts.filter((item) => item.status === "open" && item.job_id)) {
    alertsByJobsite.set(alert.job_id as string, [...(alertsByJobsite.get(alert.job_id as string) ?? []), alert]);
  }

  for (const assignment of assignments) {
    if (!assignment.jobsite_id) continue;
    const alerts = alertsByJobsite.get(assignment.jobsite_id) ?? [];
    if (alerts.length === 0) continue;
    const critical = alerts.some((alert) => alert.severity === "critical");
    push(assignment.id, {
      assignmentId: assignment.id,
      type: "material_missing",
      severity: critical ? "critical" : "warning",
      message: critical ? "Kritisches Material fehlt" : "Materialwarnung vorhanden"
    });
  }

  return conflicts;
}
