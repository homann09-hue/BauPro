import { planningWeatherCheckSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PlanningAssignment, PlanningWeatherCheck, PlanningWeatherRiskLevel } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type PlanningWeatherRuleCode = "rain" | "strong_wind" | "frost" | "thunderstorm" | "heat";

export type PlanningWeatherRisk = {
  assignmentId: string;
  checkId: string | null;
  riskLevel: PlanningWeatherRiskLevel;
  summary: string;
  ruleCodes: PlanningWeatherRuleCode[];
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  precipitationMm: number | null;
  precipitationProbability: number | null;
  windKmh: number | null;
  windGustKmh: number | null;
  weatherCode: number | null;
  source: string;
  fetchedAt: string | null;
  acknowledgedAction: "confirmed" | "ignored" | null;
  acknowledgedAt: string | null;
  acknowledgmentNote: string | null;
  missingLocation?: boolean;
};

type OpenMeteoPlanningResponse = {
  hourly?: {
    time?: string[];
    temperature_2m?: Array<number | null>;
    precipitation?: Array<number | null>;
    precipitation_probability?: Array<number | null>;
    wind_speed_10m?: Array<number | null>;
    wind_gusts_10m?: Array<number | null>;
    weather_code?: Array<number | null>;
  };
};

type ForecastMetrics = {
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  precipitationMm: number | null;
  precipitationProbability: number | null;
  windKmh: number | null;
  windGustKmh: number | null;
  weatherCode: number | null;
};

const cacheTtlMs = 1000 * 60 * 60 * 2;
const weatherFetchTimeoutMs = 3500;
const thunderstormCodes = new Set([95, 96, 99]);
const rainCodes = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82]);
const snowOrIceCodes = new Set([71, 73, 75, 77, 85, 86]);

export const planningWeatherRiskLabels: Record<PlanningWeatherRiskLevel, string> = {
  green: "Unkritisch",
  yellow: "Pruefen",
  red: "Wahrscheinlich verschieben"
};

export const planningWeatherRuleLabels: Record<PlanningWeatherRuleCode, string> = {
  rain: "Regen",
  strong_wind: "Starker Wind",
  frost: "Frost",
  thunderstorm: "Gewitter",
  heat: "Hitze"
};

function numberList(values?: Array<number | null>) {
  return (values ?? []).filter((value): value is number => typeof value === "number" && Number.isFinite(value));
}

function max(values?: Array<number | null>) {
  const numbers = numberList(values);
  return numbers.length ? Math.max(...numbers) : null;
}

function min(values?: Array<number | null>) {
  const numbers = numberList(values);
  return numbers.length ? Math.min(...numbers) : null;
}

function sum(values?: Array<number | null>) {
  const numbers = numberList(values);
  if (!numbers.length) return null;
  return numbers.reduce((total, value) => total + value, 0);
}

