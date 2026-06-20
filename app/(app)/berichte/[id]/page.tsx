/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, CloudSun, Eye, EyeOff, FileDown, LockKeyhole, PenLine, Send, Trash2, XCircle } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SignaturePad } from "@/components/signature/signature-pad";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { toggleReportCustomerReleaseAction, toggleReportPhotoCustomerVisibilityAction } from "@/lib/actions/customer-portal-actions";
import { createReportRevisionAction, deleteReportAction, signReportAction, updateReportWorkflowAction } from "@/lib/actions/report-actions";
import { requireAppContext } from "@/lib/auth";
import { reportFormSelect, reportPhotoSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { formatDate, formatDateTime, searchParamMessage } from "@/lib/utils";
import { weatherDetailsLine, weatherNumber, weatherSummary } from "@/lib/weather/display";
import type { Profile, Report, ReportPhoto, TimeEntry, Vehicle } from "@/types/app";

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
  const reportSelect = `${reportFormSelect}, jobsites(id, name, customer, address)`;
  const legacyReportSelect =
    "id, company_id, jobsite_id, report_date, weather, weather_summary, weather_temperature_c, weather_precipitation_mm, weather_wind_kmh, weather_source, weather_fetched_at, weather_lat, weather_lng, work_start, work_end, employee_ids, activities, material_usage, machine_usage, vehicle_ids, linked_time_entry_ids, issues, report_status, submitted_at, reviewed_by, reviewed_at, approved_by, approved_at, visible_to_customer, customer_summary, customer_released_at, customer_released_by, created_by, created_at, jobsites(id, name, customer, address)";

  function buildReportQuery(select: string) {
    let reportQuery = supabase.from("reports").select(select).eq("id", id).eq("company_id", context.companyId).is("archived_at", null);
    if (!context.canManage) reportQuery = reportQuery.eq("created_by", context.userId);
    return reportQuery;
  }

  let reportResult = await buildReportQuery(reportSelect).single();
  if (isMissingSchemaError(reportResult.error)) {
    reportResult = await buildReportQuery(legacyReportSelect).single();
  }

  if (!reportResult.data) {
    notFound();
  }

  const report = reportResult.data as unknown as Report;
  const linkedTimeIds = report.linked_time_entry_ids ?? [];
  const vehicleIds = report.vehicle_ids ?? [];
  const [photosResult, employeesResult, vehiclesResult, linkedTimeEntriesResult] = await Promise.all([
    supabase
      .from("report_photos")
      .select(reportPhotoSelect)
      .eq("report_id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, company_id, email, full_name, role, active").eq("company_id", context.companyId).eq("active", true),
    vehicleIds.length
      ? supabase.from("vehicles").select(vehicleOptionSelect).eq("company_id", context.companyId).in("id", vehicleIds)
      : Promise.resolve({ data: [], error: null }),
    linkedTimeIds.length
      ? supabase
          .from("time_entries")
          .select("id, employee_id, date, start_time, end_time, break_minutes, net_minutes, activity, profiles!time_entries_employee_id_fkey(id, full_name, email)")
          .eq("company_id", context.companyId)
          .in("id", linkedTimeIds)
          .order("start_time", { ascending: true })
      : Promise.resolve({ data: [], error: null })
  ]);
  const employees = (employeesResult.data ?? []) as unknown as Profile[];
  const employeeNames = employees
    .filter((employee) => report.employee_ids.includes(employee.id))
    .map((employee) => employee.full_name || employee.email)
    .filter(Boolean);
  const photos = await withSignedUrls((photosResult.data ?? []) as unknown as ReportPhoto[]);
  const vehicles = (vehiclesResult.data ?? []) as Vehicle[];
  const linkedTimeEntries = (linkedTimeEntriesResult.data ?? []) as unknown as Array<TimeEntry & { profiles?: Pick<Profile, "id" | "full_name" | "email"> | null }>;
  const canEdit = context.canManage || report.created_by === context.userId;
  const signatureStatus = report.signature_status ?? "draft";
  const reportStatus = report.report_status ?? "draft";
  const isFinalized = signatureStatus === "signed" || signatureStatus === "rejected" || reportStatus === "approved";

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
            <Info label="Version" value={`Version ${report.document_version ?? 1}`} />
            <div>
              <dt className="text-xs font-semibold uppercase tracking-normal text-slate-500">Status</dt>
              <dd className="mt-1">
                <StatusBadge value={reportStatus} label={reportStatusLabel(reportStatus)} />
              </dd>
            </div>
            <Info label="Wetter" value={weatherSummary(report) || "Keine Angabe"} />
            <Info
              label="Arbeitszeit"
              value={`${report.work_start?.slice(0, 5) || "--:--"} - ${report.work_end?.slice(0, 5) || "--:--"}`}
            />
            <Info label="Mitarbeiter" value={employeeNames.join(", ") || "Keine Angabe"} />
          </dl>

          {weatherSummary(report) ? (
            <div className="mt-5 rounded-lg border border-primary/20 bg-mint p-4">
              <div className="flex items-start gap-3">
                <CloudSun className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
                <div>
                  <p className="meta-label">Wetter-Nachweis</p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-ink">{weatherSummary(report)}</p>
                </div>
              </div>
              {context.canManage ? (
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <InfoTile label="Temperatur" value={weatherNumber(report.weather_temperature_c, "°C")} />
                  <InfoTile label="Niederschlag" value={weatherNumber(report.weather_precipitation_mm, "mm")} />
                  <InfoTile label="Wind" value={weatherNumber(report.weather_wind_kmh, "km/h")} />
                  <InfoTile label="Quelle" value={report.weather_source || "Manuell"} />
                  <InfoTile label="Abrufzeit" value={report.weather_fetched_at ? formatDateTime(report.weather_fetched_at) : "-"} />
                  <InfoTile label="Koordinaten" value={weatherDetailsLine(report) ? `${report.weather_lat ?? "-"}, ${report.weather_lng ?? "-"}` : "-"} />
                </div>
              ) : null}
            </div>
          ) : null}

          <TextBlock title="Tätigkeiten" value={report.activities} />
          <TextBlock title="Materialverbrauch" value={report.material_usage} />
          <TextBlock title="Maschinen / Fahrzeuge" value={[report.machine_usage, vehicles.map((vehicle) => `${vehicle.name} (${vehicle.license_plate})`).join(", ")].filter(Boolean).join("\n")} />
          <TextBlock title="Probleme / Besonderheiten" value={report.issues} />
          <LinkedTimeEntries entries={linkedTimeEntries} />
          {context.canManage ? (
            <>
              <WorkflowPanel report={report} />
              <CustomerReleasePanel report={report} />
            </>
          ) : null}
          <SignaturePanel
            report={report}
            canSign={canEdit && signatureStatus === "draft" && reportStatus !== "approved"}
            defaultSignerName={context.profile.full_name || context.email || ""}
          />

          {canEdit ? (
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <a href={`/berichte/${report.id}/pdf`} className="btn-secondary">
                <FileDown className="h-4 w-4" aria-hidden="true" />
                PDF herunterladen
              </a>
              <Link
                href={`/maengel/neu?jobsite_id=${report.jobsite_id}&source_type=report&source_report_id=${report.id}`}
                className="btn-secondary"
              >
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Mangel aus Bericht
              </Link>
              {isFinalized ? (
                <form action={createReportRevisionAction}>
                  <input type="hidden" name="report_id" value={report.id} />
                  <SubmitButton variant="secondary">
                    <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                    Neue Version anlegen
                  </SubmitButton>
                </form>
              ) : (
                <Link href={`/berichte/${report.id}/bearbeiten`} className="btn-primary">
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  Bearbeiten
                </Link>
              )}
              <form action={deleteReportAction}>
                <input type="hidden" name="id" value={report.id} />
                <SubmitButton variant="danger">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Bericht archivieren
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
                <div key={photo.id} className="overflow-hidden rounded-md border border-line bg-white">
                  <a href={photo.signedUrl} target="_blank" rel="noreferrer">
                    {photo.signedUrl ? (
                      <img src={photo.signedUrl} alt={photo.file_name} className="h-48 w-full object-cover" loading="lazy" decoding="async" />
                    ) : null}
                  </a>
                  <div className="p-3">
                    <p className="truncate text-xs font-semibold text-slate-600">{photo.file_name}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-black ${
                          photo.visible_to_customer ? "bg-mint text-primary" : "bg-fog text-slate-600"
                        }`}
                      >
                        {photo.visible_to_customer ? "Kunde sieht Foto" : "Intern"}
                      </span>
                      {context.canManage ? (
                        <form action={toggleReportPhotoCustomerVisibilityAction}>
                          <input type="hidden" name="report_id" value={report.id} />
                          <input type="hidden" name="photo_id" value={photo.id} />
                          <button className="btn-secondary min-h-10 px-3 text-xs" type="submit">
                            {photo.visible_to_customer ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                            {photo.visible_to_customer ? "Sperren" : "Freigeben"}
                          </button>
                        </form>
                      ) : null}
                    </div>
                    <Link
                      href={`/maengel/neu?jobsite_id=${report.jobsite_id}&source_type=photo&source_report_id=${report.id}&source_report_photo_id=${photo.id}`}
                      className="btn-secondary mt-3 w-full"
                    >
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      Mangel aus Foto
                    </Link>
                  </div>
                </div>
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

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-white p-3">
      <p className="meta-label">{label}</p>
      <p className="mt-1 text-sm font-bold text-ink">{value}</p>
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

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Entwurf",
    submitted: "Eingereicht",
    reviewed: "Geprüft",
    approved: "Freigegeben"
  };

  return labels[status] ?? status;
}

function formatMinutes(minutes?: number | null) {
  if (!minutes) return "0:00 h";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours}:${String(rest).padStart(2, "0")} h`;
}

function LinkedTimeEntries({
  entries
}: {
  entries: Array<TimeEntry & { profiles?: Pick<Profile, "id" | "full_name" | "email"> | null }>;
}) {
  if (entries.length === 0) return null;

  const totalMinutes = entries.reduce((sum, entry) => sum + Number(entry.net_minutes ?? 0), 0);

  return (
    <div className="mt-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="meta-label">Übernommen</p>
          <h2 className="text-sm font-semibold text-ink">Verknüpfte Arbeitszeiten</h2>
        </div>
        <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-black text-primary">
          {formatMinutes(totalMinutes)}
        </span>
      </div>
      <div className="mt-2 grid gap-2">
        {entries.map((entry) => (
          <div key={entry.id} className="rounded-md border border-line bg-fog p-3 text-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-black text-ink">{entry.profiles?.full_name || entry.profiles?.email || "Mitarbeiter"}</p>
              <p className="font-semibold text-slate-600">
                {entry.start_time?.slice(0, 5) || "--:--"} - {entry.end_time?.slice(0, 5) || "--:--"} ·{" "}
                {formatMinutes(entry.net_minutes)}
              </p>
            </div>
            {entry.activity ? <p className="mt-1 line-clamp-2 text-slate-600">{entry.activity}</p> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkflowPanel({ report }: { report: Report }) {
  const status = report.report_status ?? "draft";
  const signedStatus = report.signature_status ?? "draft";

  if (signedStatus === "signed" || signedStatus === "rejected") {
    return (
      <div className="mt-5 rounded-lg border border-line bg-fog p-4">
        <p className="text-sm font-black text-ink">Prüfung gesperrt</p>
        <p className="mt-1 text-sm text-slate-600">
          Dieser Bericht ist bereits per Unterschrift finalisiert. Für Änderungen bitte eine neue Version anlegen.
        </p>
      </div>
    );
  }

  if (status === "draft") {
    return (
      <div className="mt-5 rounded-lg border border-line bg-fog p-4">
        <p className="text-sm font-black text-ink">Noch nicht eingereicht</p>
        <p className="mt-1 text-sm text-slate-600">
          Sobald der Mitarbeiter den Bautagesbericht einreicht, kann Chef/Admin ihn prüfen und freigeben.
        </p>
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="mt-5 rounded-lg border border-primary/20 bg-mint p-4">
        <p className="text-sm font-black text-primary-dark">Freigegeben</p>
        <p className="mt-1 text-sm text-slate-700">
          Der Bautagesbericht ist abgeschlossen und gegen nachträgliche Änderungen gesperrt.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 rounded-lg border border-line bg-white p-4">
      <div>
        <p className="meta-label">Chef-Freigabe</p>
        <h2 className="text-sm font-black text-ink">Bautagesbericht prüfen</h2>
        <p className="mt-1 text-sm text-slate-600">
          Eingereichte Berichte können erst geprüft und danach freigegeben werden. Freigegebene Berichte sind gesperrt.
        </p>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {status === "submitted" ? (
          <form action={updateReportWorkflowAction}>
            <input type="hidden" name="report_id" value={report.id} />
            <input type="hidden" name="next_status" value="reviewed" />
            <SubmitButton variant="secondary">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Als geprüft markieren
            </SubmitButton>
          </form>
        ) : null}
        <form action={updateReportWorkflowAction}>
          <input type="hidden" name="report_id" value={report.id} />
          <input type="hidden" name="next_status" value="approved" />
          <SubmitButton>
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Freigeben
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function CustomerReleasePanel({ report }: { report: Report }) {
  const status = report.report_status ?? "draft";
  const canRelease = status === "approved";
  const defaultSummary = report.customer_summary || report.activities.slice(0, 900);

  if (!canRelease) {
    return (
      <div className="mt-5 rounded-lg border border-line bg-fog p-4">
        <p className="meta-label">Kundenportal</p>
        <h2 className="text-sm font-black text-ink">Noch nicht für Kunden freigebbar</h2>
        <p className="mt-1 text-sm text-slate-600">
          Der Bericht erscheint erst im Kundenportal, wenn er intern freigegeben und danach bewusst für den Kundenbereich
          veroeffentlicht wurde.
        </p>
      </div>
    );
  }

  return (
    <div className={`mt-5 rounded-lg border p-4 ${report.visible_to_customer ? "border-primary/20 bg-mint" : "border-line bg-white"}`}>
      <div className="flex items-start gap-3">
        <Send className="mt-0.5 h-5 w-5 text-primary" aria-hidden="true" />
        <div>
          <p className="meta-label">Kundenportal</p>
          <h2 className="text-sm font-black text-ink">
            {report.visible_to_customer ? "Bautagesbericht ist für Kunden sichtbar" : "Bautagesbericht für Kunden freigeben"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Veröffentliche nur geprüfte, kundentaugliche Informationen. Interne Notizen und Kalkulationen werden nicht angezeigt.
          </p>
          {report.customer_released_at ? (
            <p className="mt-2 text-xs font-semibold text-slate-500">Freigegeben am {formatDateTime(report.customer_released_at)}</p>
          ) : null}
        </div>
      </div>

      {report.visible_to_customer ? (
        <form action={toggleReportCustomerReleaseAction} className="mt-3">
          <input type="hidden" name="report_id" value={report.id} />
          <SubmitButton variant="secondary" name="mode" value="hide">
            <EyeOff className="h-4 w-4" aria-hidden="true" />
            Im Kundenportal ausblenden
          </SubmitButton>
        </form>
      ) : (
        <form action={toggleReportCustomerReleaseAction} className="mt-4 grid gap-3">
          <input type="hidden" name="report_id" value={report.id} />
          <label>
            <span className="field-label">Kundenzusammenfassung</span>
            <textarea
              className="field-input min-h-28"
              name="customer_summary"
              maxLength={1200}
              defaultValue={defaultSummary}
              placeholder="Kurz und verstaendlich: Was wurde erledigt, gab es wetterbedingte Hinweise, was passiert als Nächstes?"
            />
          </label>
          <SubmitButton name="mode" value="release">
            <Eye className="h-4 w-4" aria-hidden="true" />
            Für Kundenportal freigeben
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

function SignaturePanel({
  report,
  canSign,
  defaultSignerName
}: {
  report: Report;
  canSign: boolean;
  defaultSignerName: string;
}) {
  const status = report.signature_status ?? "draft";
  const statusLabel = status === "signed" ? "Unterschrieben" : status === "rejected" ? "Abgelehnt" : "Entwurf";
  const statusTone =
    status === "signed"
      ? "border-primary/20 bg-mint text-primary"
      : status === "rejected"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-line bg-fog text-slate-700";

  return (
    <div className={`mt-5 rounded-lg border p-4 ${statusTone}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-black text-ink">Digitale Unterschrift</h2>
          <p className="mt-1 text-sm font-semibold">
            {statusLabel}
            {report.signature_name ? ` von ${report.signature_name}` : ""}
            {report.signature_signed_at ? ` am ${formatDateTime(report.signature_signed_at)}` : ""}
          </p>
          {report.signature_content_hash ? (
            <p className="mt-1 break-all text-xs font-semibold text-slate-500">Hash: {report.signature_content_hash}</p>
          ) : null}
        </div>
        {status === "signed" ? (
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
        ) : status === "rejected" ? (
          <XCircle className="h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
        ) : (
          <PenLine className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
        )}
      </div>

      {report.signature_data_url ? (
        <img
          src={report.signature_data_url}
          alt="Gespeicherte Unterschrift"
          className="mt-3 h-24 max-w-sm rounded-md border border-line bg-white object-contain p-2"
          loading="lazy"
          decoding="async"
        />
      ) : null}

      {canSign ? (
        <form action={signReportAction} className="mt-4 grid gap-3 rounded-lg border border-line bg-white p-3">
          <input type="hidden" name="report_id" value={report.id} />
          <label>
            <span className="field-label">Name des Unterzeichners</span>
            <input className="field-input" name="signer_name" defaultValue={defaultSignerName} maxLength={120} required />
          </label>
          <SignaturePad label="Tagesbericht unterschreiben" required />
          <label>
            <span className="field-label">Ablehnungsgrund optional</span>
            <textarea
              className="field-input min-h-20"
              name="rejection_reason"
              maxLength={1000}
              placeholder="Nur ausfuellen, wenn der Bericht korrigiert werden soll."
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <SubmitButton name="decision" value="sign">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Bericht unterschreiben
            </SubmitButton>
            <SubmitButton variant="secondary" name="decision" value="reject">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Korrektur anfordern
            </SubmitButton>
          </div>
        </form>
      ) : null}
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
