import { formatDate, formatDateTime } from "@/lib/utils";
import { buildPdfDocument, cleanPdfText, drawImage, imageFromDataUrl, text, truncatePdfText } from "@/lib/pdf/simple-pdf";
import { safeUtf8FilenamePart } from "@/lib/text/german";
import { weatherDetailsLine, weatherSummary } from "@/lib/weather/display";
import type { Company, Profile, Report, TimeEntry, Vehicle } from "@/types/app";

export type ReportExportData = {
  company: Pick<Company, "id" | "name">;
  report: Report;
  employees: Pick<Profile, "id" | "full_name" | "email">[];
  vehicles?: Pick<Vehicle, "id" | "name" | "license_plate">[];
  timeEntries?: Array<Pick<TimeEntry, "id" | "start_time" | "end_time" | "net_minutes" | "activity"> & {
    profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
  }>;
  generatedAt: string;
};

function truncate(value: string | null | undefined, length: number) {
  return truncatePdfText(value, length);
}

export function reportFilename(data: ReportExportData) {
  const jobsiteName = safeUtf8FilenamePart(cleanPdfText(data.report.jobsites?.name ?? "baustelle"), "baustelle").toLowerCase();
  return `tagesbericht_${jobsiteName}_${data.report.report_date}.pdf`;
}

export function buildReportPdf(data: ReportExportData) {
  const report = data.report;
  const signatureImage = imageFromDataUrl(report.signature_data_url, "Sig1");
  const images = signatureImage ? [signatureImage] : [];
  const employeeNames = data.employees
    .filter((employee) => report.employee_ids.includes(employee.id))
    .map((employee) => employee.full_name || employee.email)
    .filter(Boolean)
    .join(", ");
  const vehicleLine = [
    report.machine_usage,
    (data.vehicles ?? []).map((vehicle) => `${vehicle.name} (${vehicle.license_plate})`).join(", ")
  ]
    .filter(Boolean)
    .join(" | ");
  const timeEntryLine = (data.timeEntries ?? [])
    .map((entry) => {
      const employee = entry.profiles?.full_name || entry.profiles?.email || "Mitarbeiter";
      return `${employee}: ${entry.start_time?.slice(0, 5) || "--:--"}-${entry.end_time?.slice(0, 5) || "--:--"} (${formatMinutes(entry.net_minutes)})`;
    })
    .join(" | ");
  let content = "0.8 w\n";
  content += text(42, 792, 18, "Tagesbericht");
  content += text(42, 768, 10, `Firma: ${data.company.name}`);
  content += text(42, 752, 10, `Baustelle: ${report.jobsites?.name ?? "Ohne Baustelle"}`);
  content += text(42, 736, 10, `Kunde: ${report.jobsites?.customer ?? "-"}`);
  content += text(42, 720, 10, `Adresse: ${report.jobsites?.address ?? "-"}`);
  content += text(42, 704, 10, `Datum: ${formatDate(report.report_date)}`);
  content += text(380, 704, 10, `Version: ${report.document_version ?? 1}`);
  content += text(42, 688, 10, `Status: ${reportStatusLabel(report.report_status ?? "draft")}`);
  content += text(42, 672, 10, `Arbeitszeit: ${report.work_start?.slice(0, 5) || "--:--"} - ${report.work_end?.slice(0, 5) || "--:--"}`);
  content += text(42, 656, 10, `Mitarbeiter: ${employeeNames || "-"}`);
  content += text(42, 640, 10, `Wetter: ${weatherSummary(report) || report.weather || "-"}`);
  content += text(42, 624, 9, weatherDetailsLine(report) || "Wetter manuell oder nicht erfasst");

  content += text(42, 592, 12, "Taetigkeiten");
  content += text(42, 574, 9, truncate(report.activities, 110));
  content += text(42, 558, 9, truncate(report.activities.slice(110), 110));
  content += text(42, 528, 12, "Materialverbrauch");
  content += text(42, 510, 9, truncate(report.material_usage, 140) || "-");
  content += text(42, 480, 12, "Maschinen / Fahrzeuge");
  content += text(42, 462, 9, truncate(vehicleLine, 140) || "-");
  content += text(42, 432, 12, "Uebernommene Arbeitszeiten");
  content += text(42, 414, 8, truncate(timeEntryLine, 170) || "-");
  content += text(42, 386, 12, "Probleme / Besonderheiten");
  content += text(42, 368, 9, truncate(report.issues, 140) || "-");
  content += text(42, 338, 12, "Unterschrift / Freigabe");
  content += text(42, 320, 9, `${report.signature_name || "-"} (${report.signature_status ?? "Entwurf"})`);
  content += text(42, 304, 8, `Signiert am: ${formatDateTime(report.signature_signed_at)}`);
  if (signatureImage) {
    content += drawImage(signatureImage.name, 42, 230, 190, 58);
    content += text(42, 212, 8, `Hash: ${report.signature_content_hash ?? "-"}`);
  }
  content += text(42, 74, 8, `Erstellt: ${formatDateTime(data.generatedAt)}`);
  content += text(42, 58, 8, "Automatisch erzeugter Tagesbericht aus digitaler Baustellendokumentation.");

  return buildPdfDocument(content, images);
}

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Entwurf",
    submitted: "Eingereicht",
    reviewed: "Geprüft",
    approved: "Freigegeben"
  };

  return labels[status] ?? status;
}

function formatMinutes(minutes?: number | null) {
  if (!minutes) return "0:00 h";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}:${String(rest).padStart(2, "0")} h`;
}
