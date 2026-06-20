import { getOptionalAppContext } from "@/lib/auth";
import { calendarTimeEntrySelect } from "@/lib/data/selects";
import { downloadHeaders } from "@/lib/security/downloads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseDailyTimeFilters } from "@/lib/time-daily";
import { buildDailyTimeCsv, buildDailyTimePdf, dailyTimeFilename } from "@/lib/time-daily-export";
import type { TimeEntry } from "@/types/app";

export async function GET(request: Request) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });
  if (!context.canManage) return new Response("Keine Berechtigung", { status: 403 });

  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "csv" ? "csv" : "pdf";
    const filters = parseDailyTimeFilters(Object.fromEntries(url.searchParams.entries()));
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("time_entries")
      .select(calendarTimeEntrySelect)
      .eq("company_id", context.companyId)
      .gte("date", filters.dateFrom)
      .lte("date", filters.dateTo)
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
    if (filters.jobId) query = query.eq("job_id", filters.jobId);
    if (filters.status !== "all") query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;

    const exportData = {
      company: { id: context.companyId, name: context.companyName },
      generatedBy: context.profile,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      entries: (data ?? []) as unknown as TimeEntry[]
    };

    if (format === "csv") {
      return new Response(buildDailyTimeCsv(exportData), {
        headers: downloadHeaders("text/csv; charset=utf-8", dailyTimeFilename(exportData, "csv"))
      });
    }

    const pdf = buildDailyTimePdf(exportData);
    return new Response(new Uint8Array(pdf), {
      headers: downloadHeaders("application/pdf", dailyTimeFilename(exportData, "pdf"))
    });
  } catch (error) {
    console.error("daily-time-export-failed", error);
    return new Response("Tagesstunden-Export konnte nicht erzeugt werden.", { status: 500 });
  }
}
