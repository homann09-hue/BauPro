export type WeatherLike = {
  weather?: string | null;
  weather_summary?: string | null;
  weather_temperature_c?: number | null;
  weather_precipitation_mm?: number | null;
  weather_wind_kmh?: number | null;
  weather_source?: string | null;
  weather_fetched_at?: string | null;
  weather_lat?: number | null;
  weather_lng?: number | null;
};

export function weatherSummary(record: WeatherLike) {
  return record.weather_summary || record.weather || null;
}

export function weatherNumber(value?: number | null, unit = "") {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export function weatherDetailsLine(record: WeatherLike) {
  const parts = [
    weatherNumber(record.weather_temperature_c, "°C"),
    weatherNumber(record.weather_precipitation_mm, "mm Regen"),
    weatherNumber(record.weather_wind_kmh, "km/h Wind"),
    record.weather_source
  ].filter((value) => value && value !== "-");

  return parts.join(" · ");
}
