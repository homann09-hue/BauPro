import { formatDate, formatDateTime } from "@/lib/utils";
import { formatMinutesAsHours, formatTime, sumGrossMinutes, sumNetMinutes, timeEntryStatusLabels } from "@/lib/time-tracking";
import { weatherDetailsLine, weatherNumber, weatherSummary } from "@/lib/weather/display";
import { cleanPdfText, line, text } from "@/lib/pdf/simple-pdf";
import type { Company, Profile, TimeEntry } from "@/types/app";

export type DailyTimeExportData = {
  company: Pick<Company, "id" | "name">;
  generatedBy: Pick<Profile, "id" | "full_name" | "email"> | null;
  dateFrom: string;
  dateTo: string;
  entries: TimeEntry[];
};

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, "\"\"")}"`;
}

export function dailyTimeFilename(data: DailyTimeExportData, extension: "pdf" | "csv") {
  const suffix = data.dateFrom === data.dateTo ? data.dateFrom : `${data.dateFrom}_bis_${data.dateTo}`;
  return `tagesstunden_${suffix}.${extension}`;
}

export function buildDailyTimeCsv(data: DailyTimeExportData) {
  const rows = [
    [
      "Datum",
      "Mitarbeiter",
      "Baustelle",
      "Arbeitsort",
      "Beginn",
      "Ende",
      "Pause Min.",
      "Brutto Stunden",
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
      entry.profiles?.full_name || entry.profiles?.email || "Mitarbeiter",
      entry.jobsites?.name ?? entry.work_location,
      entry.work_address,
      formatTime(entry.start_time),
      formatTime(entry.end_time),
      entry.break_minutes,
      formatMinutesAsHours(entry.gross_minutes),
      formatMinutesAsHours(entry.net_minutes),
      entry.activity,
      timeEntryStatusLabels[entry.status],
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
    "",
    formatMinutesAsHours(sumGrossMinutes(data.entries)),
    formatMinutesAsHours(sumNetMinutes(data.entries)),
    `${data.entries.length} Einträge`,
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

export function buildDailyTimePdf(data: DailyTimeExportData) {
  const rowsPerPage = 11;
  const pages: string[] = [];
  const totalGross = sumGrossMinutes(data.entries);
  const totalNet = sumNetMinutes(data.entries);
  const period = data.dateFrom === data.dateTo ? formatDate(data.dateFrom) : `${formatDate(data.dateFrom)} bis ${formatDate(data.dateTo)}`;

  for (let pageIndex = 0; pageIndex < Math.max(1, Math.ceil(data.entries.length / rowsPerPage)); pageIndex += 1) {
    const pageEntries = data.entries.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    let content = "0.8 w\n";
    content += text(36, 555, 18, "Tagesstunden");
    content += text(36, 532, 10, `Firma: ${data.company.name}`);
    content += text(36, 516, 10, `Zeitraum: ${period}`);
    content += text(530, 532, 10, `Erstellt: ${formatDateTime(new Date().toISOString())}`);
    content += text(530, 516, 10, `Export durch: ${data.generatedBy?.full_name || data.generatedBy?.email || "-"}`);
    content += text(530, 500, 10, "Automatisch erzeugte Tagesübersicht aus digitaler Zeiterfassung");

    const headerY = 455;
    content += line(36, headerY + 14, 806, headerY + 14);
    content += text(38, headerY, 8, "Datum");
    content += text(88, headerY, 8, "Mitarbeiter");
    content += text(178, headerY, 8, "Baustelle");
    content += text(292, headerY, 8, "Beginn");
    content += text(334, headerY, 8, "Ende");
    content += text(376, headerY, 8, "Pause");
    content += text(424, headerY, 8, "Brutto");
    content += text(476, headerY, 8, "Netto");
    content += text(528, headerY, 8, "Tätigkeit");
    content += text(744, headerY, 8, "Status");
    content += line(36, headerY - 5, 806, headerY - 5);

    pageEntries.forEach((entry, rowIndex) => {
      const y = headerY - 24 - rowIndex * 32;
      const weatherLine = weatherDetailsLine(entry);
      content += text(38, y, 8, formatDate(entry.date));
      content += text(88, y, 8, truncate(entry.profiles?.full_name || entry.profiles?.email, 16));
      content += text(178, y, 8, truncate(entry.jobsites?.name ?? entry.work_location, 19));
      content += text(292, y, 8, formatTime(entry.start_time));
      content += text(334, y, 8, formatTime(entry.end_time));
      content += text(376, y, 8, `${entry.break_minutes} min`);
      content += text(424, y, 8, formatMinutesAsHours(entry.gross_minutes));
      content += text(476, y, 8, formatMinutesAsHours(entry.net_minutes));
      content += text(528, y, 8, truncate(entry.activity, 38));
      content += text(744, y, 8, timeEntryStatusLabels[entry.status]);
      if (weatherSummary(entry) || weatherLine) {
        content += text(
          528,
          y - 10,
          7,
          truncate(`Wetter: ${weatherSummary(entry) ?? "-"} | ${weatherLine || weatherNumber(entry.weather_temperature_c, "C")}`, 52)
        );
      }
      content += line(36, y - 16, 806, y - 16);
    });

    if (pageIndex === Math.ceil(data.entries.length / rowsPerPage) - 1 || data.entries.length === 0) {
      content += text(36, 58, 11, `Summe Brutto: ${formatMinutesAsHours(totalGross)}`);
      content += text(240, 58, 11, `Summe Netto: ${formatMinutesAsHours(totalNet)}`);
      content += text(450, 58, 11, `Einträge: ${data.entries.length}`);
      content += text(36, 38, 8, "Hinweis: Keine Rechtsberatung. Export dient der nachvollziehbaren Dokumentation.");
    }

    content += text(760, 24, 8, `Seite ${pageIndex + 1}`);
    pages.push(content);
  }

  return buildPdfDocument(pages);
}
