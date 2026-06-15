/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { PenLine, Trash2 } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { deleteReportAction } from "@/lib/actions/report-actions";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Profile, Report, ReportPhoto } from "@/types/app";

export default async function ReportDetailPage({
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

  const [reportResult, photosResult, employeesResult] = await Promise.all([
    supabase.from("reports").select("*, jobsites(id, name, customer, address)").eq("id", id).single(),
    supabase.from("report_photos").select("*").eq("report_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("active", true)
  ]);

  if (!reportResult.data) {
    notFound();
  }

  const report = reportResult.data as Report;
  const employees = (employeesResult.data ?? []) as Profile[];
  const employeeNames = employees
    .filter((employee) => report.employee_ids.includes(employee.id))
    .map((employee) => employee.full_name || employee.email)
    .filter(Boolean);
  const photos = await withSignedUrls((photosResult.data ?? []) as ReportPhoto[]);
  const canEdit = context.canManage || report.created_by === context.userId;

  return (
    <>
      <PageHeader
        title={`Tagesbericht vom ${formatDate(report.report_date)}`}
        description={report.jobsites?.name ?? "Ohne Baustelle"}
      />
      <MessageBox error={error} success={success} />

      <div className="grid gap-5 xl:grid-cols-[1fr_0.7fr]">
        <section className="surface p-4 sm:p-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Info label="Baustelle" value={report.jobsites?.name ?? "Keine Angabe"} />
            <Info label="Kunde" value={report.jobsites?.customer ?? "Keine Angabe"} />
            <Info label="Datum" value={formatDate(report.report_date)} />
            <Info label="Wetter" value={report.weather || "Keine Angabe"} />
            <Info
              label="Arbeitszeit"
              value={`${report.work_start?.slice(0, 5) || "--:--"} - ${report.work_end?.slice(0, 5) || "--:--"}`}
            />
            <Info label="Mitarbeiter" value={employeeNames.join(", ") || "Keine Angabe"} />
          </dl>

          <TextBlock title="Tätigkeiten" value={report.activities} />
          <TextBlock title="Materialverbrauch" value={report.material_usage} />
          <TextBlock title="Probleme / Besonderheiten" value={report.issues} />
          <TextBlock title="Unterschrift" value={report.signature_name} />

          {canEdit ? (
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href={`/berichte/${report.id}/bearbeiten`} className="btn-primary">
                <PenLine className="h-4 w-4" aria-hidden="true" />
                Bearbeiten
              </Link>
              <form action={deleteReportAction}>
                <input type="hidden" name="id" value={report.id} />
                <SubmitButton variant="danger">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Bericht löschen
                </SubmitButton>
              </form>
            </div>
          ) : null}
        </section>

        <section className="surface p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold text-ink">Fotos</h2>
          {photos.length === 0 ? (
            <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">
              Keine Fotos hinterlegt.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {photos.map((photo) => (
                <a
                  href={photo.signedUrl}
                  target="_blank"
                  rel="noreferrer"
                  key={photo.id}
                  className="overflow-hidden rounded-md border border-line bg-white"
                >
                  {photo.signedUrl ? (
                    <img src={photo.signedUrl} alt={photo.file_name} className="h-48 w-full object-cover" />
                  ) : null}
                  <p className="truncate p-3 text-xs text-slate-600">{photo.file_name}</p>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

function TextBlock({ title, value }: { title: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="mt-5">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-2 whitespace-pre-line rounded-md bg-fog p-3 text-sm text-slate-700">{value}</p>
    </div>
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
