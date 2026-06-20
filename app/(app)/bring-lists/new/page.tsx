import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BringListForm } from "@/components/forms/bring-list-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { createBringListAction } from "@/lib/actions/bring-list-actions";
import { requireAppContext } from "@/lib/auth";
import { jobsiteFormSelect, profileOptionSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Jobsite, Profile, Vehicle } from "@/types/app";

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default async function NewBringListPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const selectedJobId = typeof params.job_id === "string" ? params.job_id : "";
  const jobsitesQuery = (
    context.canManage
      ? supabase.from("jobsites").select(jobsiteFormSelect).eq("company_id", context.companyId)
      : supabase
          .from("jobsites")
          .select(jobsiteFormSelect)
          .eq("company_id", context.companyId)
          .contains("assigned_employee_ids", [context.userId])
  ).order("name");

  const [jobsitesResult, employeesResult, vehiclesResult] = await Promise.all([
    jobsitesQuery,
    context.canManage
      ? supabase
          .from("profiles")
          .select(profileOptionSelect)
          .eq("company_id", context.companyId)
          .eq("active", true)
          .in("role", ["mitarbeiter", "vorarbeiter"])
          .order("full_name")
      : Promise.resolve({ data: [] }),
    context.canManage
      ? supabase
          .from("vehicles")
          .select(vehicleOptionSelect)
          .eq("company_id", context.companyId)
          .is("archived_at", null)
          .order("name")
      : Promise.resolve({ data: [] })
  ]);

  const jobsites = (jobsitesResult.data ?? []) as Jobsite[];
  const employees = (employeesResult.data ?? []) as Profile[];
  const vehicles = (vehiclesResult.data ?? []) as Vehicle[];

  return (
    <>
      <PageHeader title="Neue Mitbringliste" description="Material, Werkzeug, PSA und Dokumente für eine Baustelle vorbereiten." />
      <MessageBox error={error || safeQueryErrorMessage(jobsitesResult.error)} success={success} />
      <div className="mb-4">
        <Link href="/bring-lists" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
      </div>

      <BringListForm
        action={createBringListAction}
        jobsites={jobsites}
        employees={employees}
        vehicles={vehicles}
        canManage={context.canManage}
        selectedJobId={selectedJobId}
        defaultDate={tomorrowIsoDate()}
      />
    </>
  );
}
