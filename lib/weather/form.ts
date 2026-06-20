import { optionalNumber, optionalString } from "@/lib/utils";

export type WeatherFormPayload = {
  weather: string | null;
  weather_summary: string | null;
  weather_temperature_c: number | null;
  weather_precipitation_mm: number | null;
  weather_wind_kmh: number | null;
  weather_source: string | null;
  weather_fetched_at: string | null;
  weather_lat: number | null;
  weather_lng: number | null;
};

export function weatherPayloadFromFormData(formData: FormData): WeatherFormPayload {
  const summary = optionalString(formData, "weather_summary") ?? optionalString(formData, "weather");

  return {
    weather: summary,
    weather_summary: summary,
    weather_temperature_c: optionalNumber(formData, "weather_temperature_c"),
    weather_precipitation_mm: optionalNumber(formData, "weather_precipitation_mm"),
    weather_wind_kmh: optionalNumber(formData, "weather_wind_kmh"),
    weather_source: optionalString(formData, "weather_source"),
    weather_fetched_at: optionalString(formData, "weather_fetched_at"),
    weather_lat: optionalNumber(formData, "weather_lat"),
    weather_lng: optionalNumber(formData, "weather_lng")
  };
}
