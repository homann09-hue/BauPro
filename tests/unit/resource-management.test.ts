import { describe, expect, it } from "vitest";
import { detectPlanningConflicts } from "@/lib/planning";
import { maintenanceDueState, resourceKindLabels, resourceStatusLabels } from "@/lib/resources";
import { PROTECTED_TABLES } from "@/lib/data/soft-delete-guard";
import type { PlanningAssignment } from "@/types/app";

function equipmentAssignment(overrides: Partial<PlanningAssignment>): PlanningAssignment {
  return {
    id: overrides.id ?? "11111111-1111-1111-1111-111111111111",
    company_id: "22222222-2222-2222-2222-222222222222",
    jobsite_id: null,
    title: "Ressource",
    resource_type: "equipment",
    employee_id: null,
    vehicle_id: null,
    planning_resource_id: overrides.planning_resource_id ?? "33333333-3333-3333-3333-333333333333",
    start_date: overrides.start_date ?? "2026-06-19",
    end_date: overrides.end_date ?? "2026-06-20",
    status: overrides.status ?? "geplant",
    color: "#2E7D32",
    notes: null,
    created_by: null,
    created_at: "2026-06-19T07:00:00.000Z",
    updated_at: "2026-06-19T07:00:00.000Z",
    archived_at: null,
    ...overrides
  };
}

describe("Geräte- und Fahrzeugverwaltung", () => {
  it("enthält praxisnahe Ressourcenarten und Statuswerte", () => {
    expect(resourceKindLabels).toMatchObject({
      fahrzeug: "Fahrzeug",
      anhaenger: "Anhänger",
      maschine: "Maschine",
      werkzeug: "Werkzeug",
      geruest_leiter: "Gerüst / Leiter"
    });
    expect(resourceStatusLabels).toMatchObject({
      verfuegbar: "Verfügbar",
      auf_baustelle: "Auf Baustelle",
      im_fahrzeug: "Im Fahrzeug",
      defekt: "Defekt",
      werkstatt: "Werkstatt",
      reserviert: "Reserviert"
    });
  });

  it("erkennt fällige und bald fällige Prüf- oder Wartungstermine", () => {
    const isoInDays = (days: number) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().slice(0, 10);
    };

    expect(maintenanceDueState(isoInDays(-1), null)).toBe("overdue");
    expect(maintenanceDueState(isoInDays(10), null)).toBe("soon");
    expect(maintenanceDueState(isoInDays(60), null)).toBe("ok");
    expect(maintenanceDueState(null, null)).toBe("none");
  });

  it("markiert doppelt gebuchte Geräte als kritischen Konflikt", () => {
    const assignments = [
      equipmentAssignment({ id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", planning_resource_id: "resource-1" }),
      equipmentAssignment({ id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", planning_resource_id: "resource-1", start_date: "2026-06-20" })
    ];

    const conflicts = detectPlanningConflicts(assignments, []);

    expect(conflicts.get("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")?.[0]).toMatchObject({
      type: "double_booking",
      severity: "critical"
    });
    expect(conflicts.get("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")?.[0]).toMatchObject({
      type: "double_booking",
      severity: "critical"
    });
  });

  it("schuetzt Ressourcen-Dokumente vor Hard-Delete-Regressionen", () => {
    expect(PROTECTED_TABLES).toContain("resource_documents");
  });
});
