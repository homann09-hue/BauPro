import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { JobsiteForm } from "@/components/forms/jobsite-form";
import { SubmitButton } from "@/components/submit-button";
import { deleteJobsiteAction, updateJobsiteAction } from "@/lib/actions/jobsite-actions";
import { requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Jobsite, Profile } from "@/types/app";

export default async function EditJobsitePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);

  const [jobsiteResult, employeesResult] = await Promise.all([
    supabase.from("jobsites").select("*").eq("id", id).single(),
    supabase
      .from("profiles")
      .select("*")
      .eq("active", true)
      .in("role", ["mitarbeiter", "vorarbeiter"])
      .order("full_name")
  ]);

  if (!jobsiteResult.data) {
    notFound();
  }

  const jobsite = jobsiteResult.data as Jobsite;
  const employees = (employeesResult.data ?? []) as Profile[];

  return (
    <>
      <PageHeader title="Baustelle bearbeiten" description={jobsite.name} />
      <MessageBox error={error} success={success} />
      <JobsiteForm
        action={updateJobsiteAction}
        jobsite={jobsite}
        employees={employees}
        submitLabel="Aenderungen speichern"
      />
      <form action={deleteJobsiteAction} className="mt-4 flex justify-end">
        <input type="hidden" name="id" value={jobsite.id} />
        <SubmitButton variant="danger">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Baustelle löschen
        </SubmitButton>
      </form>
    </>
  );
}
