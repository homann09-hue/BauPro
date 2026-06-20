import { describe, expect, it } from "vitest";
import {
  breakMinuteOptions,
  buildHalfHourTimeOptions,
  calculateTimeMinutes,
  cycleOption,
  formatMinutesAsHours,
  monthRange,
  timeEntryWarnings
} from "@/lib/time-tracking";

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

  it("builds mobile-friendly half-hour dropdown options", () => {
    const options = buildHalfHourTimeOptions();
    expect(options[0]).toBe("05:00");
    expect(options[1]).toBe("05:30");
    expect(options).toContain("20:00");
    expect(options).not.toContain("20:30");
    expect(options).toHaveLength(31);
    expect(breakMinuteOptions).toEqual([0, 15, 30, 45, 60, 90, 120]);
  });

  it("cycles time and break choices instead of ending at the highest value", () => {
    const options = buildHalfHourTimeOptions();
    expect(cycleOption(options, "20:00", 1)).toBe("05:00");
    expect(cycleOption(options, "05:00", -1)).toBe("20:00");
    expect(cycleOption(breakMinuteOptions, 120, 1)).toBe(0);
    expect(cycleOption(breakMinuteOptions, 0, -1)).toBe(120);
  });
});
