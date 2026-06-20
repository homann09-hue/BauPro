import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildRadarTileSet,
  calculateWeatherRisk,
  fetchLiveWeather,
  selectActiveWeatherJobsite,
  tileForLatLng
} from "@/lib/weather/live-weather";
import type { Jobsite, Order, Report, TimeEntry } from "@/types/app";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function jobsite(overrides: Partial<Jobsite>): Jobsite {
  return {
    id: "job-1",
    company_id: "company-1",
    name: "Dachsanierung Mitte",
    customer: "Kunde",
    address: "Hauptstrasse 1, Koeln",
    start_date: "2026-06-16",
    status: "aktiv",
    notes: null,
    assigned_employee_ids: ["employee-1"],
    created_at: "2026-06-16T06:00:00.000Z",
    ...overrides
  };
}

describe("live weather dashboard", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects the most active jobsite from today, running orders and staff signals", () => {
    const decision = selectActiveWeatherJobsite({
      todayIso: "2026-06-16",
      jobsites: [
        jobsite({ id: "quiet", name: "Leise Baustelle", start_date: "2026-06-20", assigned_employee_ids: [] }),
        jobsite({ id: "active", name: "Aktive Baustelle", assigned_employee_ids: ["a", "b", "c"] })
      ],
      orders: [
        {
          id: "order-1",
          jobsite_id: "active",
          status: "in_arbeit",
          priority: "hoch",
          start_date: "2026-06-16",
          end_date: null
        } as Pick<Order, "id" | "jobsite_id" | "status" | "priority" | "start_date" | "end_date">
      ],
      timeEntries: [
        { id: "time-1", job_id: "active", date: "2026-06-16", status: "submitted" } as Pick<
          TimeEntry,
          "id" | "job_id" | "date" | "status"
        >
      ],
      reports: [] as Pick<Report, "id" | "jobsite_id" | "report_date">[]
    });

    expect(decision.jobsite?.id).toBe("active");
    expect(decision.reasons).toContain("Prioritaet hoch");
    expect(decision.reasons).toContain("laufender Auftrag");
  });

  it("calculates weather risk for dry, rainy and windy conditions", () => {
    expect(calculateWeatherRisk({ precipitationMm: 0, precipitationProbability: 10, windKmh: 12, weatherCode: 1 })).toBe("green");
    expect(calculateWeatherRisk({ precipitationMm: 0.6, precipitationProbability: 35, windKmh: 12, weatherCode: 61 })).toBe("yellow");
    expect(calculateWeatherRisk({ precipitationMm: 0, precipitationProbability: 20, windKmh: 55, weatherCode: 2 })).toBe("red");
  });

  it("fetches current Open-Meteo values and turns them into a construction risk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            current: {
              time: "2026-06-16T09:00",
              temperature_2m: 18.4,
              precipitation: 1.2,
              weather_code: 61,
              wind_speed_10m: 22
            },
            hourly: {
              precipitation_probability: [35, 65, 70],
              precipitation: [0.4, 0.6, 0.2],
              wind_speed_10m: [22, 24, 25],
              weather_code: [61, 61, 3]
            }
          }),
          { status: 200 }
        );
      })
    );

    const weather = await fetchLiveWeather({ lat: 50.94, lng: 6.95 });
    expect(weather?.temperatureC).toBe(18.4);
    expect(weather?.precipitationProbability).toBe(70);
    expect(weather?.riskLevel).toBe("yellow");
    expect(weather?.summary).toContain("Regen");
  });

  it("builds radar tiles around the jobsite marker", () => {
    const center = tileForLatLng(50.94, 6.95, 7);
    const tileSet = buildRadarTileSet({
      lat: 50.94,
      lng: 6.95,
      frame: { label: "Jetzt", time: 1, path: "https://tilecache.rainviewer.com/v2/radar/1", source: "RainViewer" }
    });

    expect(tileSet.centerTile).toEqual(center);
    expect(tileSet.tiles).toHaveLength(9);
    expect(tileSet.tiles[0].baseUrl).toContain("tile.openstreetmap.org/7/");
    expect(tileSet.tiles[0].radarUrl).toContain("/256/7/");
  });

  it("keeps live weather visible only for manager dashboard code paths", () => {
    const dashboard = source("app/(app)/dashboard/page.tsx");
    expect(dashboard).toContain("context.canManage ? (");
    expect(dashboard).toContain("<LiveWeatherCard");
    expect(dashboard).not.toContain("Mitarbeiter sieht Live-Wetter");
  });
});
