import { notFound } from "next/navigation";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { ReportForm, ReportPhotoDeleteForms } from "@/components/forms/report-form";
import { updateReportAction } from "@/lib/actions/report-actions";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Jobsite, Profile, Report, ReportPhoto } from "@/types/app";

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

  const [reportResult, jobsitesResult, employeesResult, photosResult] = await Promise.all([
    supabase.from("reports").select("*").eq("id", id).single(),
    supabase.from("jobsites").select("*").order("name", { ascending: true }),
    context.canManage
      ? supabase.from("profiles").select("*").eq("active", true).order("full_name", { ascending: true })
      : supabase.from("profiles").select("*").eq("id", context.userId),
    supabase.from("report_photos").select("*").eq("report_id", id).order("created_at", { ascending: false })
  ]);

  if (!reportResult.data) {
    notFound();
  }

  const report = reportResult.data as Report;
  const canEdit = context.canManage || report.created_by === context.userId;
  if (!canEdit) {
    notFound();
  }

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
        photos={photos}
        canManage={context.canManage}
        currentUserId={context.userId}
        submitLabel="Aenderungen speichern"
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
