import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { ReportForm } from "@/components/forms/report-form";
import { createReportAction } from "@/lib/actions/report-actions";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Jobsite, Profile } from "@/types/app";

export default async function NewReportPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const [jobsitesResult, employeesResult] = await Promise.all([
    supabase.from("jobsites").select("*").order("name", { ascending: true }),
    context.canManage
      ? supabase.from("profiles").select("*").eq("active", true).order("full_name", { ascending: true })
      : supabase.from("profiles").select("*").eq("id", context.userId)
  ]);

  return (
    <>
      <PageHeader title="Neuer Tagesbericht" description="Bericht fuer Baustelle, Team, Zeiten und Fotos erfassen." />
      <MessageBox error={error} success={success} />
      <ReportForm
        action={createReportAction}
        jobsites={(jobsitesResult.data ?? []) as Jobsite[]}
        employees={(employeesResult.data ?? []) as Profile[]}
        canManage={context.canManage}
        currentUserId={context.userId}
        submitLabel="Tagesbericht speichern"
      />
    </>
  );
}
