import { timeEntryFormSelect, timeEntryLegacySelect } from "@/lib/data/selects";
import { postgrestTimeoutResponse, withQueryTimeout } from "@/lib/performance/observability";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import type { TimeEntry } from "@/types/app";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

type QueryResult<T = unknown> = {
  data: T | null;
  error: SupabaseErrorLike | null;
  count?: number | null;
};

const weatherColumnKeys = [
  "weather_summary",
  "weather_temperature_c",
  "weather_precipitation_mm",
  "weather_wind_kmh",
  "weather_source",
  "weather_fetched_at",
  "weather_lat",
  "weather_lng"
] as const;

function errorText(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const typed = error as SupabaseErrorLike;
  return [typed.code, typed.message, typed.details, typed.hint].filter(Boolean).join(" ");
}

export function isMissingTimeEntryWeatherSchema(error: unknown) {
  const text = errorText(error);
  return isMissingSchemaError(error) && weatherColumnKeys.some((column) => text.includes(column));
}

export function normalizeTimeEntryWeather<T extends Partial<TimeEntry>>(entry: T): T {
  return {
    ...entry,
    weather_summary: entry.weather_summary ?? entry.weather ?? null,
    weather_temperature_c: entry.weather_temperature_c ?? null,
    weather_precipitation_mm: entry.weather_precipitation_mm ?? null,
    weather_wind_kmh: entry.weather_wind_kmh ?? null,
    weather_source: entry.weather_source ?? null,
    weather_fetched_at: entry.weather_fetched_at ?? null,
    weather_lat: entry.weather_lat ?? null,
    weather_lng: entry.weather_lng ?? null
  };
}

export function normalizeTimeEntriesWeather<T extends Partial<TimeEntry>>(entries: T[] | null | undefined) {
  return (entries ?? []).map((entry) => normalizeTimeEntryWeather(entry));
}

export function stripTimeEntryWeatherPayload<T extends Record<string, unknown>>(payload: T) {
  const stripped = { ...payload };
  for (const key of weatherColumnKeys) delete stripped[key];
  return stripped;
}

export async function selectTimeEntriesWithWeatherFallback<T extends Partial<TimeEntry> = Partial<TimeEntry>>(
  run: (select: string) => PromiseLike<QueryResult>
) {
  const result = (await withQueryTimeout(() => run(timeEntryFormSelect), {
    route: "time-entries",
    action: "time_entries.select.form",
    timeoutMs: 4_000,
    fallback: () => postgrestTimeoutResponse("Timeout bei time_entries.select.form")
  })) as QueryResult<T[]>;
  if (!isMissingTimeEntryWeatherSchema(result.error)) {
    return {
      ...result,
      data: normalizeTimeEntriesWeather(result.data)
    };
  }

  const fallback = (await withQueryTimeout(() => run(timeEntryLegacySelect), {
    route: "time-entries",
    action: "time_entries.select.legacy",
    timeoutMs: 2_800,
    fallback: () => postgrestTimeoutResponse("Timeout bei time_entries.select.legacy")
  })) as QueryResult<T[]>;
  return {
    ...fallback,
    data: normalizeTimeEntriesWeather(fallback.data)
  };
}

export async function selectSingleTimeEntryWithWeatherFallback<T extends Partial<TimeEntry> = Partial<TimeEntry>>(
  run: (select: string) => PromiseLike<QueryResult>
) {
  const result = (await withQueryTimeout(() => run(timeEntryFormSelect), {
    route: "time-entries",
    action: "time_entry.single.form",
    timeoutMs: 4_000,
    fallback: () => postgrestTimeoutResponse("Timeout bei time_entry.single.form")
  })) as QueryResult<T>;
  if (!isMissingTimeEntryWeatherSchema(result.error)) {
    return {
      ...result,
      data: result.data ? normalizeTimeEntryWeather(result.data) : result.data
    };
  }

  const fallback = (await withQueryTimeout(() => run(timeEntryLegacySelect), {
    route: "time-entries",
    action: "time_entry.single.legacy",
    timeoutMs: 2_800,
    fallback: () => postgrestTimeoutResponse("Timeout bei time_entry.single.legacy")
  })) as QueryResult<T>;
  return {
    ...fallback,
    data: fallback.data ? normalizeTimeEntryWeather(fallback.data) : fallback.data
  };
}

export async function timeEntryWeatherColumnsAvailable(
  supabase: {
    from: (table: "time_entries") => {
      select: (columns: string) => {
        limit: (count: number) => PromiseLike<QueryResult<unknown[]>>;
      };
    };
  }
) {
  const { error } = await withQueryTimeout(() => supabase.from("time_entries").select("weather_summary").limit(0), {
    route: "time-entries",
    action: "time_entries.columns.weather",
    timeoutMs: 1_200,
    fallback: () => postgrestTimeoutResponse("Timeout bei time_entries.columns.weather")
  });
  return !isMissingTimeEntryWeatherSchema(error);
}

export async function timeEntryWriteOptions(
  supabase: Parameters<typeof timeEntryWeatherColumnsAvailable>[0],
  payload: Record<string, unknown>
) {
  const hasWeatherColumns = await timeEntryWeatherColumnsAvailable(supabase);
  return {
    payload: hasWeatherColumns ? payload : stripTimeEntryWeatherPayload(payload),
    select: hasWeatherColumns ? timeEntryFormSelect : timeEntryLegacySelect
  };
}
