import { getOptionalAppContext } from "@/lib/auth";
import { reportFormSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { buildReportPdf, reportFilename } from "@/lib/report-export";
import { downloadHeaders } from "@/lib/security/downloads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Company, Profile, Report, TimeEntry, Vehicle } from "@/types/app";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context) return new Response("Nicht angemeldet", { status: 401 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const reportSelect = `${reportFormSelect}, jobsites(id, name, customer, address)`;

  let reportQuery = supabase.from("reports").select(reportSelect).eq("id", id).eq("company_id", context.companyId).is("archived_at", null);
  if (!context.canManage) reportQuery = reportQuery.eq("created_by", context.userId);

  const { data: reportData, error } = await reportQuery.single();
  if (error || !reportData) return new Response("Tagesbericht wurde nicht gefunden.", { status: 404 });

  const report = reportData as unknown as Report;
  const vehicleIds = report.vehicle_ids ?? [];
  const linkedTimeIds = report.linked_time_entry_ids ?? [];
  const [{ data: companyData }, { data: employeeData }, { data: vehicleData }, { data: timeEntryData }] = await Promise.all([
    supabase.from("companies").select("id, name").eq("id", context.companyId).single(),
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("company_id", context.companyId)
      .in("id", report.employee_ids.length ? report.employee_ids : [context.userId]),
    vehicleIds.length
      ? supabase.from("vehicles").select(vehicleOptionSelect).eq("company_id", context.companyId).in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    linkedTimeIds.length
      ? supabase
          .from("time_entries")
          .select("id, start_time, end_time, net_minutes, activity, profiles!time_entries_employee_id_fkey(id, full_name, email)")
          .eq("company_id", context.companyId)
          .in("id", linkedTimeIds)
      : Promise.resolve({ data: [] })
  ]);

  const data = {
    company: (companyData as Pick<Company, "id" | "name"> | null) ?? { id: context.companyId, name: context.companyName },
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
