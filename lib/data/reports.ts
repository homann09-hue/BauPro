import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { postgrestTimeoutResponse, withQueryTimeout } from "@/lib/performance/observability";
import { pageParam, pageRange, searchOrFilter, stringParam, totalPages, type SearchParamsRecord } from "@/lib/data/shared";
import { reportFormSelect } from "@/lib/data/selects";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import type { Report } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const reportPageSize = 12;
export type ReportRangeFilter = "alle" | "today" | "week" | "month";
export const reportRangeFilters: Array<{ value: ReportRangeFilter; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "today", label: "Heute" },
  { value: "week", label: "Woche" },
  { value: "month", label: "Monat" }
];

const reportSelect =
  `${reportFormSelect}, jobsites(id, name, customer, address)`;
const legacyReportSelect =
  "id, company_id, jobsite_id, report_date, weather, work_start, work_end, employee_ids, activities, material_usage, issues, signature_name, created_by, created_at, jobsites(id, name, customer, address)";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function errorText(error: unknown) {
  if (!error || typeof error !== "object") return "";
  const typed = error as SupabaseErrorLike;
  return [typed.code, typed.message, typed.details, typed.hint].filter(Boolean).join(" ");
}

function isMissingReportEnhancedSchema(error: unknown) {
  const text = errorText(error);
  return (
    isMissingSchemaError(error) &&
    (text.includes("weather_summary") ||
      text.includes("weather_temperature_c") ||
      text.includes("weather_precipitation_mm") ||
      text.includes("weather_wind_kmh") ||
      text.includes("weather_source") ||
      text.includes("weather_fetched_at") ||
      text.includes("weather_lat") ||
      text.includes("weather_lng") ||
      text.includes("machine_usage") ||
      text.includes("vehicle_ids") ||
      text.includes("linked_time_entry_ids") ||
      text.includes("report_status") ||
      text.includes("submitted_at") ||
      text.includes("reviewed_by") ||
      text.includes("reviewed_at") ||
      text.includes("approved_by") ||
      text.includes("approved_at"))
  );
}

