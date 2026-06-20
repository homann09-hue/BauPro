import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WeatherSuggestionField } from "@/components/weather/WeatherSuggestionField";
import { weatherPayloadFromFormData } from "@/lib/weather/form";
import {
  buildWeatherSummary,
  emptyWeatherSuggestion,
  fetchOpenMeteoWeather,
  geocodeOpenMeteo,
  geocodingQueries,
  normalizeGeocodingQuery,
  parseCoordinatePair
} from "@/lib/weather/open-meteo";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("weather documentation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds practical weather text for roof work", () => {
    expect(buildWeatherSummary({ temperatureC: 18, precipitationMm: 0, windKmh: 14 })).toContain("Trocken");
    expect(buildWeatherSummary({ temperatureC: 11, precipitationMm: 4, windKmh: 12 })).toContain("Regen am Arbeitstag");
    expect(buildWeatherSummary({ temperatureC: 8, precipitationMm: 0, windKmh: 42 })).toContain("Windig");
  });

  it("parses Open-Meteo hourly values into stored weather fields without a real API call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            hourly: {
              time: ["2026-06-16T07:00", "2026-06-16T16:00"],
              temperature_2m: [17.2, 20.8],
              precipitation: [0, 0.4],
              wind_speed_10m: [12, 18.5]
            }
          }),
          { status: 200 }
        );
      })
    );

    const weather = await fetchOpenMeteoWeather({
      lat: 52.52,
      lng: 13.41,
      date: "2026-06-16",
      locationLabel: "Berlin"
    });

    expect(weather?.summary).toContain("Leichter Regen");
    expect(weather?.temperatureC).toBe(19);
    expect(weather?.precipitationMm).toBe(0.4);
    expect(weather?.windKmh).toBe(18.5);
    expect(weather?.source).toContain("Open-Meteo");
  });

  it("keeps manual fallback possible when no location exists", () => {
    expect(emptyWeatherSuggestion("Kein Standort fuer automatische Wetterdaten gefunden.")).toEqual({
      ok: false,
      reason: "Kein Standort fuer automatische Wetterdaten gefunden."
    });
  });

  it("normalizes construction wording out of geocoding queries", () => {
    const queries = geocodingQueries("Baustelle Dachsanierung Musterstraße 12, 50667 Köln");

    expect(queries[0]).toContain("Musterstraße 12");
    expect(queries.join(" ")).not.toMatch(/Baustelle|Dachsanierung/);
    expect(queries).toContain("50667 Köln");
    expect(queries).toContain("Köln");
  });

  it("normalizes common German address variants and accepts manual coordinates", () => {
    expect(normalizeGeocodingQuery("Projekt Hauptstr. 4, DE-50667 Koeln")).toBe("Hauptstraße 4, 50667 Koeln");
    expect(normalizeGeocodingQuery("Hauptstrasse 4, 50667 Koeln")).toBe("Hauptstraße 4, 50667 Koeln");
    expect(parseCoordinatePair("50.93836, 6.95997")).toEqual({ lat: 50.93836, lng: 6.95997 });
    expect(parseCoordinatePair("50,93836; 6,95997")).toEqual({ lat: 50.93836, lng: 6.95997 });
    expect(parseCoordinatePair("999, 6")).toBeNull();
  });

  it("falls back to Nominatim for full street addresses when Open-Meteo has no city result", async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const href = String(url);
      if (href.includes("geocoding-api.open-meteo.com")) {
        return new Response(JSON.stringify({ results: [] }), { status: 200 });
      }

      return new Response(
        JSON.stringify([
          {
            lat: "50.93836",
            lon: "6.95997",
            display_name: "Musterstraße 12, Innenstadt, Köln, Nordrhein-Westfalen, Deutschland",
            address: { country_code: "de" }
          }
        ]),
        { status: 200 }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const location = await geocodeOpenMeteo("Musterstraße 12, 50667 Köln");

    expect(location).toMatchObject({ lat: 50.93836, lng: 6.95997 });
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes("nominatim.openstreetmap.org/search?"))).toBe(true);
    expect(fetchMock.mock.calls.some(([, init]) => JSON.stringify(init).includes("User-Agent"))).toBe(true);
  });

  it("stores manual and automatic weather values from FormData", () => {
    const formData = new FormData();
    formData.set("weather_summary", "Trocken, 18 °C - passt als Nachweis.");
    formData.set("weather_temperature_c", "18");
    formData.set("weather_precipitation_mm", "0");
    formData.set("weather_wind_kmh", "14.5");
    formData.set("weather_source", "Open-Meteo Forecast");
    formData.set("weather_fetched_at", "2026-06-16T16:00:00.000Z");
    formData.set("weather_lat", "52.52");
    formData.set("weather_lng", "13.41");

    expect(weatherPayloadFromFormData(formData)).toMatchObject({
      weather: "Trocken, 18 °C - passt als Nachweis.",
      weather_summary: "Trocken, 18 °C - passt als Nachweis.",
      weather_temperature_c: 18,
      weather_precipitation_mm: 0,
      weather_wind_kmh: 14.5,
      weather_source: "Open-Meteo Forecast"
    });
  });

  it("renders the weather suggestion card without browser geolocation during SSR", () => {
    const html = renderToString(
      React.createElement(WeatherSuggestionField, {
        jobFieldName: "job_id",
        dateFieldName: "date",
        canManage: false
      })
    );

    expect(html).toContain("Wetter automatisch erkennen");
    expect(html).toContain("Manuell");
  });

  it("wires weather into time entries, daily hours and reports", () => {
    const weatherRoute = source("app/api/weather/suggest/route.ts");

    expect(source("lib/actions/time-tracking-actions.ts")).toContain("weatherPayloadFromFormData(formData)");
    expect(source("lib/actions/report-actions.ts")).toContain("weatherPayloadFromFormData(formData)");
    expect(source("lib/actions/weather-actions.ts")).toContain("manualCoordinatesFromForm(formData)");
    expect(source("components/weather/LiveWeatherCard.tsx")).toContain("manual_latitude");
    expect(source("app/(app)/time-tracking/daily/page.tsx")).toContain("weatherDetailsLine(entry)");
    expect(source("app/(app)/berichte/[id]/page.tsx")).toContain("weather_temperature_c");
    expect(source("supabase/schema.sql")).toContain("weather_temperature_c numeric");
    expect(weatherRoute).toContain("latitude, longitude");
    expect(weatherRoute).toContain("Cache-Control");
    expect(weatherRoute).toContain("no-store, max-age=0");
    expect(weatherRoute).toContain("candidates.push(Promise.resolve({ lat: latitude, lng: longitude");
  });
});
