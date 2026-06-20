import { revalidateTag, unstable_cache } from "next/cache";
import type { AppContext } from "@/lib/auth";
import { loadBringListMaterialStatus, tomorrowIsoDate, type BringListMaterialStatus } from "@/lib/inventory/material-intelligence";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchLiveWeather, fetchRainViewerFrames, selectActiveWeatherJobsite } from "@/lib/weather/live-weather";
import type { Jobsite, MaterialAlert, Order, Profile, PurchaseSuggestion, Report, Task, TimeEntry } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type SupabaseErrorLike = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

type CountList<T> = {
  count: number;
  list: T[];
};

export type DashboardSummary = {
  jobsitesActive: CountList<Jobsite>;
  reportsLatest: CountList<Report>;
  tasksOpen: CountList<Task>;
  todayTimeEntries: CountList<Pick<TimeEntry, "id" | "company_id" | "employee_id" | "job_id" | "date" | "status" | "net_minutes">> & {
    netMinutes: number;
  };
  employeesActive: CountList<Profile>;
  lowStockCount: number;
  openAlertsCount: number;
  materialAlertsOpen: CountList<MaterialAlert>;
  openSuggestionsCount: number;
  purchaseSuggestionsOpen: CountList<PurchaseSuggestion>;
  bringListsUpcomingCount: number;
  weatherJobsites: Jobsite[];
  weatherOrders: Array<Pick<Order, "id" | "jobsite_id" | "status" | "priority" | "start_date" | "end_date">>;
  todayReportsCount: number;
  todayReports: Array<Pick<Report, "id" | "jobsite_id" | "report_date">>;
  error: SupabaseErrorLike | null;
};

export type DashboardDetails = {
  tomorrowMaterialStatuses: BringListMaterialStatus[];
  liveWeatherDecision: ReturnType<typeof selectActiveWeatherJobsite>;
  liveWeather: Awaited<ReturnType<typeof fetchLiveWeather>> | null;
  radarFrames: Awaited<ReturnType<typeof fetchRainViewerFrames>>;
  liveWeatherError: string | null;
};

function todayIsoDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function rawObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function countList<T>(value: unknown): CountList<T> {
  const object = rawObject(value);
  return {
    count: asNumber(object.count),
    list: asArray<T>(object.list)
  };
}

function normalizeDashboardSummary(raw: unknown, error: SupabaseErrorLike | null): DashboardSummary {
  const object = rawObject(raw);
  const todayTimeEntries = countList<DashboardSummary["todayTimeEntries"]["list"][number]>(object.today_time_entries);

  return {
    jobsitesActive: countList<Jobsite>(object.jobsites_active),
    reportsLatest: countList<Report>(object.reports_latest),
    tasksOpen: countList<Task>(object.tasks_open),
    todayTimeEntries: {
      ...todayTimeEntries,
      netMinutes: asNumber(rawObject(object.today_time_entries).net_minutes)
    },
    employeesActive: countList<Profile>(object.employees_active),
    lowStockCount: asNumber(object.low_stock_count),
    openAlertsCount: asNumber(object.open_alerts_count),
    materialAlertsOpen: countList<MaterialAlert>(object.material_alerts_open),
    openSuggestionsCount: asNumber(object.open_suggestions_count),
    purchaseSuggestionsOpen: countList<PurchaseSuggestion>(object.purchase_suggestions_open),
    bringListsUpcomingCount: asNumber(rawObject(object.bring_lists_upcoming).count),
    weatherJobsites: asArray<Jobsite>(rawObject(object.weather_jobsites).list),
    weatherOrders: asArray<DashboardSummary["weatherOrders"][number]>(rawObject(object.weather_orders).list),
    todayReportsCount: asNumber(object.today_reports_count),
    todayReports: asArray<DashboardSummary["todayReports"][number]>(rawObject(object.today_reports).list),
    error
  };
}

export function dashboardTag(companyId: string) {
  return `dashboard-${companyId}`;
}

export function revalidateDashboardCache(companyId: string) {
  revalidateTag(dashboardTag(companyId), { expire: 0 });
}

export async function loadDashboardSummary(supabase: SupabaseServerClient, context: AppContext) {
  const today = todayIsoDate();

  return unstable_cache(
    async () => {
      const { data, error } = await supabase.rpc("get_dashboard_summary", {
        p_company_id: context.companyId,
        p_user_id: context.userId,
        p_can_manage: context.canManage,
        p_today: today
      });

      return normalizeDashboardSummary(data, error);
    },
    ["dashboard-summary", context.companyId, context.userId, String(context.canManage), today],
    { revalidate: 60, tags: [dashboardTag(context.companyId)] }
  )();
}

export async function loadDashboardDetails(
  supabase: SupabaseServerClient,
  context: AppContext,
  summary?: DashboardSummary
): Promise<DashboardDetails> {
  const today = todayIsoDate();
  const summaryData = summary ?? (await loadDashboardSummary(supabase, context));

  return unstable_cache(
    async () => {
      const liveWeatherDecision = selectActiveWeatherJobsite({
        jobsites: summaryData.weatherJobsites,
        orders: summaryData.weatherOrders,
        timeEntries: summaryData.todayTimeEntries.list,
        reports: summaryData.todayReports,
        todayIso: today
      });
      const liveWeatherJobsite = liveWeatherDecision.jobsite;
      const liveWeatherLat = liveWeatherJobsite?.latitude;
      const liveWeatherLng = liveWeatherJobsite?.longitude;
      const liveWeatherHasCoordinates =
        typeof liveWeatherLat === "number" &&
        Number.isFinite(liveWeatherLat) &&
        typeof liveWeatherLng === "number" &&
        Number.isFinite(liveWeatherLng);

      const [tomorrowMaterialStatuses, liveWeather, radarFrames] = await Promise.all([
        context.canManage ? loadBringListMaterialStatus({ supabase, companyId: context.companyId, date: tomorrowIsoDate(), limit: 6 }) : Promise.resolve([]),
        context.canManage && liveWeatherHasCoordinates ? fetchLiveWeather({ lat: liveWeatherLat, lng: liveWeatherLng }) : Promise.resolve(null),
        context.canManage && liveWeatherHasCoordinates ? fetchRainViewerFrames().catch(() => []) : Promise.resolve([])
      ]);

      return {
        tomorrowMaterialStatuses,
        liveWeatherDecision,
        liveWeather,
        radarFrames,
        liveWeatherError: summaryData.error ? "Live-Wetter: Zusatzdaten konnten nicht vollstaendig geladen werden." : null
      };
    },
    ["dashboard-details", context.companyId, context.userId, String(context.canManage), today],
    { revalidate: 60, tags: [dashboardTag(context.companyId)] }
  )();
}
