import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { ReportForm } from "@/components/forms/report-form";
import { ContextualHelpTip } from "@/components/help/ContextualHelpTip";
import { createReportAction } from "@/lib/actions/report-actions";
import { requireAppContext } from "@/lib/auth";
import { jobsiteFormSelect, profileOptionSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Jobsite, Profile, TimeEntry, Vehicle } from "@/types/app";

export default async function NewReportPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const todayIso = new Date().toISOString().slice(0, 10);
  const preselectedJobsiteId = typeof params.jobsite_id === "string" ? params.jobsite_id : null;

  const jobsitesQuery = (
    context.canManage
      ? supabase.from("jobsites").select(jobsiteFormSelect).eq("company_id", context.companyId)
      : supabase
          .from("jobsites")
          .select(jobsiteFormSelect)
          .eq("company_id", context.companyId)
          .contains("assigned_employee_ids", [context.userId])
  ).order("name", { ascending: true });

  let timeEntriesQuery = supabase
    .from("time_entries")
    .select(
      "id, employee_id, job_id, date, start_time, end_time, break_minutes, net_minutes, activity, profiles!time_entries_employee_id_fkey(id, full_name, email), jobsites(id, name, customer)"
    )
    .eq("company_id", context.companyId)
    .eq("date", todayIso)
    .order("start_time", { ascending: true })
    .limit(40);
  if (preselectedJobsiteId) timeEntriesQuery = timeEntriesQuery.eq("job_id", preselectedJobsiteId);
  if (!context.canOperate) timeEntriesQuery = timeEntriesQuery.eq("employee_id", context.userId);

  const [jobsitesResult, employeesResult, vehiclesResult, timeEntriesResult] = await Promise.all([
    jobsitesQuery,
    context.canOperate
      ? supabase
          .from("profiles")
          .select(profileOptionSelect)
          .eq("company_id", context.companyId)
          .eq("active", true)
          .in("role", ["mitarbeiter", "vorarbeiter"])
          .order("full_name", { ascending: true })
      : supabase.from("profiles").select(profileOptionSelect).eq("company_id", context.companyId).eq("id", context.userId),
    supabase.from("vehicles").select(vehicleOptionSelect).eq("company_id", context.companyId).is("archived_at", null).order("name", { ascending: true }),
    timeEntriesQuery
  ]);

  return (
    <>
      <PageHeader title="Neuer Tagesbericht" description="Bericht für Baustelle, Team, Zeiten und Fotos erfassen." />
      <MessageBox error={error} success={success} />
      <ContextualHelpTip featureKey="daily_report_create" returnTo="/berichte/neu" />
      <ReportForm
        action={createReportAction}
        jobsites={(jobsitesResult.data ?? []) as Jobsite[]}
        employees={(employeesResult.data ?? []) as Profile[]}
        vehicles={(vehiclesResult.data ?? []) as Vehicle[]}
        availableTimeEntries={(timeEntriesResult.data ?? []) as unknown as TimeEntry[]}
        canManage={context.canOperate}
        currentUserId={context.userId}
        defaultJobsiteId={preselectedJobsiteId}
        submitLabel="Einreichen"
      />
    </>
  );
}
