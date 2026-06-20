import { describe, expect, it } from "vitest";
import { buildTimeReportCsv, buildTimeReportPdf, safeFilenamePart, timeReportFilename } from "@/lib/time-report-export";
import type { TimeReportExportData } from "@/lib/time-report-export";

const exportData: TimeReportExportData = {
  company: { id: "company-1", name: "Müller Dachtechnik GmbH" },
  employee: {
    id: "employee-1",
    company_id: "company-1",
    email: "max@example.test",
    full_name: "Max Müller",
    role: "mitarbeiter",
    active: true
  },
  generatedBy: {
    id: "chef-1",
    company_id: "company-1",
    email: "chef@example.test",
    full_name: "Sabine Schröder",
    role: "chef",
    active: true
  },
  report: {
    id: "report-1",
    company_id: "company-1",
    employee_id: "employee-1",
    month: 6,
    year: 2026,
    date_from: "2026-06-01",
    date_to: "2026-06-30",
    status: "generated",
    generated_by: "chef-1",
    generated_at: "2026-06-15T08:00:00.000Z"
  },
  entries: [
    {
      id: "entry-1",
      company_id: "company-1",
      employee_id: "employee-1",
      job_id: "job-1",
      customer_id: null,
      date: "2026-06-15",
      work_location: "Dachsanierung Altbau König",
      work_address: "Dachdeckerstraße 12, Köln",
      start_time: "07:00:00",
      end_time: "16:00:00",
      break_minutes: 60,
      gross_minutes: 540,
      net_minutes: 480,
      activity: "Fußpfette gemessen, Größe und Maßangaben geprüft",
      weather: "trocken",
      kilometers: 18,
      notes: "Überstunden abgestimmt",
      status: "approved",
      approved_by: "chef-1",
      approved_at: "2026-06-15T17:00:00.000Z",
      created_by: "employee-1",
      created_at: "2026-06-15T16:10:00.000Z",
      updated_at: "2026-06-15T17:00:00.000Z",
      jobsites: {
        id: "job-1",
        name: "Dachsanierung Altbau König",
        address: "Dachdeckerstraße 12, Köln",
        customer: "König"
      }
    }
  ]
};

describe("time report export", () => {
  it("creates safe filenames", () => {
    expect(safeFilenamePart("Max Müller / Dach")).toBe("Max_Müller_Dach");
    expect(timeReportFilename(exportData, "pdf")).toBe("stundenzettel_Max_Müller_06_2026.pdf");
  });

  it("creates a CSV with totals", () => {
    const csv = buildTimeReportCsv(exportData);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Datum");
    expect(csv).toContain("Tätigkeit");
    expect(csv).toContain("Dachsanierung Altbau König");
    expect(csv).toContain("Dachdeckerstraße 12, Köln");
    expect(csv).toContain("Fußpfette gemessen, Größe und Maßangaben geprüft");
    expect(csv).toContain("8,00 h");
    expect(csv).toContain("1 Tage");
  });

  it("creates a valid PDF buffer", () => {
    const pdf = buildTimeReportPdf(exportData);
    expect(pdf.subarray(0, 8).toString("utf8")).toBe("%PDF-1.4");
    expect(pdf.length).toBeGreaterThan(500);
    const pdfText = pdf.toString("latin1");
    expect(pdfText).toContain("Max M\\374ller");
    expect(pdfText).toContain("Fu\\337pfette");
  });
});
