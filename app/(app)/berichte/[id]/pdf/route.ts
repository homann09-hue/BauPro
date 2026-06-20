import { getOptionalAppContext } from "@/lib/auth";
import { reportFormSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { buildReportPdf, reportFilename } from "@/lib/report-export";
import { downloadHeaders } from "@/lib/security/downloads";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Company, Profile, Report, TimeEntry, Vehicle } from "@/types/app";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });
  const appContext = context;

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const reportSelect = `${reportFormSelect}, jobsites(id, name, customer, address)`;
  const legacyReportSelect =
    "id, company_id, jobsite_id, report_date, weather, weather_summary, weather_temperature_c, weather_precipitation_mm, weather_wind_kmh, weather_source, weather_fetched_at, weather_lat, weather_lng, work_start, work_end, employee_ids, activities, material_usage, machine_usage, vehicle_ids, linked_time_entry_ids, issues, report_status, submitted_at, reviewed_by, reviewed_at, approved_by, approved_at, visible_to_customer, customer_summary, customer_released_at, customer_released_by, created_by, created_at, jobsites(id, name, customer, address)";

  function buildReportQuery(select: string) {
    let reportQuery = supabase.from("reports").select(select).eq("id", id).eq("company_id", appContext.companyId).is("archived_at", null);
    if (!appContext.canManage) reportQuery = reportQuery.eq("created_by", appContext.userId);
    return reportQuery;
  }

  let reportResult = await buildReportQuery(reportSelect).single();
  if (isMissingSchemaError(reportResult.error)) {
    reportResult = await buildReportQuery(legacyReportSelect).single();
  }

  if (reportResult.error || !reportResult.data) return new Response("Tagesbericht wurde nicht gefunden.", { status: 404 });

  const report = reportResult.data as unknown as Report;
  const vehicleIds = report.vehicle_ids ?? [];
  const linkedTimeIds = report.linked_time_entry_ids ?? [];
  const [{ data: companyData }, { data: employeeData }, { data: vehicleData }, { data: timeEntryData }] = await Promise.all([
    supabase.from("companies").select("id, name").eq("id", appContext.companyId).single(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("company_id", appContext.companyId)
      .in("id", report.employee_ids.length ? report.employee_ids : [appContext.userId]),
    vehicleIds.length
      ? supabase.from("vehicles").select(vehicleOptionSelect).eq("company_id", appContext.companyId).in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    linkedTimeIds.length
      ? supabase
          .from("time_entries")
          .select("id, start_time, end_time, net_minutes, activity, profiles!time_entries_employee_id_fkey(id, full_name, email)")
          .eq("company_id", appContext.companyId)
          .in("id", linkedTimeIds)
      : Promise.resolve({ data: [] })
  ]);

  const data = {
    company: (companyData as Pick<Company, "id" | "name"> | null) ?? { id: appContext.companyId, name: appContext.companyName },
    report,
    employees: (employeeData ?? []) as Pick<Profile, "id" | "full_name" | "email">[],
    vehicles: (vehicleData ?? []) as Pick<Vehicle, "id" | "name" | "license_plate">[],
    timeEntries: (timeEntryData ?? []) as unknown as Array<Pick<TimeEntry, "id" | "start_time" | "end_time" | "net_minutes" | "activity"> & {
      profiles?: Pick<Profile, "id" | "full_name" | "email"> | null;
    }>,
    generatedAt: new Date().toISOString()
  };
  const pdf = buildReportPdf(data);

  return new Response(new Uint8Array(pdf), {
    headers: downloadHeaders("application/pdf", reportFilename(data))
  });
}