async function reportEnhancedColumnsAvailable(supabase: SupabaseServerClient) {
  const { error } = await withQueryTimeout(
    () => supabase.from("reports").select("weather_summary, report_status, vehicle_ids").limit(0),
    {
      route: "berichte",
      action: "reports.schema-check",
      timeoutMs: 1_200,
      fallback: () => postgrestTimeoutResponse("Timeout bei reports.schema-check")
    }
  );
  return !isMissingReportEnhancedSchema(error);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function reportRangeStart(range: ReportRangeFilter, now = new Date()) {
  if (range === "alle") return null;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (range === "today") return isoDate(start);
  if (range === "week") {
    const day = start.getDay() || 7;
    start.setDate(start.getDate() - day + 1);
    return isoDate(start);
  }
  start.setDate(1);
  return isoDate(start);
}

export function parseReportListParams(params: SearchParamsRecord) {
  const rawRange = stringParam(params, "range");
  const selectedRange: ReportRangeFilter = rawRange === "today" || rawRange === "week" || rawRange === "month" ? rawRange : "alle";
  const page = pageParam(params);
  const { from, to } = pageRange(page, reportPageSize);

  return {
    search: stringParam(params, "q").slice(0, 80),
    selectedRange,
    page,
    from,
    to
  };
}

export function reportHref({ q, range, page }: { q?: string; range?: ReportRangeFilter; page?: number }) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (range && range !== "alle") params.set("range", range);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/berichte?${query}` : "/berichte";
}

export async function loadReportList({
  supabase,
  companyId,
  userId,
  canManage,
  params
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  userId: string;
  canManage: boolean;
  params: SearchParamsRecord;
}) {
  const parsed = parseReportListParams(params);
  const weekStart = reportRangeStart("week") as string;
  const filterStart = reportRangeStart(parsed.selectedRange);
  const hasEnhancedColumns = await reportEnhancedColumnsAvailable(supabase);
  const select: string = hasEnhancedColumns ? reportSelect : legacyReportSelect;
  let reportsQuery = supabase
    .from("reports")
    .select(select, { count: "exact" })
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("report_date", { ascending: false })
    .range(parsed.from, parsed.to);

  if (!canManage) reportsQuery = reportsQuery.eq("created_by", userId);
  if (filterStart) reportsQuery = reportsQuery.gte("report_date", filterStart);
  if (parsed.search) {
    const fields = ["activities", "material_usage", "issues", "weather"];
    if (hasEnhancedColumns) fields.push("weather_summary");
    reportsQuery = reportsQuery.or(searchOrFilter(fields, parsed.search));
  }

  let totalCountQuery = supabase.from("reports").select("id", { count: "exact", head: true }).eq("company_id", companyId).is("archived_at", null);
  let weekCountQuery = supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("archived_at", null)
    .gte("report_date", weekStart);
  let weatherCountQuery = supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("archived_at", null);
  let submittedCountQuery = supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("archived_at", null)
    .eq("report_status", "submitted");
  let approvedCountQuery = supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .is("archived_at", null)
    .eq("report_status", "approved");

  if (hasEnhancedColumns) weatherCountQuery = weatherCountQuery.not("weather_summary", "is", null);

  if (!canManage) {
    totalCountQuery = totalCountQuery.eq("created_by", userId);
    weekCountQuery = weekCountQuery.eq("created_by", userId);
    weatherCountQuery = weatherCountQuery.eq("created_by", userId);
    submittedCountQuery = submittedCountQuery.eq("created_by", userId);
    approvedCountQuery = approvedCountQuery.eq("created_by", userId);
  }

  const reportsPagePromise = withQueryTimeout(() => reportsQuery, {
    route: "berichte",
    action: "reports.page",
    timeoutMs: 4_700,
    fallback: () => postgrestTimeoutResponse("Timeout bei reports.page")
  });

  const [reportsResult, totalCountResult, weekCountResult, weatherCountResult, submittedCountResult, approvedCountResult] = await Promise.all([
    reportsPagePromise,
    withQueryTimeout(() => totalCountQuery, {
      route: "berichte",
      action: "berichte.count.total",
      timeoutMs: 2_000,
      fallback: () => postgrestTimeoutResponse("Timeout bei reports.count.total")
    }),
    withQueryTimeout(() => weekCountQuery, {
      route: "berichte",
      action: "berichte.count.week",
      timeoutMs: 2_000,
      fallback: () => postgrestTimeoutResponse("Timeout bei reports.count.week")
    }),
    hasEnhancedColumns
      ? withQueryTimeout(() => weatherCountQuery, {
          route: "berichte",
          action: "berichte.count.weather",
          timeoutMs: 2_000,
          fallback: () => postgrestTimeoutResponse("Timeout bei reports.count.weather")
        })
      : Promise.resolve({ count: 0, error: null }),
    hasEnhancedColumns
      ? withQueryTimeout(() => submittedCountQuery, {
          route: "berichte",
          action: "berichte.count.submitted",
          timeoutMs: 2_000,
          fallback: () => postgrestTimeoutResponse("Timeout bei reports.count.submitted")
        })
      : Promise.resolve({ count: 0, error: null }),
    hasEnhancedColumns
      ? withQueryTimeout(() => approvedCountQuery, {
          route: "berichte",
          action: "berichte.count.approved",
          timeoutMs: 2_000,
          fallback: () => postgrestTimeoutResponse("Timeout bei reports.count.approved")
        })
      : Promise.resolve({ count: 0, error: null })
  ]);

  const reports = (reportsResult.data ?? []) as unknown as Report[];
  const totalCount = reportsResult.count ?? reports.length;

  return {
    ...parsed,
    reports,
    totalCount,
    totalPages: totalPages(totalCount, reportPageSize),
    error: reportsResult.error,
    counts: {
      all: totalCountResult.count ?? 0,
      week: weekCountResult.count ?? 0,
      weather: weatherCountResult.count ?? 0,
      submitted: submittedCountResult.count ?? 0,
      approved: approvedCountResult.count ?? 0
    }
  };
}