function round(value: number | null, digits = 1) {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function weatherCodeSeverity(code: number | null) {
  if (code === null) return 0;
  if (thunderstormCodes.has(code)) return 5;
  if (snowOrIceCodes.has(code)) return 4;
  if ([65, 66, 67, 81, 82].includes(code)) return 3;
  if (rainCodes.has(code)) return 2;
  return 1;
}

function worstWeatherCode(values?: Array<number | null>) {
  const codes = numberList(values).map((value) => Math.round(value));
  if (!codes.length) return null;
  return codes.sort((left, right) => weatherCodeSeverity(right) - weatherCodeSeverity(left))[0] ?? null;
}

function ruleCodesFromMetrics(metrics: ForecastMetrics): PlanningWeatherRuleCode[] {
  const rules = new Set<PlanningWeatherRuleCode>();

  if (metrics.weatherCode !== null && thunderstormCodes.has(metrics.weatherCode)) rules.add("thunderstorm");
  if ((metrics.windGustKmh ?? metrics.windKmh ?? 0) >= 45 || (metrics.windKmh ?? 0) >= 30) rules.add("strong_wind");
  if ((metrics.precipitationMm ?? 0) > 0.2 || (metrics.precipitationProbability ?? 0) >= 45 || (metrics.weatherCode !== null && rainCodes.has(metrics.weatherCode))) {
    rules.add("rain");
  }
  if ((metrics.temperatureMinC ?? 99) <= 2 || (metrics.weatherCode !== null && snowOrIceCodes.has(metrics.weatherCode))) rules.add("frost");
  if ((metrics.temperatureMaxC ?? -99) >= 30) rules.add("heat");

  return [...rules];
}

export function evaluatePlanningWeatherRisk(metrics: ForecastMetrics): {
  riskLevel: PlanningWeatherRiskLevel;
  summary: string;
  ruleCodes: PlanningWeatherRuleCode[];
} {
  const ruleCodes = ruleCodesFromMetrics(metrics);
  const thunderstorm = ruleCodes.includes("thunderstorm");
  const wind = metrics.windKmh ?? 0;
  const gust = metrics.windGustKmh ?? wind;
  const precipitation = metrics.precipitationMm ?? 0;
  const probability = metrics.precipitationProbability ?? 0;
  const minTemperature = metrics.temperatureMinC ?? 99;
  const maxTemperature = metrics.temperatureMaxC ?? -99;

  let riskLevel: PlanningWeatherRiskLevel = "green";
  if (thunderstorm || gust >= 60 || wind >= 50 || precipitation >= 5 || probability >= 85 || minTemperature <= -3 || maxTemperature >= 35) {
    riskLevel = "red";
  } else if (ruleCodes.length > 0) {
    riskLevel = "yellow";
  }

  if (riskLevel === "red") {
    if (thunderstorm) return { riskLevel, ruleCodes, summary: "Gewitterrisiko - Dacharbeiten wahrscheinlich verschieben." };
    if (gust >= 60 || wind >= 50) return { riskLevel, ruleCodes, summary: "Starker Wind - Arbeiten am Dach wahrscheinlich verschieben." };
    if (precipitation >= 5 || probability >= 85) return { riskLevel, ruleCodes, summary: "Regen/Starkregen - Material sichern und Arbeit wahrscheinlich verschieben." };
    if (minTemperature <= -3) return { riskLevel, ruleCodes, summary: "Frost - Abdichtung, Kleben und sichere Begehung kritisch pruefen." };
    return { riskLevel, ruleCodes, summary: "Hitze - Team, Pausen und Materialverarbeitung kritisch pruefen." };
  }

  if (riskLevel === "yellow") {
    if (ruleCodes.includes("strong_wind")) return { riskLevel, ruleCodes, summary: "Windig - Dacharbeiten und Sicherung vor Start pruefen." };
    if (ruleCodes.includes("rain")) return { riskLevel, ruleCodes, summary: "Regen moeglich - Folien, Material und Tagesbericht im Blick behalten." };
    if (ruleCodes.includes("frost")) return { riskLevel, ruleCodes, summary: "Frost/Kälte - Abdichtung und Rutschgefahr vor Ort pruefen." };
    if (ruleCodes.includes("heat")) return { riskLevel, ruleCodes, summary: "Heiss - Pausen, Trinken und Materialverarbeitung einplanen." };
    return { riskLevel, ruleCodes, summary: "Wetterlage pruefen, bevor das Team startet." };
  }

  return { riskLevel, ruleCodes, summary: "Unkritisch - Wetter spricht aktuell nicht gegen die Planung." };
}

export async function fetchPlanningWeatherForecast({
  lat,
  lng,
  startDate,
  endDate
}: {
  lat: number;
  lng: number;
  startDate: string;
  endDate: string;
}): Promise<(ForecastMetrics & { source: string; fetchedAt: string }) | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    hourly: "temperature_2m,precipitation,precipitation_probability,wind_speed_10m,wind_gusts_10m,weather_code",
    start_date: startDate,
    end_date: endDate,
    timezone: "auto"
  });
  const apiKey = process.env.OPEN_METEO_API_KEY;
  if (apiKey) params.set("apikey", apiKey);

  const signal = typeof AbortSignal !== "undefined" && "timeout" in AbortSignal ? AbortSignal.timeout(weatherFetchTimeoutMs) : undefined;
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
    next: { revalidate: 60 * 60 },
    signal
  });
  if (!response.ok) return null;

  const body = (await response.json()) as OpenMeteoPlanningResponse;
  const hourly = body.hourly ?? {};

  return {
    temperatureMinC: round(min(hourly.temperature_2m)),
    temperatureMaxC: round(max(hourly.temperature_2m)),
    precipitationMm: round(sum(hourly.precipitation)),
    precipitationProbability: round(max(hourly.precipitation_probability), 0),
    windKmh: round(max(hourly.wind_speed_10m)),
    windGustKmh: round(max(hourly.wind_gusts_10m)),
    weatherCode: worstWeatherCode(hourly.weather_code),
    source: "Open-Meteo Forecast",
    fetchedAt: new Date().toISOString()
  };
}

