import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  MessageSquareText,
  PenLine,
  ShieldAlert
} from "lucide-react";
import { PhotoCaptureButton } from "@/components/forms/photo-capture-button";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SignaturePad } from "@/components/signature/signature-pad";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import {
  archiveJobsiteChecklistAction,
  completeJobsiteChecklistAction,
  updateChecklistItemAction,
  uploadChecklistItemPhotoAction
} from "@/lib/actions/checklist-actions";
import { requireAppContext, type AppContext } from "@/lib/auth";
import {
  checklistItemPhotoSelect,
  jobsiteChecklistDetailSelect,
  jobsiteChecklistItemSelect
} from "@/lib/data/selects";
import {
  checklistCategoryLabels,
  checklistItemStatusLabels,
  checklistItemStatuses,
  checklistProgress,
  jobsiteChecklistStatusLabels
} from "@/lib/checklists";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, isForeman, searchParamMessage } from "@/lib/utils";
import type { ChecklistItemPhoto, ChecklistItemStatus, JobsiteChecklist, JobsiteChecklistItem } from "@/types/app";

type SignedChecklistPhoto = ChecklistItemPhoto & {
  signedUrl?: string;
};

function canCompleteChecklist(context: AppContext, checklist: JobsiteChecklist) {
  return context.canManage || (isForeman(context.profile.role) && Boolean(checklist.jobsites?.assigned_employee_ids.includes(context.userId)));
}

