import type { TimeEntry, TimeEntryStatus, TimeReportStatus } from "@/types/app";

export const timeEntryStatusLabels: Record<TimeEntryStatus, string> = {
  draft: "Entwurf",
  submitted: "Eingereicht",
  approved: "Freigegeben",
  rejected: "Abgelehnt"
};

export const timeReportStatusLabels: Record<TimeReportStatus, string> = {
  generated: "Erstellt",
  approved: "Freigegeben",
  archived: "Archiviert"
};

export function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    throw new Error("Bitte gueltige Uhrzeiten eintragen.");
  }
  return hours * 60 + minutes;
}

export function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatMinutesAsHours(minutes?: number | null) {
  if (minutes === null || minutes === undefined) return "0,00 h";
  return `${minutesToHours(Number(minutes)).toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })} h`;
}

export function formatTime(value?: string | null) {
  return value ? value.slice(0, 5) : "--:--";
}

export function calculateTimeMinutes({
  startTime,
  endTime,
  breakMinutes
}: {
  startTime: string;
  endTime: string;
  breakMinutes: number;
}) {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const grossMinutes = end - start;

  if (grossMinutes <= 0) {
    throw new Error("Arbeitsende muss nach Arbeitsbeginn liegen.");
  }

  if (breakMinutes < 0) {
    throw new Error("Pause darf nicht negativ sein.");
  }

  if (breakMinutes > grossMinutes) {
    throw new Error("Pause darf nicht groesser als die Arbeitszeit sein.");
  }

  return {
    grossMinutes,
    netMinutes: grossMinutes - breakMinutes
  };
}

export function timeEntryWarnings(entry: Pick<TimeEntry, "gross_minutes" | "net_minutes" | "break_minutes">) {
  const warnings: string[] = [];

  if (entry.net_minutes > 600) {
    warnings.push("Hinweis: Nettoarbeitszeit liegt ueber 10 Stunden.");
  }

  if (entry.gross_minutes >= 360 && entry.break_minutes === 0) {
    warnings.push("Hinweis: Bei laengerer Arbeitszeit fehlt eine Pause.");
  }

  return warnings;
}

export function monthRange(year: number, month: number) {
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const dateToDate = new Date(year, month, 0);
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(dateToDate.getDate()).padStart(2, "0")}`;
  return { dateFrom, dateTo };
}

export function monthName(month: number) {
  return new Intl.DateTimeFormat("de-DE", { month: "long" }).format(new Date(2026, month - 1, 1));
}

export function sumNetMinutes(entries: Array<Pick<TimeEntry, "net_minutes">>) {
  return entries.reduce((sum, entry) => sum + Number(entry.net_minutes ?? 0), 0);
}