function checkToRisk(check: PlanningWeatherCheck): PlanningWeatherRisk {
  return {
    assignmentId: check.planning_assignment_id,
    checkId: check.id,
    riskLevel: check.risk_level,
    summary: check.summary,
    ruleCodes: check.rule_codes.filter((code): code is PlanningWeatherRuleCode =>
      ["rain", "strong_wind", "frost", "thunderstorm", "heat"].includes(code)
    ),
    temperatureMinC: check.temperature_min_c,
    temperatureMaxC: check.temperature_max_c,
    precipitationMm: check.precipitation_mm,
    precipitationProbability: check.precipitation_probability,
    windKmh: check.wind_kmh,
    windGustKmh: check.wind_gust_kmh,
    weatherCode: check.weather_code,
    source: check.source,
    fetchedAt: check.fetched_at,
    acknowledgedAction: check.acknowledged_action,
    acknowledgedAt: check.acknowledged_at,
    acknowledgmentNote: check.acknowledgment_note
  };
}

function freshEnough(check: PlanningWeatherCheck, assignment: Pick<PlanningAssignment, "start_date" | "end_date">) {
  if (check.period_start !== assignment.start_date || check.period_end !== assignment.end_date) return false;
  return Date.now() - new Date(check.fetched_at).getTime() < cacheTtlMs;
}

function missingLocationRisk(assignmentId: string): PlanningWeatherRisk {
  return {
    assignmentId,
    checkId: null,
    riskLevel: "yellow",
    summary: "Baustellenkoordinaten fehlen - Wetterrisiko kann noch nicht automatisch bewertet werden.",
    ruleCodes: [],
    temperatureMinC: null,
    temperatureMaxC: null,
    precipitationMm: null,
    precipitationProbability: null,
    windKmh: null,
    windGustKmh: null,
    weatherCode: null,
    source: "BauPro",
    fetchedAt: null,
    acknowledgedAction: null,
    acknowledgedAt: null,
    acknowledgmentNote: null,
    missingLocation: true
  };
}

