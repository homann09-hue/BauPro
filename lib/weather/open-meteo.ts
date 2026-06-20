export type WeatherSuggestion = {
  summary: string;
  temperatureC: number | null;
  precipitationMm: number | null;
  windKmh: number | null;
  source: string;
  fetchedAt: string;
  lat: number;
  lng: number;
  locationLabel: string | null;
};

type GeocodingResult = {
  name?: string;
  latitude?: number;
  longitude?: number;
  country_code?: string;
  admin1?: string;
  postcodes?: string[];
};

type NominatimResult = {
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: {
    country_code?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    road?: string;
    house_number?: string;
    state?: string;
  };
};

type OpenMeteoHourly = {
  time?: string[];
  temperature_2m?: Array<number | null>;
  precipitation?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
};

type OpenMeteoResponse = {
  hourly?: OpenMeteoHourly;
};

export const WEATHER_PROVIDER_NAME = "Open-Meteo";

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function values(list?: Array<number | null>) {
  return (list ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function sum(list: number[]) {
  return list.reduce((total, value) => total + value, 0);
}

function average(list: number[]) {
  if (!list.length) return null;
  return sum(list) / list.length;
}

function max(list: number[]) {
  if (!list.length) return null;
  return Math.max(...list);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeGeocodingQuery(query: string) {
  return query
    .replace(/str\./gi, "straße")
    .replace(/strasse\b/gi, "straße")
    .replace(/\bDE[-\s]?(\d{5})\b/gi, "$1")
    .replace(/\s+/g, " ")
    .replace(/\b(Baustelle|Auftrag|Dachsanierung|Sanierung|Projekt)\b[:\-\s]*/gi, "")
    .trim();
}

export function parseCoordinatePair(value: string) {
  const match = value
    .trim()
    .match(/^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/);
  if (!match) return null;

  const lat = Number(match[1].replace(",", "."));
  const lng = Number(match[2].replace(",", "."));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export function geocodingQueries(query: string) {
  const normalized = normalizeGeocodingQuery(query);
  const coordinates = parseCoordinatePair(normalized);
  if (coordinates) return [normalized];

  const candidates = new Set<string>();
  if (normalized) candidates.add(normalized);
  if (normalized && !/deutschland|germany/i.test(normalized)) candidates.add(`${normalized}, Deutschland`);

  const postcodeMatch = normalized.match(/\b\d{5}\b\s*([^,]*)/);
  if (postcodeMatch?.[0]) candidates.add(postcodeMatch[0].trim());
  if (postcodeMatch?.[1]) candidates.add(postcodeMatch[1].trim());

  const commaParts = normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (commaParts.length > 1) candidates.add(commaParts[commaParts.length - 1]);

  const withoutStreetNumber = normalized.replace(/^[^,]*\b\d+[a-zA-Z]?\b,?\s*/u, "").trim();
  if (withoutStreetNumber && withoutStreetNumber !== normalized) candidates.add(withoutStreetNumber);

  return [...candidates].filter((candidate) => candidate.length >= 3).slice(0, 8);
}

function parseGermanAddress(query: string) {
  const normalized = normalizeGeocodingQuery(query);
  const fullMatch = normalized.match(/^(.+?\s+\d+[a-zA-Z]?)\s*,?\s*(\d{5})\s+(.+?)(?:,\s*(?:Deutschland|Germany))?$/i);
  if (fullMatch) {
    return {
      street: fullMatch[1].trim(),
      postalcode: fullMatch[2].trim(),
      city: fullMatch[3].trim()
    };
  }

  const commaParts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  if (commaParts.length >= 2) {
    const postcodeCity = commaParts.find((part) => /\b\d{5}\b/.test(part));
    const postcodeMatch = postcodeCity?.match(/\b(\d{5})\b\s*(.*)$/);
    return {
      street: commaParts[0],
      postalcode: postcodeMatch?.[1],
      city: postcodeMatch?.[2] || commaParts[1]
    };
  }

  return null;
}

function locationUserAgent() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `BauPro/0.1 (${appUrl})`;
}

async function geocodeWithNominatim(query: string): Promise<{
  lat: number;
  lng: number;
  label: string;
} | null> {
  const normalized = normalizeGeocodingQuery(query);
  const coordinates = parseCoordinatePair(normalized);
  if (coordinates) {
    return { ...coordinates, label: normalized };
  }

  const requests: URLSearchParams[] = [];
  const structured = parseGermanAddress(normalized);

  if (structured?.street || structured?.postalcode || structured?.city) {
    const params = new URLSearchParams({
      format: "jsonv2",
      limit: "3",
      addressdetails: "1",
      countrycodes: "de"
    });
    if (structured.street) params.set("street", structured.street);
    if (structured.postalcode) params.set("postalcode", structured.postalcode);
    if (structured.city) params.set("city", structured.city);
    params.set("country", "Deutschland");
    requests.push(params);
  }

  for (const candidate of geocodingQueries(normalized)) {
    requests.push(
      new URLSearchParams({
        q: candidate,
        format: "jsonv2",
        limit: "3",
        addressdetails: "1",
        countrycodes: "de"
      })
    );
  }

  for (const params of requests) {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: {
        "User-Agent": locationUserAgent(),
        Referer: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      },
      next: { revalidate: 60 * 60 * 24 * 7 }
    });

    if (!response.ok) continue;

    const results = (await response.json()) as NominatimResult[];
    const result =
      results.find((item) => item.address?.country_code?.toLowerCase() === "de" && item.lat && item.lon) ??
      results.find((item) => item.lat && item.lon);
    const lat = Number(result?.lat);
    const lng = Number(result?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    return {
      lat,
      lng,
      label: result?.display_name || normalized
    };
  }

  return null;
}

export function buildWeatherSummary({
  temperatureC,
  precipitationMm,
  windKmh
}: {
  temperatureC: number | null;
  precipitationMm: number | null;
  windKmh: number | null;
}) {
  const tempText = temperatureC === null ? null : `${Math.round(temperatureC)} °C`;
  const windText =
    windKmh === null ? null : windKmh >= 35 ? "windig" : windKmh >= 18 ? "leichter Wind" : "ruhiger Wind";
  const details = [tempText, windText].filter(Boolean).join(", ");
  const suffix = details ? `, ${details}` : "";

  if (precipitationMm !== null && precipitationMm >= 3) {
    return `Regen am Arbeitstag${suffix} - als Nachweis gespeichert.`;
  }

  if (precipitationMm !== null && precipitationMm > 0) {
    return `Leichter Regen${suffix} - Arbeiten dokumentiert.`;
  }

  if (windKmh !== null && windKmh >= 35) {
    return `Windig${suffix} - relevante Baustellenbedingung.`;
  }

  if (temperatureC !== null && temperatureC <= 5) {
    return `Kalt, aber trocken${suffix}.`;
  }

  return `Trocken${suffix} - gute Bedingungen fuer Dacharbeiten.`;
}

export function emptyWeatherSuggestion(reason = "Keine aktuellen Wetterdaten gefunden.") {
  return {
    ok: false as const,
    reason
  };
}

function endpointForDate(date: string) {
  return date < todayIso() ? "https://archive-api.open-meteo.com/v1/archive" : "https://api.open-meteo.com/v1/forecast";
}

export async function geocodeOpenMeteo(query: string): Promise<{
  lat: number;
  lng: number;
  label: string;
} | null> {
  for (const candidate of geocodingQueries(query)) {
    const params = new URLSearchParams({
      name: candidate,
      count: "1",
      language: "de",
      format: "json"
    });

    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) continue;

    const body = (await response.json()) as { results?: GeocodingResult[] };
    const result = body.results?.find((item) => typeof item.latitude === "number" && typeof item.longitude === "number");
    if (!result || typeof result.latitude !== "number" || typeof result.longitude !== "number") continue;

    const postcode = result.postcodes?.[0];
    const label = [result.name, postcode, result.admin1, result.country_code].filter(Boolean).join(", ");
    return {
      lat: result.latitude,
      lng: result.longitude,
      label: label || candidate
    };
  }

  return geocodeWithNominatim(query);
}

export async function fetchOpenMeteoWeather({
  lat,
  lng,
  date,
  locationLabel
}: {
  lat: number;
  lng: number;
  date: string;
  locationLabel?: string | null;
}): Promise<WeatherSuggestion | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !date) return null;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "temperature_2m,precipitation,wind_speed_10m",
    start_date: date,
    end_date: date,
    timezone: "auto"
  });

  const source = date < todayIso() ? `${WEATHER_PROVIDER_NAME} Historical` : `${WEATHER_PROVIDER_NAME} Forecast`;
  const response = await fetch(`${endpointForDate(date)}?${params.toString()}`, {
    next: { revalidate: 60 * 30 }
  });

  if (!response.ok) return null;

  const body = (await response.json()) as OpenMeteoResponse;
  const temperatureC = average(values(body.hourly?.temperature_2m));
  const precipitationMm = sum(values(body.hourly?.precipitation));
  const windKmh = max(values(body.hourly?.wind_speed_10m));

  if (temperatureC === null && precipitationMm === 0 && windKmh === null) return null;

  const normalizedTemperature = temperatureC === null ? null : round(temperatureC, 1);
  const normalizedPrecipitation = round(precipitationMm, 1);
  const normalizedWind = windKmh === null ? null : round(windKmh, 1);

  return {
    summary: buildWeatherSummary({
      temperatureC: normalizedTemperature,
      precipitationMm: normalizedPrecipitation,
      windKmh: normalizedWind
    }),
    temperatureC: normalizedTemperature,
    precipitationMm: normalizedPrecipitation,
    windKmh: normalizedWind,
    source,
    fetchedAt: new Date().toISOString(),
    lat: round(lat, 5),
    lng: round(lng, 5),
    locationLabel: locationLabel ?? null
  };
}
