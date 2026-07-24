/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Archive, ArrowLeft, Camera, ClipboardCheck, FileDown, PenLine, ShieldAlert, Upload } from "lucide-react";
import { PhotoCaptureButton } from "@/components/forms/photo-capture-button";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { archiveDefectAction, updateDefectAction, uploadDefectPhotoAction } from "@/lib/actions/defect-actions";
import { requireAppContext } from "@/lib/auth";
import { defectPriorities, defectPriorityLabels, defectSourceLabels, defectStatusLabels, defectStatuses, isDefectOverdue } from "@/lib/defects";
import { defectDetailSelect, defectNotificationSelect, defectPhotoSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, searchParamMessage } from "@/lib/utils";
import type { Defect, DefectNotification, DefectPhoto, DefectPriority, DefectStatus, Profile } from "@/types/app";

type SignedDefectPhoto = DefectPhoto & { signedUrl?: string };

export default async function DefectDetailPage({
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

  const [defectResult, photosResult, employeesResult, notificationsResult] = await Promise.all([
    supabase
      .from("defects")
      .select(defectDetailSelect)
      .eq("company_id", context.companyId)
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("defect_photos")
      .select(defectPhotoSelect)
      .eq("company_id", context.companyId)
      .eq("defect_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    context.canManage
      ? supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("company_id", context.companyId)
          .eq("active", true)
          .in("role", ["vorarbeiter", "mitarbeiter"])
          .order("full_name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("defect_notifications")
      .select(defectNotificationSelect)
      .eq("company_id", context.companyId)
      .eq("defect_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  const defect = defectResult.data as unknown as Defect | null;
  if (!defect?.jobsites) notFound();
  const assignedToJobsite = defect.jobsites.assigned_employee_ids.includes(context.userId);
  if (!context.canManage && defect.assigned_to !== context.userId && !assignedToJobsite) notFound();

  const rawPhotos = (photosResult.data ?? []) as DefectPhoto[];
  const photos = await Promise.all(
    rawPhotos.map(async (photo) => {
      const { data } = await supabase.storage.from("defect-photos").createSignedUrl(photo.storage_path, 60 * 15);
      return { ...photo, signedUrl: data?.signedUrl };
    })
  );
  const employees = (employeesResult.data ?? []) as Pick<Profile, "id" | "full_name" | "email" | "role">[];
  const notifications = (notificationsResult.data ?? []) as unknown as DefectNotification[];
  const pageError = [
    error,
    safeQueryErrorMessage(defectResult.error),
    safeQueryErrorMessage(photosResult.error),
    safeQueryErrorMessage(employeesResult.error),
    safeQueryErrorMessage(notificationsResult.error)
  ]
    .filter(Boolean)
    .join(" ");
  const overdue = isDefectOverdue(defect);

  return (
    <>
      <PageHeader title={defect.title} description={`${defect.jobsites.name} · ${defect.jobsites.customer} · ${defect.jobsites.address}`} />
      <MessageBox error={pageError || null} success={success} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/maengel" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
        <Link href={`/baustellen/${defect.jobsite_id}`} className="btn-secondary">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          Baustelle
        </Link>
        <Link href={`/maengel/${defect.id}/pdf`} target="_blank" className="btn-secondary">
          <FileDown className="h-4 w-4" aria-hidden="true" />
          PDF
        </Link>
        {context.canManage ? (
          <form action={archiveDefectAction}>
            <input type="hidden" name="defect_id" value={defect.id} />
            <input type="hidden" name="return_to" value="/maengel" />
            <SubmitButton variant="secondary" className="min-h-12">
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archivieren
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.65fr)]">
        <div className="space-y-5">
          <section className="surface-strong p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <InfoTile label="Status" value={<StatusBadge value={defect.status} label={defectStatusLabels[defect.status]} />} />
              <InfoTile label="Priorität" value={<StatusBadge value={defect.priority} label={defectPriorityLabels[defect.priority]} />} />
              <InfoTile label="Frist" value={formatDate(defect.due_date)} />
              <InfoTile label="Kundenportal" value={defect.visible_to_customer ? "Freigegeben" : "Intern"} />
            </div>
            {overdue ? (
              <p className="mt-4 flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                Die Frist ist überschritten. Bitte Status prüfen oder neue Frist setzen.
              </p>
            ) : null}
          </section>

          <section className="surface p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
                <PenLine className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-black text-ink">Mangel bearbeiten</h2>
                <p className="text-sm text-slate-600">Mitarbeiter können Beschreibung und Status pflegen. Kundenfreigabe bleibt Chef.</p>
              </div>
            </div>

            <form action={updateDefectAction} className="grid gap-4">
              <input type="hidden" name="defect_id" value={defect.id} />
              <input type="hidden" name="return_to" value={`/maengel/${defect.id}`} />
              {context.canManage ? (
                <>
                  <label>
                    <span className="field-label">Titel</span>
                    <input className="field-input min-h-14 text-base" name="title" defaultValue={defect.title} required />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="field-label">Priorität</span>
                      <select className="field-input min-h-14 text-base" name="priority" defaultValue={defect.priority}>
                        {defectPriorities.map((priority) => (
                          <option key={priority} value={priority}>
                            {defectPriorityLabels[priority as DefectPriority]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Verantwortlicher</span>
                      <select className="field-input min-h-14 text-base" name="assigned_to" defaultValue={defect.assigned_to ?? ""}>
                        <option value="">Noch offen</option>
                        {employees.map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.full_name || employee.email}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span className="field-label">Frist</span>
                      <input className="field-input min-h-14 text-base" name="due_date" type="date" defaultValue={defect.due_date ?? ""} />
                    </label>
                    <label className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-3 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        name="visible_to_customer"
                        defaultChecked={defect.visible_to_customer}
                        className="h-4 w-4 rounded border-line text-moss"
                      />
                      Im Kundenportal sichtbar
                    </label>
                  </div>
                </>
              ) : null}

              <label>
                <span className="field-label">Status</span>
                <select className="field-input min-h-14 text-base" name="status" defaultValue={defect.status}>
                  {defectStatuses.map((status) => (
                    <option key={status} value={status}>
                      {defectStatusLabels[status as DefectStatus]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Beschreibung</span>
                <textarea className="field-input min-h-40 text-base" name="description" defaultValue={defect.description ?? ""} />
              </label>

              <SubmitButton className="min-h-14">
                <PenLine className="h-4 w-4" aria-hidden="true" />
                Änderungen speichern
              </SubmitButton>
            </form>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="surface p-4 sm:p-5">
            <h2 className="text-lg font-black text-ink">Quelle</h2>
            <div className="mt-3 space-y-2 text-sm">
              <Meta label="Typ" value={defectSourceLabels[defect.source_type]} />
              {defect.reports ? <Meta label="Bericht" value={`Tagesbericht ${formatDate(defect.reports.report_date)}`} href={`/berichte/${defect.reports.id}`} /> : null}
              {defect.jobsite_checklists ? (
                <Meta label="Checkliste" value={defect.jobsite_checklists.title} href={`/checklists/${defect.jobsite_checklists.id}`} />
              ) : null}
              {defect.jobsite_checklist_items ? <Meta label="Punkt" value={defect.jobsite_checklist_items.label} /> : null}
              {defect.customer_portal_messages ? <Meta label="Kundennachricht" value={defect.customer_portal_messages.sender_name} /> : null}
              {defect.tasks ? <Meta label="Aufgabe" value={defect.tasks.title} /> : null}
            </div>
          </section>

          <section className="surface p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-ink">Fotos</h2>
                <p className="text-sm text-slate-600">{photos.length} Foto(s) gespeichert</p>
              </div>
              <Camera className="h-5 w-5 text-moss" aria-hidden="true" />
            </div>
            <form action={uploadDefectPhotoAction} className="grid gap-3 rounded-lg border border-line bg-fog p-3">
              <input type="hidden" name="defect_id" value={defect.id} />
              <input type="hidden" name="return_to" value={`/maengel/${defect.id}`} />
              <PhotoCaptureButton name="photo" label="Foto ergänzen" />
              {context.canManage ? (
                <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
                  <input type="checkbox" name="visible_to_customer" className="h-4 w-4 rounded border-line text-moss" />
                  Foto für Kunden freigeben
                </label>
              ) : null}
              <SubmitButton variant="secondary" className="min-h-12">
                <Upload className="h-4 w-4" aria-hidden="true" />
                Foto speichern
              </SubmitButton>
            </form>

            {photos.length > 0 ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {photos.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo} />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-md border border-dashed border-line p-4 text-sm text-slate-500">
                Noch kein Foto hinterlegt.
              </p>
            )}
          </section>

          <section className="surface p-4 sm:p-5">
            <h2 className="text-lg font-black text-ink">Nachverfolgung</h2>
            <div className="mt-3 grid gap-2 text-sm">
              <Meta label="Erstellt" value={formatDateTime(defect.created_at)} />
              <Meta label="Aktualisiert" value={formatDateTime(defect.updated_at)} />
              <Meta label="Erledigt" value={formatDateTime(defect.closed_at)} />
              <Meta label="Abgenommen" value={formatDateTime(defect.accepted_at)} />
            </div>
            {notifications.length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="meta-label">Benachrichtigungen</p>
                {notifications.map((notification) => (
                  <article key={notification.id} className="rounded-md bg-fog p-3">
                    <p className="font-bold text-ink">{notification.title}</p>
                    {notification.body ? <p className="mt-1 text-xs text-slate-600">{notification.body}</p> : null}
                    <p className="mt-1 text-xs font-semibold text-slate-500">{formatDateTime(notification.created_at)}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </aside>
      </section>
    </>
  );
}

function InfoTile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-white p-3">
      <p className="meta-label">{label}</p>
      <div className="mt-1 text-sm font-bold text-ink">{value}</div>
    </div>
  );
}

function Meta({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = href ? (
    <Link href={href} className="font-bold text-moss hover:text-primary-dark">
      {value}
    </Link>
  ) : (
    <span className="font-bold text-ink">{value}</span>
  );

  return (
    <div className="rounded-md bg-fog px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1">{content}</p>
    </div>
  );
}

function PhotoCard({ photo }: { photo: SignedDefectPhoto }) {
  return (
    <div className="overflow-hidden rounded-md border border-line bg-white">
      {photo.signedUrl ? (
        <a href={photo.signedUrl} target="_blank" rel="noreferrer">
          <img src={photo.signedUrl} alt={photo.file_name} className="h-32 w-full object-cover" loading="lazy" decoding="async" />
        </a>
      ) : null}
      <div className="p-2">
        <p className="truncate text-xs font-semibold text-slate-600">{photo.file_name}</p>
        <p className="mt-1 text-xs font-black text-slate-500">{photo.visible_to_customer ? "Kunde" : "Intern"}</p>
      </div>
    </div>
  );
}