export default async function ChecklistDetailPage({
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

  const [checklistResult, itemsResult, photosResult] = await Promise.all([
    supabase
      .from("jobsite_checklists")
      .select(jobsiteChecklistDetailSelect)
      .eq("company_id", context.companyId)
      .eq("id", id)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("jobsite_checklist_items")
      .select(jobsiteChecklistItemSelect)
      .eq("company_id", context.companyId)
      .eq("checklist_id", id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("checklist_item_photos")
      .select(checklistItemPhotoSelect)
      .eq("company_id", context.companyId)
      .eq("checklist_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
  ]);

  const checklist = checklistResult.data as unknown as JobsiteChecklist | null;
  if (!checklist?.jobsites) notFound();
  if (!context.canManage && !checklist.jobsites.assigned_employee_ids.includes(context.userId)) notFound();

  const items = (itemsResult.data ?? []) as unknown as JobsiteChecklistItem[];
  const rawPhotos = (photosResult.data ?? []) as ChecklistItemPhoto[];
  const photos = await Promise.all(
    rawPhotos.map(async (photo) => {
      const { data } = await supabase.storage.from("checklist-photos").createSignedUrl(photo.storage_path, 60 * 15);
      return { ...photo, signedUrl: data?.signedUrl };
    })
  );
  const photosByItem = new Map<string, SignedChecklistPhoto[]>();
  for (const photo of photos) {
    const list = photosByItem.get(photo.checklist_item_id) ?? [];
    list.push(photo);
    photosByItem.set(photo.checklist_item_id, list);
  }

  const progress = checklistProgress(items);
  const canComplete = canCompleteChecklist(context, checklist);
  const isCompleted = checklist.status === "completed";
  const pageError = [
    error,
    safeQueryErrorMessage(checklistResult.error),
    safeQueryErrorMessage(itemsResult.error),
    safeQueryErrorMessage(photosResult.error)
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHeader
        title={checklist.title}
        description={`${checklist.jobsites.name} · ${checklist.jobsites.customer} · ${checklist.jobsites.address}`}
      />
      <MessageBox error={pageError || null} success={success} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/checklists" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
        <Link href={`/baustellen/${checklist.jobsite_id}`} className="btn-secondary">
          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
          Baustelle
        </Link>
        <Link href={`/checklists/${checklist.id}/pdf`} className="btn-secondary" target="_blank">
          <FileDown className="h-4 w-4" aria-hidden="true" />
          PDF
        </Link>
        {context.canManage ? (
          <form action={archiveJobsiteChecklistAction}>
            <input type="hidden" name="checklist_id" value={checklist.id} />
            <input type="hidden" name="return_to" value="/checklists" />
            <SubmitButton variant="secondary" className="h-12">
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archivieren
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <section className="surface-strong construction-rail mb-5 p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <p className="meta-label">Kategorie</p>
            <p className="mt-1 font-black text-ink">{checklistCategoryLabels[checklist.category]}</p>
          </div>
          <div>
            <p className="meta-label">Status</p>
            <div className="mt-1">
              <StatusBadge value={checklist.status} label={jobsiteChecklistStatusLabels[checklist.status]} />
            </div>
          </div>
          <div>
            <p className="meta-label">Fortschritt</p>
            <p className="mt-1 font-black text-ink">
              {progress.done}/{progress.total} Punkte · {progress.percent}%
            </p>
          </div>
          <div>
            <p className="meta-label">Faellig</p>
            <p className="mt-1 font-black text-ink">{formatDate(checklist.due_date)}</p>
          </div>
        </div>
        {progress.problems > 0 || progress.requiredOpen > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {progress.problems > 0 ? (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                {progress.problems} Problem(e) wurden als Aufgabe/Mangel erzeugt.
              </div>
            ) : null}
            {progress.requiredOpen > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                {progress.requiredOpen} Pflichtpunkt(e) sind noch offen.
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-4">
        {items.map((item, index) => {
          const itemPhotos = photosByItem.get(item.id) ?? [];
          return (
            <article key={item.id} className="surface-strong overflow-hidden">
              <div className="border-b border-line bg-fog p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">#{index + 1}</span>
                      <StatusBadge value={item.status} label={checklistItemStatusLabels[item.status]} />
                      {item.required ? <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">Pflicht</span> : null}
                      {item.photo_required ? <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-info">Foto Pflicht</span> : null}
                    </div>
                    <h2 className="mt-3 text-lg font-black text-ink">{item.label}</h2>
                    {item.help_text ? <p className="mt-1 text-sm text-slate-600">{item.help_text}</p> : null}
                  </div>
                  {item.tasks ? (
                    <Link href={`/baustellen/${checklist.jobsite_id}`} className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-black text-red-700">
                      Aufgabe: {item.tasks.status}
                    </Link>
                  ) : null}
                  <Link
                    href={`/maengel/neu?jobsite_id=${checklist.jobsite_id}&source_type=checklist&source_checklist_id=${checklist.id}&source_checklist_item_id=${item.id}`}
                    className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-black text-amber-800"
                  >
                    Mangel anlegen
                  </Link>
                </div>
              </div>

              <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.65fr)]">
                <form action={updateChecklistItemAction} className="grid gap-3 rounded-lg border border-line bg-white p-3">
                  <input type="hidden" name="item_id" value={item.id} />
                  <input type="hidden" name="return_to" value={`/checklists/${checklist.id}`} />
                  <label>
                    <span className="field-label">Status</span>
                    <select className="field-input min-h-14 text-base" name="status" defaultValue={item.status} disabled={isCompleted}>
                      {checklistItemStatuses.map((status) => (
                        <option key={status} value={status}>
                          {checklistItemStatusLabels[status as ChecklistItemStatus]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Notiz optional</span>
                    <textarea
                      className="field-input min-h-24 text-base"
                      name="notes"
                      defaultValue={item.notes ?? ""}
                      placeholder="Kurz notieren, was geprüft wurde."
                      disabled={isCompleted}
                    />
                  </label>
                  <label>
                    <span className="field-label">Problembeschreibung</span>
                    <textarea
                      className="field-input min-h-24 text-base"
                      name="problem_description"
                      defaultValue={item.problem_description ?? ""}
                      placeholder="Nur ausfuellen, wenn Status Problem ist. Daraus entsteht automatisch eine Aufgabe."
                      disabled={isCompleted}
                    />
                  </label>
                  <SubmitButton variant="secondary" className="min-h-12" disabled={isCompleted}>
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Punkt speichern
                  </SubmitButton>
                </form>

                <div className="rounded-lg border border-line bg-white p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="font-black text-ink">Foto-Nachweis</p>
                      <p className="text-xs font-semibold text-slate-500">{itemPhotos.length} Foto(s) gespeichert</p>
                    </div>
                    <Camera className="h-5 w-5 text-moss" aria-hidden="true" />
                  </div>
                  {!isCompleted ? (
                    <form action={uploadChecklistItemPhotoAction} className="grid gap-3">
                      <input type="hidden" name="item_id" value={item.id} />
                      <input type="hidden" name="return_to" value={`/checklists/${checklist.id}`} />
                      <PhotoCaptureButton name="photo" label="Foto als Nachweis" />
                      <SubmitButton variant="secondary" className="min-h-12">
                        <Camera className="h-4 w-4" aria-hidden="true" />
                        Foto speichern
                      </SubmitButton>
                    </form>
                  ) : null}
                  {itemPhotos.length > 0 ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {itemPhotos.map((photo) => (
                        <div key={photo.id} className="overflow-hidden rounded-md border border-line bg-fog">
                          {photo.signedUrl ? (
                            // Signierte Storage-URLs können nicht stabil per next/image konfiguriert werden.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={photo.signedUrl} alt="Checklistenfoto" className="h-28 w-full object-cover" loading="lazy" decoding="async" />
                          ) : null}
                          <p className="truncate px-2 py-2 text-xs font-semibold text-slate-600">{formatDateTime(photo.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  ) : item.photo_required ? (
                    <p className="mt-3 flex gap-2 rounded-md bg-amber-50 p-3 text-sm font-bold text-amber-800">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      Für diesen Punkt ist ein Foto-Nachweis vorgesehen.
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="surface mt-5 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <MessageSquareText className="mt-1 h-5 w-5 text-moss" aria-hidden="true" />
          <div>
            <h2 className="text-lg font-black text-ink">Abschluss und Unterschrift</h2>
            <p className="mt-1 text-sm text-slate-600">
              Pflichtpunkte müssen bearbeitet sein. Eine Unterschrift ist optional und wird im PDF eingebettet.
            </p>
          </div>
        </div>
        {isCompleted ? (
          <div className="rounded-lg border border-primary/20 bg-mint p-4">
            <p className="font-black text-moss">Checkliste abgeschlossen.</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Abgeschlossen am {formatDateTime(checklist.completed_at)} durch {checklist.profiles?.full_name ?? "BauPro Nutzer"}.
            </p>
            {checklist.signature_name ? (
              <div className="mt-3">
                <p className="text-sm font-black text-ink">Unterschrieben von {checklist.signature_name}</p>
                {checklist.signature_data_url ? (
                  // Validierte Signatur-Data-URL aus der Datenbank.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={checklist.signature_data_url}
                    alt="Unterschrift"
                    className="mt-2 h-24 max-w-sm rounded-md border border-line bg-white object-contain p-2"
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        ) : canComplete ? (
          <form action={completeJobsiteChecklistAction} className="grid gap-3">
            <input type="hidden" name="checklist_id" value={checklist.id} />
            <input type="hidden" name="return_to" value={`/checklists/${checklist.id}`} />
            <label>
              <span className="field-label">Abschlussnotiz optional</span>
              <textarea className="field-input min-h-24 text-base" name="completion_notes" defaultValue={checklist.notes ?? ""} />
            </label>
            <label>
              <span className="field-label">Name des Unterzeichners optional</span>
              <input className="field-input min-h-14 text-base" name="signature_name" defaultValue={context.profile.full_name ?? ""} />
            </label>
            <SignaturePad label="Optionale Unterschrift" required={false} />
            <SubmitButton className="min-h-14">
              <PenLine className="h-4 w-4" aria-hidden="true" />
              Checkliste abschliessen
            </SubmitButton>
          </form>
        ) : (
          <p className="rounded-md bg-fog p-3 text-sm font-semibold text-slate-600">
            Abschluss ist für Chef oder zugewiesene Vorarbeiter freigegeben.
          </p>
        )}
      </section>
    </>
  );
}
