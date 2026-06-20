import type { Jobsite, Order, Report, TimeEntry } from "@/types/app";

export type WeatherRiskLevel = "green" | "yellow" | "red";

export type WeatherActiveJobsite = Pick<
  Jobsite,
  "id" | "name" | "address" | "customer" | "start_date" | "status" | "assigned_employee_ids"
> & {
  latitude?: number | null;
  longitude?: number | null;
  weather_last_checked_at?: string | null;
};

export type WeatherScoringOrder = Pick<Order, "id" | "jobsite_id" | "status" | "priority" | "start_date" | "end_date">;
export type WeatherScoringTimeEntry = Pick<TimeEntry, "id" | "job_id" | "status" | "date">;
export type WeatherScoringReport = Pick<Report, "id" | "jobsite_id" | "report_date">;

export type ActiveJobsiteDecision = {
  jobsite: WeatherActiveJobsite | null;
  score: number;
  reasons: string[];
};

export type LiveWeatherData = {
  temperatureC: number | null;
  precipitationMm: number | null;
  precipitationProbability: number | null;
  windKmh: number | null;
  weatherCode: number | null;
  weatherLabel: string;
  riskLevel: WeatherRiskLevel;
  summary: string;
  fetchedAt: string;
  source: string;
};

export type RadarFrame = {
  label: "Jetzt" | "+30 Min" | "+60 Min";
  time: number | null;
  path: string | null;
  source: string;
};

export type RadarTile = {
  baseUrl: string;
  radarUrl: string | null;
  x: number;
  y: number;
};

export type RadarTileSet = {
  zoom: number;
  centerTile: { x: number; y: number };
  tiles: RadarTile[];
};

type OpenMeteoLiveResponse = {
  current?: {
    time?: string;
    temperature_2m?: number | null;
    precipitation?: number | null;
    rain?: number | null;
    showers?: number | null;
    weather_code?: number | null;
    wind_speed_10m?: number | null;
    wind_gusts_10m?: number | null;
  };
  hourly?: {
    time?: string[];
    precipitation?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
};

type RainViewerFrame = {
  time?: number;
  path?: string;
};

type RainViewerResponse = {
  host?: string;
  radar?: {
    past?: RainViewerFrame[];
    nowcast?: RainViewerFrame[];
  };
};

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function max(values: Array<number | null | undefined>) {
  const numbers = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return numbers.length ? Math.max(...numbers) : null;
}

function weatherCodeLabel(code: number | null) {
  if (code === null) return "Wetterlage unbekannt";
  if (code === 0) return "Klar";
  if ([1, 2, 3].includes(code)) return "Bewoelkt";
  if ([45, 48].includes(code)) return "Nebel";
  if ([51, 53, 55, 56, 57].includes(code)) return "Nieselregen";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Regen";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Schnee";
  if ([95, 96, 99].includes(code)) return "Gewitter";
  return "Wechselhaft";
}

export function calculateWeatherRisk({
  precipitationMm,
  precipitationProbability,
  windKmh,
  weatherCode
}: {
  precipitationMm: number | null;
  precipitationProbability: number | null;
  windKmh: number | null;
  weatherCode: number | null;
}): WeatherRiskLevel {
  if (
    (precipitationMm !== null && precipitationMm >= 3) ||
    (precipitationProbability !== null && precipitationProbability >= 80) ||
    (windKmh !== null && windKmh >= 50) ||
    (weatherCode !== null && [95, 96, 99].includes(weatherCode))
  ) {
    return "red";
  }

  if (
    (precipitationMm !== null && precipitationMm > 0.2) ||
    (precipitationProbability !== null && precipitationProbability >= 45) ||
    (windKmh !== null && windKmh >= 30) ||
    (weatherCode !== null && [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weatherCode))
  ) {
    return "yellow";
  }

  return "green";
}

export function buildLiveWeatherSummary({
  riskLevel,
  precipitationMm,
  precipitationProbability,
  windKmh
}: {
  riskLevel: WeatherRiskLevel;
  precipitationMm: number | null;
  precipitationProbability: number | null;
  windKmh: number | null;
}) {
  if (riskLevel === "red") {
    if (windKmh !== null && windKmh >= 50) return "Starker Wind - Dacharbeiten und Sicherung pruefen.";
    return "Starker Regen moeglich - Material sichern und Tagesbericht sauber dokumentieren.";
  }

  if (riskLevel === "yellow") {
    if (windKmh !== null && windKmh >= 30) return "Windig - Arbeiten am Dach pruefen.";
    if ((precipitationMm ?? 0) > 0.2) return "Regen zieht rein - Material/Folien sichern.";
    if ((precipitationProbability ?? 0) >= 45) return "Aktuell ruhig, aber spaeter Niederschlag moeglich.";
    return "Aufpassen - Wetterlage im Blick behalten.";
  }

  return "Trocken - gute Bedingungen.";
}

export function selectActiveWeatherJobsite({
  jobsites,
  orders,
  timeEntries,
  reports,
  todayIso
}: {
  jobsites: WeatherActiveJobsite[];
  orders: WeatherScoringOrder[];
  timeEntries: WeatherScoringTimeEntry[];
  reports: WeatherScoringReport[];
  todayIso: string;
}): ActiveJobsiteDecision {
  if (jobsites.length === 0) return { jobsite: null, score: 0, reasons: [] };

  const todayReports = new Set(reports.filter((report) => report.report_date === todayIso).map((report) => report.jobsite_id).filter(Boolean));
  const todayTimeCounts = new Map<string, number>();
  timeEntries
    .filter((entry) => entry.date === todayIso)
    .forEach((entry) => {
      todayTimeCounts.set(entry.job_id, (todayTimeCounts.get(entry.job_id) ?? 0) + 1);
    });

  const decisions = jobsites.map((jobsite) => {
    let score = 0;
    const reasons: string[] = [];
    const assignedCount = jobsite.assigned_employee_ids?.length ?? 0;
    const jobOrders = orders.filter((order) => order.jobsite_id === jobsite.id);

    if (jobsite.start_date === todayIso) {
      score += 60;
      reasons.push("heutiger Start");
    }
    if (jobsite.status === "aktiv") {
      score += 40;
      reasons.push("aktive Baustelle");
    }
    if (assignedCount > 0) {
      score += Math.min(assignedCount * 8, 32);
      reasons.push(`${assignedCount} zugewiesene Mitarbeiter`);
    }

    const todayTimes = todayTimeCounts.get(jobsite.id) ?? 0;
    if (todayTimes > 0) {
      score += Math.min(todayTimes * 10, 40);
      reasons.push("heute Zeiten erfasst");
    }

    if (!todayReports.has(jobsite.id) && (todayTimes > 0 || jobsite.status === "aktiv")) {
      score += 12;
      reasons.push("Tagesbericht offen");
    }

    for (const order of jobOrders) {
      if (order.priority === "hoch") {
        score += 35;
        reasons.push("Prioritaet hoch");
      }
      if (order.status === "in_arbeit") {
        score += 30;
        reasons.push("laufender Auftrag");
      }
      if (order.start_date === todayIso) {
        score += 20;
        reasons.push("Auftrag startet heute");
      }
    }

    if (jobsite.start_date && jobsite.start_date > todayIso) {
      score += 4;
      reasons.push("naechste aktive Baustelle");
    }

    return { jobsite, score, reasons };
  });

  decisions.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return String(left.jobsite.start_date ?? "9999-12-31").localeCompare(String(right.jobsite.start_date ?? "9999-12-31"));
  });

  return decisions[0];
}

