import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TimeEntryForm } from "@/components/forms/time-entry-form";
import { ContextualHelpTip } from "@/components/help/ContextualHelpTip";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { createTimeEntryAction } from "@/lib/actions/time-tracking-actions";
import { requireAppContext } from "@/lib/auth";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Jobsite, Profile } from "@/types/app";

export default async function NewTimeEntryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const todayIso = new Date().toISOString().slice(0, 10);
  const jobsitesQuery = (
    context.canManage
      ? supabase
          .from("jobsites")
          .select("id, company_id, name, customer, address, start_date, status, notes, assigned_employee_ids, latitude, longitude, weather_last_checked_at, created_at")
          .eq("company_id", context.companyId)
      : supabase
          .from("jobsites")
          .select("id, company_id, name, customer, address, start_date, status, notes, assigned_employee_ids, latitude, longitude, weather_last_checked_at, created_at")
          .eq("company_id", context.companyId)
          .contains("assigned_employee_ids", [context.userId])
  ).order("name");
  const employeesQuery = context.canManage
    ? supabase
        .from("profiles")
        .select("id, company_id, email, full_name, role, active")
        .eq("company_id", context.companyId)
        .eq("active", true)
        .in("role", ["mitarbeiter", "vorarbeiter"])
        .order("full_name")
    : supabase.from("profiles").select("id, company_id, email, full_name, role, active").eq("company_id", context.companyId).eq("id", context.userId);

  const [jobsitesResult, employeesResult, todayEntriesResult] = await Promise.all([
    jobsitesQuery,
    employeesQuery,
    supabase
      .from("time_entries")
      .select("net_minutes")
      .eq("company_id", context.companyId)
      .eq("employee_id", context.userId)
      .eq("date", todayIso)
  ]);

  const jobsites = (jobsitesResult.data ?? []) as Jobsite[];
  const employees = (employeesResult.data ?? []) as Profile[];
  const defaultJobsite = jobsites.find(
    (jobsite) =>
      !context.canManage &&
      jobsite.assigned_employee_ids?.includes(context.userId) &&
      (jobsite.status === "aktiv" || jobsite.status === "geplant")
  );
  const existingDailyNetMinutes = (todayEntriesResult.data ?? []).reduce(
    (sum, entry) => sum + Number((entry as { net_minutes?: number | null }).net_minutes ?? 0),
    0
  );

  return (
    <>
      <PageHeader title="Arbeitszeit eintragen" description="Schnell erfassen: Baustelle, Beginn, Ende, Pause und Tätigkeit." />
      <MessageBox
        error={
          error ||
          safeQueryErrorMessage(jobsitesResult.error) ||
          safeQueryErrorMessage(employeesResult.error) ||
          safeQueryErrorMessage(todayEntriesResult.error)
        }
        success={success}
      />
      <ContextualHelpTip featureKey="time_entry_create" returnTo="/time-tracking/new" />
      <div className="mb-4">
        <Link href="/time-tracking" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
      </div>

      <TimeEntryForm
        action={createTimeEntryAction}
        jobsites={jobsites}
        employees={employees}
        canManage={context.canManage}
        currentUserId={context.userId}
        submitLabel="Arbeitszeit speichern"
        defaultDate={todayIso}
        defaultJobsiteId={defaultJobsite?.id}
        existingDailyNetMinutes={existingDailyNetMinutes}
      />
    </>
  );
}
