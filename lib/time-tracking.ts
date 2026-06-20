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

export function buildHalfHourTimeOptions(startHour = 5, endHour = 20) {
  const options: string[] = [];
  for (let hour = startHour; hour <= endHour; hour += 1) {
    options.push(`${String(hour).padStart(2, "0")}:00`);
    if (hour < endHour) options.push(`${String(hour).padStart(2, "0")}:30`);
  }
  return options;
}

export const breakMinuteOptions = [0, 15, 30, 45, 60, 90, 120];

export function cycleOption<T>(options: readonly T[], currentValue: T, direction: -1 | 1) {
  if (options.length === 0) return currentValue;
  const index = options.findIndex((option) => option === currentValue);
  if (index < 0) return options[0];
  return options[(index + direction + options.length) % options.length];
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

export function sumGrossMinutes(entries: Array<Pick<TimeEntry, "gross_minutes">>) {
  return entries.reduce((sum, entry) => sum + Number(entry.gross_minutes ?? 0), 0);
}

export type DailyTimeRangePreset = "today" | "yesterday" | "week" | "month" | "custom";

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function dailyTimeRange(preset: DailyTimeRangePreset, selectedDate: string, now = new Date()) {
  const base = selectedDate ? new Date(`${selectedDate}T12:00:00`) : now;
  const safeBase = Number.isNaN(base.getTime()) ? now : base;
  const start = new Date(safeBase);
  const end = new Date(safeBase);

  if (preset === "today") {
    return { dateFrom: isoDate(now), dateTo: isoDate(now), label: "Heute" };
  }

  if (preset === "yesterday") {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return { dateFrom: isoDate(yesterday), dateTo: isoDate(yesterday), label: "Gestern" };
  }

  if (preset === "week") {
    const day = safeBase.getDay() || 7;
    start.setDate(safeBase.getDate() - day + 1);
    end.setDate(start.getDate() + 6);
    return { dateFrom: isoDate(start), dateTo: isoDate(end), label: "Woche" };
  }

  if (preset === "month") {
    start.setDate(1);
    end.setMonth(start.getMonth() + 1, 0);
    return { dateFrom: isoDate(start), dateTo: isoDate(end), label: "Monat" };
  }

  return { dateFrom: isoDate(safeBase), dateTo: isoDate(safeBase), label: "Datum" };
}

export type DailyEmployeeGroup<T extends Pick<TimeEntry, "employee_id" | "net_minutes" | "gross_minutes" | "start_time">> = {
  employeeId: string;
  employeeName: string;
  entries: T[];
  grossMinutes: number;
  netMinutes: number;
};

export type DailyTimeGroup<T extends Pick<TimeEntry, "date" | "employee_id" | "net_minutes" | "gross_minutes" | "start_time">> = {
  date: string;
  entries: T[];
  grossMinutes: number;
  netMinutes: number;
  employees: DailyEmployeeGroup<T>[];
};

export function groupTimeEntriesByDateAndEmployee<
  T extends Pick<TimeEntry, "date" | "employee_id" | "net_minutes" | "gross_minutes" | "profiles" | "start_time">
>(entries: T[]) {
  const dateMap = new Map<string, T[]>();

  entries.forEach((entry) => {
    const dateEntries = dateMap.get(entry.date) ?? [];
    dateEntries.push(entry);
    dateMap.set(entry.date, dateEntries);
  });

  return Array.from(dateMap.entries())
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([date, dateEntries]) => {
      const employeeMap = new Map<string, T[]>();
      dateEntries.forEach((entry) => {
        const employeeEntries = employeeMap.get(entry.employee_id) ?? [];
        employeeEntries.push(entry);
        employeeMap.set(entry.employee_id, employeeEntries);
      });

      const employees = Array.from(employeeMap.entries())
        .map(([employeeId, employeeEntries]) => {
          const first = employeeEntries[0];
          return {
            employeeId,
            employeeName: first?.profiles?.full_name || first?.profiles?.email || "Mitarbeiter",
            entries: employeeEntries.sort((left, right) => left.start_time.localeCompare(right.start_time)),
            grossMinutes: sumGrossMinutes(employeeEntries),
            netMinutes: sumNetMinutes(employeeEntries)
          };
        })
        .sort((left, right) => left.employeeName.localeCompare(right.employeeName, "de"));

      return {
        date,
        entries: dateEntries,
        grossMinutes: sumGrossMinutes(dateEntries),
        netMinutes: sumNetMinutes(dateEntries),
        employees
      };
    });
}
