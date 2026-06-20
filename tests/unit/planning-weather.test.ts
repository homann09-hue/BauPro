import { describe, expect, it } from "vitest";
import { evaluatePlanningWeatherRisk } from "@/lib/weather/planning-weather";

describe("Plantafel-Wetterlogik", () => {
  it("markiert trockenes ruhiges Wetter als gruen", () => {
    const result = evaluatePlanningWeatherRisk({
      temperatureMinC: 10,
      temperatureMaxC: 20,
      precipitationMm: 0,
      precipitationProbability: 10,
      windKmh: 12,
      windGustKmh: 18,
      weatherCode: 1
    });

    expect(result.riskLevel).toBe("green");
    expect(result.ruleCodes).toEqual([]);
  });

  it("markiert Regen und Wind als gelb", () => {
    const result = evaluatePlanningWeatherRisk({
      temperatureMinC: 8,
      temperatureMaxC: 17,
      precipitationMm: 0.8,
      precipitationProbability: 55,
      windKmh: 32,
      windGustKmh: 42,
      weatherCode: 61
    });

    expect(result.riskLevel).toBe("yellow");
    expect(result.ruleCodes).toEqual(expect.arrayContaining(["rain", "strong_wind"]));
  });

  it("markiert Gewitter als rot", () => {
    const result = evaluatePlanningWeatherRisk({
      temperatureMinC: 16,
      temperatureMaxC: 24,
      precipitationMm: 2,
      precipitationProbability: 70,
      windKmh: 25,
      windGustKmh: 40,
      weatherCode: 95
    });

    expect(result.riskLevel).toBe("red");
    expect(result.ruleCodes).toContain("thunderstorm");
    expect(result.summary).toContain("Gewitter");
  });

  it("markiert starken Wind, Frost und Hitze dachdecker-spezifisch", () => {
    expect(
      evaluatePlanningWeatherRisk({
        temperatureMinC: 4,
        temperatureMaxC: 12,
        precipitationMm: 0,
        precipitationProbability: 20,
        windKmh: 51,
        windGustKmh: 62,
        weatherCode: 2
      }).riskLevel
    ).toBe("red");

    expect(
      evaluatePlanningWeatherRisk({
        temperatureMinC: -4,
        temperatureMaxC: 3,
        precipitationMm: 0,
        precipitationProbability: 10,
        windKmh: 10,
        windGustKmh: 15,
        weatherCode: 0
      }).ruleCodes
    ).toContain("frost");

    expect(
      evaluatePlanningWeatherRisk({
        temperatureMinC: 22,
        temperatureMaxC: 36,
        precipitationMm: 0,
        precipitationProbability: 10,
        windKmh: 8,
        windGustKmh: 12,
        weatherCode: 0
      }).ruleCodes
    ).toContain("heat");
  });
});