function resolveJobsiteLocation(assignment: PlanningAssignment) {
  const jobsite = assignment.jobsites;
  const lat = typeof jobsite?.latitude === "number" ? jobsite.latitude : null;
  const lng = typeof jobsite?.longitude === "number" ? jobsite.longitude : null;
  if (lat !== null && lng !== null && Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  return null;
}

export async function loadPlanningWeatherRisks({
  supabase,
  companyId,
  assignments
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  assignments: PlanningAssignment[];
}): Promise<{ risks: Record<string, PlanningWeatherRisk>; error: string | null }> {
  const scopedAssignments = assignments.filter((assignment) => assignment.jobsite_id && assignment.jobsites);
  if (scopedAssignments.length === 0) return { risks: {}, error: null };

  const assignmentIds = scopedAssignments.map((assignment) => assignment.id);
  const checksResult = await supabase
    .from("planning_weather_checks")
    .select(planningWeatherCheckSelect)
    .eq("company_id", companyId)
    .in("planning_assignment_id", assignmentIds);

  if (checksResult.error) {
    return {
      risks: {},
      error:
        safeQueryErrorMessage(checksResult.error) ||
        "Datenbank-Update fehlt: Bitte `supabase/migrations/20260629_planning_weather_risks.sql` ausfuehren."
    };
  }

  const checks = ((checksResult.data ?? []) as unknown) as PlanningWeatherCheck[];
  const checksByAssignment = new Map(checks.map((check) => [check.planning_assignment_id, check]));
  const risks: Record<string, PlanningWeatherRisk> = {};

  await Promise.all(
    scopedAssignments.map(async (assignment) => {
      const cached = checksByAssignment.get(assignment.id);
      if (cached && freshEnough(cached, assignment)) {
        risks[assignment.id] = checkToRisk(cached);
        return;
      }

      const location = resolveJobsiteLocation(assignment);
      if (!location) {
        risks[assignment.id] = missingLocationRisk(assignment.id);
        return;
      }

      const forecast = await fetchPlanningWeatherForecast({
        lat: location.lat,
        lng: location.lng,
        startDate: assignment.start_date,
        endDate: assignment.end_date
      }).catch(() => null);

      if (!forecast) {
        risks[assignment.id] = {
          ...missingLocationRisk(assignment.id),
          summary: "Wetterdaten konnten gerade nicht abgerufen werden - bitte spaeter erneut pruefen.",
          missingLocation: false
        };
        return;
      }

      const evaluation = evaluatePlanningWeatherRisk(forecast);
      const preserveAcknowledgement =
        cached &&
        cached.period_start === assignment.start_date &&
        cached.period_end === assignment.end_date &&
        cached.risk_level === evaluation.riskLevel &&
        cached.summary === evaluation.summary;
      const upsertPayload = {
        company_id: companyId,
        planning_assignment_id: assignment.id,
        jobsite_id: assignment.jobsite_id as string,
        period_start: assignment.start_date,
        period_end: assignment.end_date,
        risk_level: evaluation.riskLevel,
        summary: evaluation.summary,
        rule_codes: evaluation.ruleCodes,
        temperature_min_c: forecast.temperatureMinC,
        temperature_max_c: forecast.temperatureMaxC,
        precipitation_mm: forecast.precipitationMm,
        precipitation_probability: forecast.precipitationProbability,
        wind_kmh: forecast.windKmh,
        wind_gust_kmh: forecast.windGustKmh,
        weather_code: forecast.weatherCode,
        source: forecast.source,
        fetched_at: forecast.fetchedAt,
        acknowledged_action: preserveAcknowledgement ? cached.acknowledged_action : null,
        acknowledged_by: preserveAcknowledgement ? cached.acknowledged_by : null,
        acknowledged_at: preserveAcknowledgement ? cached.acknowledged_at : null,
        acknowledgment_note: preserveAcknowledgement ? cached.acknowledgment_note : null
      };

      const upsertResult = await supabase
        .from("planning_weather_checks")
        .upsert(upsertPayload, { onConflict: "planning_assignment_id" })
        .select(planningWeatherCheckSelect)
        .maybeSingle();

      if (upsertResult.error || !upsertResult.data) {
        risks[assignment.id] = {
          ...missingLocationRisk(assignment.id),
          summary: "Wetterwarnung konnte nicht gespeichert werden. Ist die Wetter-Plantafel-Migration eingespielt?",
          missingLocation: false
        };
        return;
      }

      risks[assignment.id] = checkToRisk((upsertResult.data as unknown) as PlanningWeatherCheck);
    })
  );

  return { risks, error: null };
}
