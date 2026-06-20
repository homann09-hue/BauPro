import { notFound } from "next/navigation";
import Link from "next/link";
import { LockKeyhole } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { ReportForm, ReportPhotoDeleteForms } from "@/components/forms/report-form";
import { SubmitButton } from "@/components/submit-button";
import { createReportRevisionAction, updateReportAction } from "@/lib/actions/report-actions";
import { requireAppContext } from "@/lib/auth";
import { jobsiteFormSelect, profileOptionSelect, reportFormSelect, reportPhotoSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Jobsite, Profile, Report, ReportPhoto, TimeEntry, Vehicle } from "@/types/app";

export default async function EditReportPage({
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
  let reportQuery = supabase.from("reports").select(reportFormSelect).eq("company_id", context.companyId).eq("id", id).is("archived_at", null);
  if (!context.canManage) reportQuery = reportQuery.eq("created_by", context.userId);

  const reportResult = await reportQuery.single();

  if (!reportResult.data) {
    notFound();
  }

  const report = reportResult.data as Report;
  if (report.signature_status === "signed" || report.signature_status === "rejected" || report.report_status === "approved") {
    const lockedReason =
      report.report_status === "approved"
        ? "Dieser Bautagesbericht ist freigegeben. Für Änderungen bitte eine neue Version anlegen."
        : "Dieser Tagesbericht ist finalisiert. Für Änderungen bitte eine neue Version anlegen.";
    return (
      <>
        <PageHeader title="Tagesbericht gesperrt" description={formatDate(report.report_date)} />
        <MessageBox error={error || lockedReason} success={success} />
        <div className="surface p-5">
          <div className="flex items-start gap-3">
            <LockKeyhole className="mt-1 h-5 w-5 text-primary" aria-hidden="true" />
            <div>
              <h2 className="section-title">Bericht gesperrt</h2>
              <p className="mt-2 text-sm font-semibold text-slate-600">
                Nach Unterschrift gesperrt oder nach Chef-Freigabe gesperrt: Finalisierte Berichte werden nicht nachtraeglich
                veraendert. So bleibt der Nachweis nachvollziehbar.
              </p>
              <Link href={`/berichte/${report.id}`} className="btn-primary mt-4">
                Zurück zum Bericht
              </Link>
              <form action={createReportRevisionAction} className="mt-3">
                <input type="hidden" name="report_id" value={report.id} />
                <SubmitButton variant="secondary">
                  <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                  Neue Version anlegen
                </SubmitButton>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

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
    .eq("date", report.report_date)
    .order("start_time", { ascending: true })
    .limit(50);
  if (report.jobsite_id) timeEntriesQuery = timeEntriesQuery.eq("job_id", report.jobsite_id);
  if (!context.canOperate) timeEntriesQuery = timeEntriesQuery.eq("employee_id", context.userId);

  const [jobsitesResult, employeesResult, vehiclesResult, timeEntriesResult, photosResult] = await Promise.all([
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
    timeEntriesQuery,
    supabase
      .from("report_photos")
      .select(reportPhotoSelect)
      .eq("company_id", context.companyId)
      .eq("report_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
  ]);

  const photos = await withSignedUrls((photosResult.data ?? []) as ReportPhoto[]);

  return (
    <>
      <PageHeader title="Tagesbericht bearbeiten" description={formatDate(report.report_date)} />
      <MessageBox error={error} success={success} />
      <ReportForm
        action={updateReportAction}
        report={report}
        jobsites={(jobsitesResult.data ?? []) as Jobsite[]}
        employees={(employeesResult.data ?? []) as Profile[]}
        vehicles={(vehiclesResult.data ?? []) as Vehicle[]}
        availableTimeEntries={(timeEntriesResult.data ?? []) as unknown as TimeEntry[]}
        photos={photos}
        canManage={context.canOperate}
        currentUserId={context.userId}
        submitLabel="Änderungen einreichen"
      />
      <ReportPhotoDeleteForms photos={photos} reportId={report.id} />
    </>
  );
}

async function withSignedUrls(photos: ReportPhoto[]) {
  const supabase = await createSupabaseServerClient();
  return Promise.all(
    photos.map(async (photo) => {
      const { data } = await supabase.storage.from("report-photos").createSignedUrl(photo.storage_path, 60 * 30);
      return { ...photo, signedUrl: data?.signedUrl };
    })
  );
}
