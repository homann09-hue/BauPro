import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TimeEntryForm } from "@/components/forms/time-entry-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { createTimeEntryAction } from "@/lib/actions/time-tracking-actions";
import { requireAppContext } from "@/lib/auth";
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

  const [jobsitesResult, employeesResult] = await Promise.all([
    supabase.from("jobsites").select("*").order("name"),
    supabase.from("profiles").select("*").eq("active", true).order("full_name")
  ]);

  const jobsites = (jobsitesResult.data ?? []) as Jobsite[];
  const employees = (employeesResult.data ?? []) as Profile[];

  return (
    <>
      <PageHeader title="Arbeitszeit eintragen" description="Schnell erfassen: Baustelle, Beginn, Ende, Pause und Taetigkeit." />
      <MessageBox error={error || jobsitesResult.error?.message || employeesResult.error?.message} success={success} />
      <div className="mb-4">
        <Link href="/time-tracking" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurueck
        </Link>
      </div>

      <TimeEntryForm
        action={createTimeEntryAction}
        jobsites={jobsites}
        employees={employees}
        canManage={context.canManage}
        currentUserId={context.userId}
        submitLabel="Arbeitszeit speichern"
      />
    </>
  );
}
