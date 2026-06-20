import { selectTimeEntriesWithWeatherFallback } from "@/lib/data/time-entries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime } from "@/lib/utils";
import { formatMinutesAsHours, formatTime, monthName, sumNetMinutes } from "@/lib/time-tracking";
import { weatherDetailsLine, weatherSummary } from "@/lib/weather/display";
import { cleanPdfText, line, text } from "@/lib/pdf/simple-pdf";
import { safeUtf8FilenamePart } from "@/lib/text/german";
import type { Company, Jobsite, Profile, TimeEntry, TimeReport } from "@/types/app";

export type TimeReportExportData = {
  company: Company;
  report: TimeReport;
  employee: Profile | null;
  generatedBy: Profile | null;
  entries: TimeEntry[];
};

export function safeFilenamePart(value: string) {
  return safeUtf8FilenamePart(value, "Mitarbeiter");
}

export function timeReportFilename(data: TimeReportExportData, extension: "pdf" | "csv") {
  const employeeName = safeFilenamePart(data.employee?.full_name || data.employee?.email || "Mitarbeiter");
  return `stundenzettel_${employeeName}_${String(data.report.month).padStart(2, "0")}_${data.report.year}.${extension}`;
}

export async function loadTimeReportExportData(reportId: string, companyId: string): Promise<TimeReportExportData> {
  const supabase = await createSupabaseServerClient();

  const { data: report, error: reportError } = await supabase
    .from("time_reports")
    .select("id, company_id, employee_id, month, year, date_from, date_to, status, generated_by, generated_at")
    .eq("id", reportId)
    .eq("company_id", companyId)
    .single();

  if (reportError || !report) throw new Error("Stundenzettel wurde nicht gefunden.");

  const typedReport = report as TimeReport;
  const [{ data: company }, { data: employee }, { data: generatedBy }, { data: links }] = await Promise.all([
    supabase.from("companies").select("id, name").eq("id", companyId).single(),
    typedReport.employee_id
      ? supabase.from("profiles").select("id, company_id, email, full_name, role, active").eq("id", typedReport.employee_id).eq("company_id", companyId).maybeSingle()
      : Promise.resolve({ data: null }),
    typedReport.generated_by
      ? supabase.from("profiles").select("id, company_id, email, full_name, role, active").eq("id", typedReport.generated_by).eq("company_id", companyId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("time_report_entries").select("time_entry_id").eq("time_report_id", reportId)
  ]);

  const entryIds = (links ?? []).map((link) => link.time_entry_id as string);
  const entriesResult =
    entryIds.length > 0
      ? await selectTimeEntriesWithWeatherFallback((select) =>
          supabase
            .from("time_entries")
            .select(select)
            .in("id", entryIds)
            .eq("company_id", companyId)
            .order("date", { ascending: true })
        )
      : { data: [] };
  const rawEntries = (entriesResult.data ?? []) as TimeEntry[];
  const jobsiteIds = [...new Set(rawEntries.map((entry) => entry.job_id).filter(Boolean))];
  const { data: jobsiteRows } =
    jobsiteIds.length > 0
      ? await supabase
          .from("jobsites")
          .select("id, name, address, customer")
          .eq("company_id", companyId)
          .in("id", jobsiteIds)
      : { data: [] };
  const jobsitesById = new Map(((jobsiteRows ?? []) as Pick<Jobsite, "id" | "name" | "address" | "customer">[]).map((jobsite) => [jobsite.id, jobsite]));
  const entries = rawEntries.map((entry) => ({
    ...entry,
    jobsites: jobsitesById.get(entry.job_id) ?? null
  }));

  return {
    company: (company as Company | null) ?? { id: companyId, name: "Meine Firma" },
    report: typedReport,
    employee: (employee as unknown as Profile | null) ?? null,
    generatedBy: (generatedBy as unknown as Profile | null) ?? null,
    entries
  };
}

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function buildTimeReportCsv(data: TimeReportExportData) {
  const rows = [
    [
      "Datum",
      "Baustelle/Auftrag",
      "Ort",
      "Beginn",
      "Ende",
      "Pause Min.",
      "Netto Stunden",
      "Tätigkeit",
      "Status",
      "Wetter",
      "Temperatur C",
      "Niederschlag mm",
      "Wind km/h",
      "Wetterquelle"
    ],
    ...data.entries.map((entry) => [
      formatDate(entry.date),
      entry.jobsites?.name ?? entry.work_location,
      entry.work_address,
      formatTime(entry.start_time),
      formatTime(entry.end_time),
      entry.break_minutes,
      formatMinutesAsHours(entry.net_minutes),
      entry.activity,
      entry.status,
      weatherSummary(entry) ?? "",
      entry.weather_temperature_c ?? "",
      entry.weather_precipitation_mm ?? "",
      entry.weather_wind_kmh ?? "",
      entry.weather_source ?? ""
    ])
  ];

  rows.push([
    "Summe",
    "",
    "",
    "",
    "",
    "",
    formatMinutesAsHours(sumNetMinutes(data.entries)),
    `${data.entries.length} Tage`,
    "",
    "",
    "",
    "",
    "",
    ""
  ]);

  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

function truncate(value: string | null | undefined, length: number) {
  const cleaned = cleanPdfText(value ?? "");
  return cleaned.length > length ? `${cleaned.slice(0, length - 1)}.` : cleaned;
}

function buildPdfDocument(pageContents: string[]) {
  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const kids = pageContents.map((_, index) => `${4 + index * 2} 0 R`).join(" ");
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageContents.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

  pageContents.forEach((content, index) => {
    const pageObjectId = 4 + index * 2;
    const contentObjectId = pageObjectId + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectId} 0 R >>`
    );
    objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}endstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export function buildTimeReportPdf(data: TimeReportExportData) {
  const rowsPerPage = 12;
  const pages: string[] = [];
  const totalMinutes = sumNetMinutes(data.entries);
  const employeeName = data.employee?.full_name || data.employee?.email || "Mitarbeiter";

  for (let pageIndex = 0; pageIndex < Math.max(1, Math.ceil(data.entries.length / rowsPerPage)); pageIndex += 1) {
    const pageEntries = data.entries.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    let content = "0.8 w\n";
    content += text(36, 555, 18, "Stundenzettel");
    content += text(36, 532, 10, `Firma: ${data.company.name}`);
    content += text(36, 516, 10, `Mitarbeiter: ${employeeName}`);
    content += text(36, 500, 10, `Zeitraum: ${formatDate(data.report.date_from)} bis ${formatDate(data.report.date_to)}`);
    content += text(36, 484, 10, `Monat/Jahr: ${monthName(data.report.month)} ${data.report.year}`);
    content += text(530, 532, 10, `Erstellt: ${formatDateTime(data.report.generated_at)}`);
    content += text(530, 516, 10, `Freigabe durch Chef: ${data.generatedBy?.full_name || data.generatedBy?.email || "-"}`);
    content += text(530, 500, 10, "Automatisch erzeugter Stundenzettel aus digitaler Zeiterfassung");

    const headerY = 455;
    content += line(36, headerY + 14, 806, headerY + 14);
    content += text(38, headerY, 8, "Datum");
    content += text(88, headerY, 8, "Baustelle/Auftrag");
    content += text(228, headerY, 8, "Ort");
    content += text(382, headerY, 8, "Beginn");
    content += text(426, headerY, 8, "Ende");
    content += text(468, headerY, 8, "Pause");
    content += text(516, headerY, 8, "Netto");
    content += text(568, headerY, 8, "Tätigkeit");
    content += line(36, headerY - 5, 806, headerY - 5);

    pageEntries.forEach((entry, rowIndex) => {
      const y = headerY - 24 - rowIndex * 30;
      const weatherLine = weatherDetailsLine(entry);
      content += text(38, y, 8, formatDate(entry.date));
      content += text(88, y, 8, truncate(entry.jobsites?.name ?? entry.work_location, 24));
      content += text(228, y, 8, truncate(entry.work_address, 28));
      content += text(382, y, 8, formatTime(entry.start_time));
      content += text(426, y, 8, formatTime(entry.end_time));
      content += text(468, y, 8, `${entry.break_minutes} min`);
      content += text(516, y, 8, formatMinutesAsHours(entry.net_minutes));
      content += text(568, y, 8, truncate(entry.activity, 40));
      if (weatherSummary(entry) || weatherLine) {
        content += text(568, y - 10, 7, truncate(`Wetter: ${weatherSummary(entry) ?? "-"} | ${weatherLine}`, 43));
      }
      content += line(36, y - 16, 806, y - 16);
    });

    if (pageIndex === Math.ceil(data.entries.length / rowsPerPage) - 1 || data.entries.length === 0) {
      content += text(36, 58, 11, `Summe Stunden: ${formatMinutesAsHours(totalMinutes)}`);
      content += text(240, 58, 11, `Summe Tage: ${data.entries.length}`);
      content += text(36, 38, 8, "Hinweis: Keine Rechtsberatung. Export dient der nachvollziehbaren Dokumentation.");
    }

    content += text(760, 24, 8, `Seite ${pageIndex + 1}`);
    pages.push(content);
  }

  return buildPdfDocument(pages);
}
