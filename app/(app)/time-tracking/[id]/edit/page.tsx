import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TimeEntryForm } from "@/components/forms/time-entry-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { updateTimeEntryAction } from "@/lib/actions/time-tracking-actions";
import { requireAppContext } from "@/lib/auth";
import { jobsiteFormSelect, profileOptionSelect, timeEntryAuditSelect } from "@/lib/data/selects";
import { selectSingleTimeEntryWithWeatherFallback } from "@/lib/data/time-entries";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, searchParamMessage } from "@/lib/utils";
import type { Jobsite, Profile, TimeEntry, TimeEntryAuditLog } from "@/types/app";

export default async function EditTimeEntryPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);

  const { data: entry } = await selectSingleTimeEntryWithWeatherFallback((select) => {
    let entryQuery = supabase.from("time_entries").select(select).eq("id", id).eq("company_id", context.companyId);

    if (!context.canManage) entryQuery = entryQuery.eq("employee_id", context.userId);

    return entryQuery.single();
  });

  if (!entry) notFound();
  const typedEntry = entry as TimeEntry;

  if (!context.canManage && typedEntry.status === "approved") {
    redirect(`/time-tracking?error=${encodeURIComponent("Freigegebene Zeiten können nicht mehr bearbeitet werden.")}`);
  }

  const jobsitesQuery = (
    context.canManage
      ? supabase.from("jobsites").select(jobsiteFormSelect).eq("company_id", context.companyId)
      : supabase
          .from("jobsites")
          .select(jobsiteFormSelect)
          .eq("company_id", context.companyId)
          .contains("assigned_employee_ids", [context.userId])
  ).order("name");
  const employeesQuery = context.canManage
    ? supabase
        .from("profiles")
        .select(profileOptionSelect)
        .eq("company_id", context.companyId)
        .eq("active", true)
        .in("role", ["mitarbeiter", "vorarbeiter"])
        .order("full_name")
    : supabase.from("profiles").select(profileOptionSelect).eq("company_id", context.companyId).eq("id", context.userId);

  const [jobsitesResult, employeesResult, auditResult] = await Promise.all([
    jobsitesQuery,
    employeesQuery,
    supabase
      .from("time_entry_audit_log")
      .select(timeEntryAuditSelect)
      .eq("company_id", context.companyId)
      .eq("time_entry_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);
  const audits = (auditResult.data ?? []) as unknown as TimeEntryAuditLog[];

  return (
    <>
      <PageHeader title="Arbeitszeit bearbeiten" description="Korrekturen werden im Aenderungsprotokoll gespeichert." />
      <MessageBox
        error={error || safeQueryErrorMessage(jobsitesResult.error) || safeQueryErrorMessage(employeesResult.error)}
        success={success}
      />
      <div className="mb-4">
        <Link href="/time-tracking" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
      </div>

      <TimeEntryForm
        action={updateTimeEntryAction}
        entry={typedEntry}
        jobsites={(jobsitesResult.data ?? []) as Jobsite[]}
        employees={(employeesResult.data ?? []) as Profile[]}
        canManage={context.canManage}
        currentUserId={context.userId}
        submitLabel="Arbeitszeit aktualisieren"
      />

      <section className="surface mt-5 p-4 sm:p-5">
        <h2 className="text-lg font-black text-ink">Aenderungsprotokoll</h2>
        {audits.length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-line p-3 text-sm text-slate-600">
            Noch keine Änderungen gespeichert.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {audits.map((audit) => (
              <div key={audit.id} className="rounded-md border border-line bg-white p-3 text-sm">
                <p className="font-bold text-ink">
                  {audit.change_reason || "Aenderung"} · {formatDateTime(audit.created_at)}
                </p>
                <p className="mt-1 text-slate-600">
                  Von {audit.profiles?.full_name || audit.profiles?.email || "Unbekannt"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
