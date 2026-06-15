import { describe, expect, it } from "vitest";
import { calculateTimeMinutes, formatMinutesAsHours, monthRange, timeEntryWarnings } from "@/lib/time-tracking";

describe("time tracking calculations", () => {
  it("calculates gross and net minutes", () => {
    expect(calculateTimeMinutes({ startTime: "07:30", endTime: "16:15", breakMinutes: 45 })).toEqual({
      grossMinutes: 525,
      netMinutes: 480
    });
  });

  it("rejects invalid ranges and breaks", () => {
    expect(() => calculateTimeMinutes({ startTime: "16:00", endTime: "07:00", breakMinutes: 0 })).toThrow(
      "Arbeitsende muss nach Arbeitsbeginn liegen."
    );
    expect(() => calculateTimeMinutes({ startTime: "07:00", endTime: "08:00", breakMinutes: 90 })).toThrow(
      "Pause darf nicht groesser als die Arbeitszeit sein."
    );
  });

  it("formats hours and warns for risky entries", () => {
    expect(formatMinutesAsHours(465)).toBe("7,75 h");
    expect(timeEntryWarnings({ gross_minutes: 660, net_minutes: 630, break_minutes: 30 })).toContain(
      "Hinweis: Nettoarbeitszeit liegt ueber 10 Stunden."
    );
    expect(timeEntryWarnings({ gross_minutes: 420, net_minutes: 420, break_minutes: 0 })).toContain(
      "Hinweis: Bei laengerer Arbeitszeit fehlt eine Pause."
    );
  });

  it("builds a stable month range", () => {
    expect(monthRange(2026, 2)).toEqual({ dateFrom: "2026-02-01", dateTo: "2026-02-28" });
  });
});
