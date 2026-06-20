import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileImage, Lock, PackagePlus, ShieldCheck } from "lucide-react";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { confirmDeliveryNoteAction } from "@/lib/actions/delivery-note-actions";
import { requireAppContext } from "@/lib/auth";
import { deliveryNoteItemPriceSelect, deliveryNoteItemSelect, deliveryNoteSelect, inventoryLocationSelect } from "@/lib/data/selects";
import { formatQuantity } from "@/lib/inventory";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";
import type { DeliveryNote, DeliveryNoteItem, DeliveryNoteItemPrice, InventoryItem, InventoryLocation } from "@/types/app";

const statusLabels = {
  uploaded: "Hochgeladen",
  recognized: "Zu prüfen",
  confirmed: "Gebucht",
  rejected: "Verworfen"
};

function confidenceLabel(value: number | null) {
  if (value === null) return "unsicher";
  if (value >= 0.85) return "hoch";
  if (value >= 0.6) return "mittel";
  return "niedrig";
}

export default async function DeliveryNoteDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);
  const supabase = await createSupabaseServerClient();

  if (!context.canOperate) {
    return (
      <>
        <PageHeader title="Lieferschein" />
        <MaterialSubnav active="/materials/delivery-notes" canManage={context.canManage} canOperate={context.canOperate} />
        <MessageBox error="Keine Berechtigung für Lieferscheine." />
      </>
    );
  }

  const [noteResult, itemsResult, pricesResult, inventoryResult, locationsResult] = await Promise.all([
    supabase.from("delivery_notes").select(deliveryNoteSelect).eq("company_id", context.companyId).eq("id", id).maybeSingle(),
    supabase.from("delivery_note_items").select(deliveryNoteItemSelect).eq("company_id", context.companyId).eq("delivery_note_id", id).order("created_at"),
    context.canManage
      ? supabase.from("delivery_note_item_prices").select(deliveryNoteItemPriceSelect).eq("company_id", context.companyId)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("inventory_items_public")
      .select("id, name, unit, stock, minimum_stock, location_id, article_number")
      .eq("company_id", context.companyId)
      .order("name", { ascending: true })
      .limit(400),
    supabase.from("inventory_locations").select(inventoryLocationSelect).eq("company_id", context.companyId).eq("active", true).order("name")
  ]);

  const note = noteResult.data as unknown as DeliveryNote | null;
  const items = (itemsResult.data ?? []) as unknown as DeliveryNoteItem[];
  const prices = (pricesResult.data ?? []) as unknown as DeliveryNoteItemPrice[];
  const inventoryItems = (inventoryResult.data ?? []) as unknown as Pick<InventoryItem, "id" | "name" | "unit" | "stock" | "minimum_stock" | "location_id" | "article_number">[];
  const locations = (locationsResult.data ?? []) as unknown as InventoryLocation[];
  const priceByItemId = new Map(prices.map((price) => [price.delivery_note_item_id, price]));
  const isConfirmed = note?.status === "confirmed";
  const signedPhoto =
    note?.storage_path
      ? await supabase.storage.from("delivery-notes").createSignedUrl(note.storage_path, 600).then((result) => result.data?.signedUrl ?? null)
      : null;
  const defaultLocationId = locations.find((location) => location.location_type === "Hauptlager")?.id ?? locations[0]?.id ?? "";
  const editableRows = [
    ...items,
    ...Array.from({ length: isConfirmed ? 0 : 2 }, (_, index) => ({
      id: `new-${index}`,
      company_id: context.companyId,
      delivery_note_id: id,
      inventory_item_id: null,
      supplier_article_number: null,
      article_name: "",
      quantity: 0,
      unit: "Stück",
      target_location_id: defaultLocationId,
      recognition_confidence: null,
      created_at: "",
      updated_at: ""
    }))
  ] as DeliveryNoteItem[];

  if (!note) {
    return (
      <>
        <PageHeader title="Lieferschein" />
        <MessageBox error="Lieferschein wurde nicht gefunden." />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Lieferschein prüfen"
        description="Erkannte Daten korrigieren und danach den Wareneingang bestätigen."
        actionHref="/materials/delivery-notes"
        actionLabel="Zurück"
        actionIcon={ArrowLeft}
      />
      <MaterialSubnav active="/materials/delivery-notes" canManage={context.canManage} canOperate={context.canOperate} />
      <MessageBox
        error={
          error ||
          safeQueryErrorMessage(noteResult.error) ||
          safeQueryErrorMessage(itemsResult.error) ||
          safeQueryErrorMessage(inventoryResult.error) ||
          safeQueryErrorMessage(locationsResult.error)
        }
        success={success}
      />

      <section className="surface mb-5 p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <StatusBadge value={note.status} label={statusLabels[note.status]} />
              <span className="rounded-md bg-fog px-2.5 py-1 text-xs font-black text-slate-600">
                Sicherheit: {confidenceLabel(note.recognition_confidence)}
              </span>
              {isConfirmed ? (
                <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-black text-emerald-800">
                  Gebucht am {note.confirmed_at ? formatDateTime(note.confirmed_at) : "-"}
                </span>
              ) : null}
            </div>
            <h2 className="text-xl font-black text-ink">{note.supplier_name || "Lieferant offen"}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {note.document_date ? formatDate(note.document_date) : "Datum offen"} - Original: {note.file_name}
            </p>
            {note.notes ? (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{note.notes}</p>
            ) : null}
            <p className="mt-4 flex items-start gap-2 rounded-md bg-mint p-3 text-sm font-semibold text-moss">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Keine automatische Buchung: Der Lagerbestand wird erst nach deiner Bestätigung erhöht.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-line bg-fog">
            {signedPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={signedPhoto} alt="Original Lieferschein" className="max-h-80 w-full object-contain" loading="lazy" decoding="async" />
            ) : (
              <div className="flex min-h-48 flex-col items-center justify-center gap-2 text-slate-500">
                <FileImage className="h-8 w-8" aria-hidden="true" />
                <p className="text-sm font-bold">Originalfoto gespeichert</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {isConfirmed ? (
        <section className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <Lock className="h-5 w-5 text-moss" aria-hidden="true" />
            <h2 className="text-lg font-black text-ink">Gebuchte Positionen</h2>
          </div>
          <div className="grid gap-3">
            {items.map((item) => {
              const price = priceByItemId.get(item.id);
              return (
                <article key={item.id} className="rounded-lg border border-line bg-white p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-ink">{item.article_name}</p>
                      <p className="text-sm font-semibold text-slate-600">
                        {formatQuantity(item.quantity)} {item.unit} - {item.inventory_items?.name ?? "Lagerartikel"}
                      </p>
                    </div>
                    {context.canManage && price ? (
                      <p className="text-sm font-black text-ink">
                        {price.unit_price !== null ? formatMoney(price.unit_price) : "-"} / {price.total_price !== null ? formatMoney(price.total_price) : "-"}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <form action={confirmDeliveryNoteAction} className="grid gap-5">
          <input type="hidden" name="delivery_note_id" value={note.id} />
          <input type="hidden" name="return_to" value={`/materials/delivery-notes/${note.id}`} />

          <section className="surface p-4 sm:p-5">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="field-label">Lieferant</span>
                <input className="field-input min-h-14 text-base" name="supplier_name" defaultValue={note.supplier_name ?? ""} />
              </label>
              <label className="block">
                <span className="field-label">Datum</span>
                <input className="field-input min-h-14 text-base" name="document_date" type="date" defaultValue={note.document_date ?? ""} />
              </label>
              <label className="block">
                <span className="field-label">Notiz</span>
                <input className="field-input min-h-14 text-base" name="notes" defaultValue={note.notes ?? ""} />
              </label>
            </div>
          </section>

          <section className="surface p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-moss" aria-hidden="true" />
              <h2 className="text-lg font-black text-ink">Positionen prüfen</h2>
            </div>
            <div className="grid gap-4">
              {editableRows.map((item, index) => {
                const isNew = item.id.startsWith("new-");
                const price = priceByItemId.get(item.id);
                return (
                  <article key={item.id} className="rounded-lg border border-line bg-white p-3">
                    <input type="hidden" name="item_row_id" value={isNew ? "" : item.id} />
                    <div className="grid gap-3 xl:grid-cols-[1.4fr_1.2fr_0.5fr_0.5fr_0.8fr]">
                      <label className="block">
                        <span className="field-label">Artikelname</span>
                        <input className="field-input min-h-12" name="article_name" defaultValue={item.article_name} placeholder="z. B. Unterspannbahn" />
                      </label>
                      <label className="block">
                        <span className="field-label">Lagerartikel</span>
                        <select className="field-input min-h-12" name="inventory_item_id" defaultValue={item.inventory_item_id ?? ""}>
                          <option value="">{context.canManage ? "Neu aus Artikelname anlegen" : "Bitte Lagerartikel wählen"}</option>
                          {inventoryItems.map((inventoryItem) => (
                            <option key={`${item.id}-${inventoryItem.id}`} value={inventoryItem.id}>
                              {inventoryItem.name} ({formatQuantity(inventoryItem.stock)} {inventoryItem.unit})
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="field-label">Menge</span>
                        <input className="field-input min-h-12" name="quantity" type="number" min="0" step="0.01" defaultValue={item.quantity || ""} />
                      </label>
                      <label className="block">
                        <span className="field-label">Einheit</span>
                        <input className="field-input min-h-12" name="unit" defaultValue={item.unit} />
                      </label>
                      <label className="block">
                        <span className="field-label">Lagerort</span>
                        <select className="field-input min-h-12" name="target_location_id" defaultValue={item.target_location_id ?? defaultLocationId}>
                          {locations.map((location) => (
                            <option key={`${item.id}-${location.id}`} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <label className="block">
                        <span className="field-label">Artikelnummer</span>
                        <input className="field-input min-h-12" name="supplier_article_number" defaultValue={item.supplier_article_number ?? ""} />
                      </label>
                      {context.canManage ? (
                        <>
                          <label className="block">
                            <span className="field-label">Einzelpreis</span>
                            <input className="field-input min-h-12" name="unit_price" type="number" min="0" step="0.01" defaultValue={price?.unit_price ?? ""} />
                          </label>
                          <label className="block">
                            <span className="field-label">Gesamtpreis</span>
                            <input className="field-input min-h-12" name="total_price" type="number" min="0" step="0.01" defaultValue={price?.total_price ?? ""} />
                          </label>
                        </>
                      ) : (
                        <div className="rounded-md bg-fog p-3 text-sm font-semibold text-slate-600 md:col-span-2">
                          Preise sind für Vorarbeiter ausgeblendet. Gebucht werden nur Mengen und Lagerartikel.
                        </div>
                      )}
                    </div>
                    {!isNew ? (
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Erkennung: {confidenceLabel(item.recognition_confidence)} - Zeile {index + 1}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <div className="surface-strong flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-600">
              Nach dem Klick wird der Bestand für alle gültigen Positionen erhöht. Danach ist der Lieferschein gesperrt.
            </p>
            <button className="btn-primary min-h-14" type="submit">
              <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              Bestätigen und Lager buchen
            </button>
          </div>
        </form>
      )}

      <div className="mt-5">
        <Link href="/materials/delivery-notes" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zur Lieferschein-Liste
        </Link>
      </div>
    </>
  );
}
