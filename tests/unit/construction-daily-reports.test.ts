import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("construction daily reports", () => {
  it("adds workflow, machine, vehicle and time-entry fields to migration and schema", () => {
    const migration = read("supabase/migrations/20260626_construction_daily_reports.sql");
    const schema = read("supabase/schema.sql");

    for (const source of [migration, schema]) {
      expect(source).toContain("report_status text");
      expect(source).toContain("submitted_at timestamptz");
      expect(source).toContain("reviewed_by uuid references public.profiles");
      expect(source).toContain("approved_by uuid references public.profiles");
      expect(source).toContain("machine_usage text");
      expect(source).toContain("vehicle_ids uuid[]");
      expect(source).toContain("linked_time_entry_ids uuid[]");
      expect(source).toContain("reports_workflow_idx");
      expect(source).toContain("reports_time_link_idx");
      expect(source).toContain("old.report_status = 'approved'");
    }
  });

  it("keeps report workflow role-aware and server-side validated", () => {
    const actions = read("lib/actions/report-actions.ts");

    expect(actions).toContain("reportStatusFromForm");
    expect(actions).toContain("reportVehicleIds");
    expect(actions).toContain("linkedTimeEntries");
    expect(actions).toContain("assertJobsiteInCompany");
    expect(actions).toContain("assertProfilesInCompany");
    expect(actions).toContain("context.canOperate");
    expect(actions).toContain("updateReportWorkflowAction");
    expect(actions).toContain("Keine Berechtigung zum Pruefen oder Freigeben von Bautagesberichten.");
    expect(actions).toContain("Freigegebene Bautagesberichte koennen nicht geaendert werden");
  });

  it("connects mobile form, weather, voice, photos, vehicles and linked time entries", () => {
    const form = read("components/forms/report-form.tsx");
    const newPage = read("app/(app)/berichte/neu/page.tsx");
    const editPage = read("app/(app)/berichte/[id]/bearbeiten/page.tsx");

    expect(form).toContain("VoiceTextarea");
    expect(form).toContain("WeatherSuggestionField");
    expect(form).toContain("PhotoCaptureButton");
    expect(form).toContain('name="linked_time_entry_ids"');
    expect(form).toContain('name="vehicle_ids"');
    expect(form).toContain('name="machine_usage"');
    expect(form).toContain('value="submitted"');
    expect(newPage).toContain("time_entries");
    expect(newPage).toContain("defaultJobsiteId");
    expect(editPage).toContain("Bericht gesperrt");
  });

  it("shows review state in UI and exports the enriched report to PDF", () => {
    const detail = read("app/(app)/berichte/[id]/page.tsx");
    const list = read("app/(app)/berichte/page.tsx");
    const pdf = read("lib/report-export.ts");
    const pdfRoute = read("app/(app)/berichte/[id]/pdf/route.ts");

    expect(detail).toContain("WorkflowPanel");
    expect(detail).toContain("Verknüpfte Arbeitszeiten");
    expect(detail).toContain("Maschinen / Fahrzeuge");
    expect(detail).toContain("Freigeben");
    expect(list).toContain("StatusBadge");
    expect(list).toContain("Eingereicht");
    expect(pdf).toContain("Status:");
    expect(pdf).toContain("Maschinen / Fahrzeuge");
    expect(pdf).toContain("Uebernommene Arbeitszeiten");
    expect(pdfRoute).toContain("vehicleOptionSelect");
    expect(pdfRoute).toContain("time_entries");
  });
});
