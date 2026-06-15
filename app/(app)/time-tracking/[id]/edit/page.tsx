import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TimeEntryForm } from "@/components/forms/time-entry-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { updateTimeEntryAction } from "@/lib/actions/time-tracking-actions";
import { requireAppContext } from "@/lib/auth";
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

  const { data: entry } = await supabase
    .from("time_entries")
    .select("*")
    .eq("id", id)
    .eq("company_id", context.companyId)
    .single();

  if (!entry) notFound();
  const typedEntry = entry as TimeEntry;

  if (!context.canManage && typedEntry.status === "approved") {
    redirect("/time-tracking?error=Freigegebene+Zeiten+koennen+nicht+mehr+bearbeitet+werden.");
  }

  const [jobsitesResult, employeesResult, auditResult] = await Promise.all([
    supabase.from("jobsites").select("*").order("name"),
    supabase.from("profiles").select("*").eq("active", true).order("full_name"),
    supabase
      .from("time_entry_audit_log")
      .select("*, profiles!time_entry_audit_log_changed_by_fkey(id, full_name, email)")
      .eq("time_entry_id", id)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  return (
    <>
      <PageHeader title="Arbeitszeit bearbeiten" description="Korrekturen werden im Aenderungsprotokoll gespeichert." />
      <MessageBox error={error || jobsitesResult.error?.message || employeesResult.error?.message} success={success} />
      <div className="mb-4">
        <Link href="/time-tracking" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurueck
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
        {((auditResult.data ?? []) as TimeEntryAuditLog[]).length === 0 ? (
          <p className="mt-3 rounded-md border border-dashed border-line p-3 text-sm text-slate-600">
            Noch keine Aenderungen gespeichert.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {((auditResult.data ?? []) as TimeEntryAuditLog[]).map((audit) => (
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