export async function fetchLiveWeather({
  lat,
  lng
}: {
  lat: number;
  lng: number;
}): Promise<LiveWeatherData | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: "temperature_2m,precipitation,rain,showers,weather_code,wind_speed_10m,wind_gusts_10m",
    hourly: "precipitation,precipitation_probability,wind_speed_10m,weather_code",
    forecast_days: "1",
    timezone: "auto"
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    next: { revalidate: 60 * 10 }
  });
  if (!response.ok) return null;

  const body = (await response.json()) as OpenMeteoLiveResponse;
  const current = body.current ?? {};
  const precipitationMm = finiteNumber(current.precipitation) ?? finiteNumber(current.rain) ?? finiteNumber(current.showers);
  const precipitationProbability = max((body.hourly?.precipitation_probability ?? []).slice(0, 3));
  const weatherCode = finiteNumber(current.weather_code) ?? finiteNumber(body.hourly?.weather_code?.[0]);
  const windKmh = finiteNumber(current.wind_speed_10m) ?? finiteNumber(body.hourly?.wind_speed_10m?.[0]);
  const riskLevel = calculateWeatherRisk({ precipitationMm, precipitationProbability, windKmh, weatherCode });

  return {
    temperatureC: finiteNumber(current.temperature_2m) === null ? null : round(finiteNumber(current.temperature_2m) as number),
    precipitationMm: precipitationMm === null ? null : round(precipitationMm),
    precipitationProbability,
    windKmh: windKmh === null ? null : round(windKmh),
    weatherCode,
    weatherLabel: weatherCodeLabel(weatherCode),
    riskLevel,
    summary: buildLiveWeatherSummary({ riskLevel, precipitationMm, precipitationProbability, windKmh }),
    fetchedAt: current.time ? new Date(current.time).toISOString() : new Date().toISOString(),
    source: "Open-Meteo Forecast"
  };
}

export async function fetchRainViewerFrames(): Promise<RadarFrame[]> {
  const response = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
    next: { revalidate: 60 * 10 }
  });
  if (!response.ok) return [];

  const body = (await response.json()) as RainViewerResponse;
  const host = body.host ?? "https://tilecache.rainviewer.com";
  const past = body.radar?.past ?? [];
  const nowcast = body.radar?.nowcast ?? [];
  const latestPast = past[past.length - 1];

  const frameFor = (label: RadarFrame["label"], index: number): RadarFrame => {
    const frame = nowcast[index] ?? latestPast;
    return {
      label,
      time: frame?.time ?? null,
      path: frame?.path ? `${host}${frame.path}` : null,
      source: "RainViewer"
    };
  };

  return [frameFor("Jetzt", 0), frameFor("+30 Min", 3), frameFor("+60 Min", 6)];
}

export function tileForLatLng(lat: number, lng: number, zoom: number) {
  const latRad = (lat * Math.PI) / 180;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y };
}

export function buildRadarTileSet({
  lat,
  lng,
  frame,
  zoom = 7
}: {
  lat: number;
  lng: number;
  frame: RadarFrame | null;
  zoom?: number;
}): RadarTileSet {
  const centerTile = tileForLatLng(lat, lng, zoom);
  const tiles: RadarTile[] = [];

  for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
    for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
      const x = centerTile.x + xOffset;
      const y = centerTile.y + yOffset;
      tiles.push({
        x,
        y,
        baseUrl: `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`,
        radarUrl: frame?.path ? `${frame.path}/256/${zoom}/${x}/${y}/2/1_1.png` : null
      });
    }
  }

  return { zoom, centerTile, tiles };
}

export function rainViewerMapUrl(lat: number, lng: number) {
  const params = new URLSearchParams({
    loc: `${lat},${lng},7`,
    layer: "radar",
    sm: "1",
    sn: "1"
  });
  return `https://www.rainviewer.com/map.html?${params.toString()}`;
}
