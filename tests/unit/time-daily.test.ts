import { describe, expect, it } from "vitest";
import { canViewerUpdateTimeEntry, filterDailyTimeEntries, parseDailyTimeFilters } from "@/lib/time-daily";
import { groupTimeEntriesByDateAndEmployee } from "@/lib/time-tracking";
import type { TimeEntry } from "@/types/app";

function timeEntry(overrides: Partial<TimeEntry>): TimeEntry {
  return {
    id: "entry-1",
    company_id: "company-a",
    employee_id: "employee-a",
    job_id: "job-a",
    customer_id: null,
    date: "2026-06-16",
    work_location: "Baustelle Mitte",
    work_address: "Hauptstrasse 1, Koeln",
    start_time: "07:00",
    end_time: "15:30",
    break_minutes: 30,
    gross_minutes: 510,
    net_minutes: 480,
    activity: "Dachflaeche vorbereitet",
    weather: null,
    kilometers: null,
    notes: null,
    status: "submitted",
    approved_by: null,
    approved_at: null,
    created_by: "employee-a",
    created_at: "2026-06-16T06:00:00.000Z",
    updated_at: "2026-06-16T14:00:00.000Z",
    profiles: { id: "employee-a", full_name: "Max Meyer", email: "max@example.test" },
    jobsites: { id: "job-a", name: "Baustelle Mitte", address: "Hauptstrasse 1, Koeln", customer: "Kunde A" },
    ...overrides
  };
}

describe("daily time tracking access", () => {
  const now = new Date("2026-06-16T12:00:00.000Z");
  const filters = parseDailyTimeFilters({ range: "today" }, now);
  const entries = [
    timeEntry({ id: "a-1", employee_id: "employee-a", profiles: { id: "employee-a", full_name: "Max Meyer", email: "max@example.test" } }),
    timeEntry({ id: "a-2", employee_id: "employee-b", profiles: { id: "employee-b", full_name: "Sara Schulz", email: "sara@example.test" } }),
    timeEntry({ id: "b-1", company_id: "company-b", employee_id: "employee-c" })
  ];

  it("allows chef to see all employee hours in their company", () => {
    const visible = filterDailyTimeEntries(entries, filters, {
      userId: "chef-a",
      companyId: "company-a",
      role: "chef"
    });

    expect(visible.map((entry) => entry.id)).toEqual(["a-1", "a-2"]);
  });

  it("keeps employees scoped to their own hours", () => {
    const visible = filterDailyTimeEntries(entries, filters, {
      userId: "employee-a",
      companyId: "company-a",
      role: "mitarbeiter"
    });

    expect(visible.map((entry) => entry.id)).toEqual(["a-1"]);
  });

  it("blocks employees from updating approved entries", () => {
    const draftEntry = timeEntry({ status: "draft", employee_id: "employee-a" });
    const approvedEntry = timeEntry({ status: "approved", employee_id: "employee-a" });
    const viewer = { userId: "employee-a", companyId: "company-a", role: "mitarbeiter" as const };

    expect(canViewerUpdateTimeEntry(viewer, draftEntry)).toBe(true);
    expect(canViewerUpdateTimeEntry(viewer, approvedEntry)).toBe(false);
  });

  it("prevents company A from reading company B hours", () => {
    const visible = filterDailyTimeEntries([timeEntry({ id: "b-1", company_id: "company-b" })], filters, {
      userId: "chef-a",
      companyId: "company-a",
      role: "admin"
    });

    expect(visible).toEqual([]);
  });

  it("filters by day, week, employee, job and status", () => {
    const weekFilters = parseDailyTimeFilters(
      { range: "week", date: "2026-06-17", employee_id: "employee-a", job_id: "job-a", status: "approved" },
      now
    );
    const visible = filterDailyTimeEntries(
      [
        timeEntry({ id: "match", status: "approved", date: "2026-06-18", employee_id: "employee-a", job_id: "job-a" }),
        timeEntry({ id: "wrong-status", status: "submitted", date: "2026-06-18", employee_id: "employee-a", job_id: "job-a" }),
        timeEntry({ id: "wrong-date", status: "approved", date: "2026-06-29", employee_id: "employee-a", job_id: "job-a" }),
        timeEntry({ id: "wrong-employee", status: "approved", date: "2026-06-18", employee_id: "employee-b", job_id: "job-a" })
      ],
      weekFilters,
      { userId: "chef-a", companyId: "company-a", role: "chef" }
    );

    expect(weekFilters.dateFrom).toBe("2026-06-15");
    expect(weekFilters.dateTo).toBe("2026-06-21");
    expect(visible.map((entry) => entry.id)).toEqual(["match"]);
  });

  it("groups entries by date and employee with daily totals", () => {
    const groups = groupTimeEntriesByDateAndEmployee([
      timeEntry({ id: "late", employee_id: "employee-a", start_time: "12:00", net_minutes: 180 }),
      timeEntry({ id: "early", employee_id: "employee-a", start_time: "07:00", net_minutes: 240 }),
      timeEntry({
        id: "other",
        employee_id: "employee-b",
        profiles: { id: "employee-b", full_name: "Sara Schulz", email: "sara@example.test" },
        net_minutes: 120
      })
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].netMinutes).toBe(540);
    expect(groups[0].employees).toHaveLength(2);
    expect(groups[0].employees[0].entries.map((entry) => entry.id)).toEqual(["early", "late"]);
  });
});
