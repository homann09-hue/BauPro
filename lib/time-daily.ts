import { dailyTimeRange, type DailyTimeRangePreset } from "@/lib/time-tracking";
import type { Role, TimeEntry, TimeEntryStatus } from "@/types/app";

export type DailyTimeFilters = {
  preset: DailyTimeRangePreset;
  selectedDate: string;
  dateFrom: string;
  dateTo: string;
  employeeId: string;
  jobId: string;
  status: "all" | TimeEntryStatus;
};

export type DailyTimeViewer = {
  userId: string;
  companyId: string;
  role: Role;
};

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizedPreset(value: string): DailyTimeRangePreset {
  if (value === "yesterday" || value === "week" || value === "month" || value === "custom") return value;
  return "today";
}

function normalizedStatus(value: string): DailyTimeFilters["status"] {
  if (value === "draft" || value === "submitted" || value === "approved" || value === "rejected") return value;
  return "all";
}

export function parseDailyTimeFilters(params: Record<string, string | string[] | undefined>, now = new Date()): DailyTimeFilters {
  const preset = normalizedPreset(firstParam(params.range));
  const selectedDate = firstParam(params.date) || now.toISOString().slice(0, 10);
  const range = dailyTimeRange(preset, selectedDate, now);

  return {
    preset,
    selectedDate,
    dateFrom: range.dateFrom,
    dateTo: range.dateTo,
    employeeId: firstParam(params.employee_id),
    jobId: firstParam(params.job_id),
    status: normalizedStatus(firstParam(params.status))
  };
}

export function canViewerReadTimeEntry(viewer: DailyTimeViewer, entry: Pick<TimeEntry, "company_id" | "employee_id">) {
  if (entry.company_id !== viewer.companyId) return false;
  if (viewer.role === "admin" || viewer.role === "chef") return true;
  return entry.employee_id === viewer.userId;
}

export function canViewerUpdateTimeEntry(viewer: DailyTimeViewer, entry: Pick<TimeEntry, "company_id" | "employee_id" | "status">) {
  if (!canViewerReadTimeEntry(viewer, entry)) return false;
  if (viewer.role === "admin" || viewer.role === "chef") return true;
  return entry.status !== "approved";
}

export function filterDailyTimeEntries<T extends Pick<TimeEntry, "company_id" | "employee_id" | "job_id" | "date" | "status">>(
  entries: T[],
  filters: DailyTimeFilters,
  viewer: DailyTimeViewer
) {
  return entries.filter((entry) => {
    if (!canViewerReadTimeEntry(viewer, entry)) return false;
    if (entry.date < filters.dateFrom || entry.date > filters.dateTo) return false;
    if (filters.employeeId && entry.employee_id !== filters.employeeId) return false;
    if (filters.jobId && entry.job_id !== filters.jobId) return false;
    if (filters.status !== "all" && entry.status !== filters.status) return false;
    return true;
  });
}
