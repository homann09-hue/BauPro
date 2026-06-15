import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { JobsiteForm } from "@/components/forms/jobsite-form";
import { createJobsiteAction } from "@/lib/actions/jobsite-actions";
import { requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Profile } from "@/types/app";

export default async function NewJobsitePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("active", true)
    .in("role", ["mitarbeiter", "vorarbeiter"])
    .order("full_name");
  const employees = (data ?? []) as Profile[];

  return (
    <>
      <PageHeader title="Neue Baustelle" description="Grunddaten erfassen und Mitarbeiter zuordnen." />
      <MessageBox error={error} success={success} />
      <JobsiteForm action={createJobsiteAction} employees={employees} submitLabel="Baustelle speichern" />
    </>
  );
}
