import { describe, expect, it } from "vitest";
import {
  buildPlanningRows,
  detectPlanningConflicts,
  getPlanningPeriod,
  planningStatusLabels,
  resourceKey
} from "@/lib/planning";
import type { MaterialAlert, PlanningAssignment, PlanningResource, Profile, Vehicle } from "@/types/app";

function assignment(overrides: Partial<PlanningAssignment>): PlanningAssignment {
  return {
    id: overrides.id ?? "11111111-1111-1111-1111-111111111111",
    company_id: "22222222-2222-2222-2222-222222222222",
    jobsite_id: overrides.jobsite_id ?? null,
    title: overrides.title ?? "Baustelle",
    resource_type: overrides.resource_type ?? "employee",
    employee_id: overrides.employee_id ?? "33333333-3333-3333-3333-333333333333",
    vehicle_id: overrides.vehicle_id ?? null,
    planning_resource_id: overrides.planning_resource_id ?? null,
    start_date: overrides.start_date ?? "2026-06-15",
    end_date: overrides.end_date ?? "2026-06-16",
    status: overrides.status ?? "geplant",
    color: "#2E7D32",
    notes: null,
    created_by: null,
    created_at: "2026-06-15T07:00:00.000Z",
    updated_at: "2026-06-15T07:00:00.000Z",
    archived_at: null,
    ...overrides
  };
}

describe("Plantafel", () => {
  it("berechnet Wochen- und Monatszeiträume stabil", () => {
    expect(getPlanningPeriod("week", "2026-06-19")).toMatchObject({
      start: "2026-06-15",
      end: "2026-06-21"
    });
    expect(getPlanningPeriod("week", "2026-06-19").days).toHaveLength(7);

    expect(getPlanningPeriod("month", "2026-06-19")).toMatchObject({
      start: "2026-06-01",
      end: "2026-06-30"
    });
  });

  it("baut Planzeilen fuer Mitarbeiter, Fahrzeuge und Ressourcen", () => {
    const employees: Array<Pick<Profile, "id" | "full_name" | "email" | "role">> = [
      { id: "employee-1", full_name: "Max Dach", email: "max@example.test", role: "mitarbeiter" }
    ];
    const vehicles: Array<Pick<Vehicle, "id" | "name" | "license_plate">> = [
      { id: "vehicle-1", name: "Transporter 1", license_plate: "K-BP 100" }
    ];
    const resources: Array<Pick<PlanningResource, "id" | "name" | "resource_kind" | "status">> = [
      { id: "resource-1", name: "Brenner", resource_kind: "geraet", status: "defekt" }
    ];

    const { rows } = buildPlanningRows({ employees, vehicles, resources });

    expect(rows.map((row) => resourceKey(row.type, row.id))).toEqual(["employee:employee-1", "vehicle:vehicle-1", "equipment:resource-1"]);
    expect(rows.find((row) => row.id === "resource-1")?.unavailable).toBe(true);
  });

  it("erkennt Doppelplanung, defekte Geraete und Materialwarnungen", () => {
    const assignments = [
      assignment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", employee_id: "employee-a" }),
      assignment({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", employee_id: "employee-a", start_date: "2026-06-16", end_date: "2026-06-17" }),
      assignment({
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        resource_type: "equipment",
        employee_id: null,
        planning_resource_id: "resource-a",
        jobsite_id: "jobsite-a",
        planning_resources: { id: "resource-a", name: "Brenner", resource_kind: "geraet", status: "defekt" }
      })
    ];
    const alerts: Array<Pick<MaterialAlert, "job_id" | "severity" | "message" | "status">> = [
      { job_id: "jobsite-a", severity: "critical", message: "Unterspannbahn fehlt", status: "open" }
    ];

    const conflicts = detectPlanningConflicts(assignments, alerts);

    expect(conflicts.get("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")?.some((conflict) => conflict.type === "double_booking")).toBe(true);
    expect(conflicts.get("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")?.some((conflict) => conflict.type === "double_booking")).toBe(true);
    expect(conflicts.get("cccccccc-cccc-cccc-cccc-cccccccccccc")?.map((conflict) => conflict.type)).toEqual([
      "equipment_unavailable",
      "material_missing"
    ]);
  });

  it("enthaelt alle geforderten Statusfarben/Statuswerte", () => {
    expect(Object.keys(planningStatusLabels)).toEqual([
      "geplant",
      "aktiv",
      "erledigt",
      "verschoben",
      "krank",
      "urlaub",
      "werkstatt",
      "defekt",
      "weiterbildung"
    ]);
  });
});
