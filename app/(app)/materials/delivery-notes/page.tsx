import Link from "next/link";
import { Camera, CheckCircle2, ClipboardCheck, Clock3, FileImage, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PhotoCaptureButton } from "@/components/forms/photo-capture-button";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { createDeliveryNoteFromPhotoAction } from "@/lib/actions/delivery-note-actions";
import { isOpenAiConfigured } from "@/lib/ai/openai";
import { requireAppContext } from "@/lib/auth";
import { deliveryNoteSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, searchParamMessage } from "@/lib/utils";
import type { DeliveryNote } from "@/types/app";

const statusLabels = {
  uploaded: "Hochgeladen",
  recognized: "Zu prüfen",
  confirmed: "Gebucht",
  rejected: "Verworfen"
};

const statusIcons = {
  uploaded: Clock3,
  recognized: TriangleAlert,
  confirmed: CheckCircle2,
  rejected: TriangleAlert
};

export default async function DeliveryNotesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const { error, success } = searchParamMessage(await searchParams);
  const supabase = await createSupabaseServerClient();

  if (!context.canOperate) {
    return (
      <>
        <PageHeader title="Lieferscheine" description="Wareneingang per Foto erfassen." />
        <MaterialSubnav active="/materials/delivery-notes" canManage={context.canManage} canOperate={context.canOperate} />
        <MessageBox error="Keine Berechtigung für Lieferschein-Erkennung." />
      </>
    );
  }

  const { data: noteRows, error: queryError } = await supabase
    .from("delivery_notes")
    .select(deliveryNoteSelect)
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: false })
    .limit(30);

  const notes = (noteRows ?? []) as unknown as DeliveryNote[];
  const noteIds = notes.map((note) => note.id);
  const { data: itemRows } =
    noteIds.length > 0
      ? await supabase
          .from("delivery_note_items")
          .select("delivery_note_id")
          .eq("company_id", context.companyId)
          .in("delivery_note_id", noteIds)
          .limit(600)
      : { data: [] };
  const itemCountByNoteId = new Map<string, number>();
  for (const item of itemRows ?? []) {
    const id = item.delivery_note_id as string;
    itemCountByNoteId.set(id, (itemCountByNoteId.get(id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Lieferscheine"
        description="Foto aufnehmen, Material erkennen, prüfen und erst nach Bestätigung ins Lager buchen."
        actionHref="/materials/inventory"
        actionLabel="Zum Lager"
        actionIcon={ClipboardCheck}
      />
      <MaterialSubnav active="/materials/delivery-notes" canManage={context.canManage} canOperate={context.canOperate} />
      <MessageBox error={error || safeQueryErrorMessage(queryError)} success={success} />

      <section className="surface-strong construction-rail mb-5 p-4 sm:p-5">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary text-white">
            <Camera className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-black text-ink">Lieferschein fotografieren</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              Die Erkennung läuft serverseitig. Es wird nichts gebucht, bis du die Positionen bestätigst.
            </p>
          </div>
        </div>
        {!isOpenAiConfigured() ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            KI ist noch nicht konfiguriert. Trage serverseitig `OPENAI_API_KEY` ein, damit die automatische Erkennung funktioniert.
          </div>
        ) : null}
        <form action={createDeliveryNoteFromPhotoAction} className="grid gap-4">
          <input type="hidden" name="return_to" value="/materials/delivery-notes" />
          <PhotoCaptureButton name="delivery_note_photo" label="Lieferschein fotografieren" required />
          <button className="btn-primary min-h-14 w-full sm:w-auto" type="submit">
            Erkennen und prüfen
          </button>
          <p className="text-xs font-semibold text-slate-500">
            Datenschutz: Das Foto wird im privaten Firmen-Speicher abgelegt und nur zur Erkennung verarbeitet.
          </p>
        </form>
      </section>

      {notes.length === 0 ? (
        <EmptyState
          icon={FileImage}
          title="Noch keine Lieferscheine"
          description="Fotografiere den ersten Lieferschein. Danach prüfst du die Positionen und buchst den Wareneingang."
        />
      ) : (
        <section className="grid gap-3">
          {notes.map((note) => {
            const Icon = statusIcons[note.status];
            return (
              <Link key={note.id} href={`/materials/delivery-notes/${note.id}`} className="interactive-surface block p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-mint text-moss">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <div>
                      <p className="font-black text-ink">{note.supplier_name || "Lieferant offen"}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {note.document_date ? formatDate(note.document_date) : "Datum offen"} - {itemCountByNoteId.get(note.id) ?? 0} Positionen -{" "}
                        {formatDateTime(note.created_at)}
                      </p>
                    </div>
                  </div>
                  <StatusBadge value={note.status} label={statusLabels[note.status]} />
                </div>
              </Link>
            );
          })}
        </section>
      )}
    </>
  );
}
