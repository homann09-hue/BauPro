"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth";
import { searchOrFilter } from "@/lib/data/shared";
import { deliveryNoteItemSelect, deliveryNoteSelect, inventoryLocationSelect } from "@/lib/data/selects";
import { recognizeDeliveryNoteFromImage } from "@/lib/delivery-notes/recognition";
import { ensureDefaultInventoryLocations } from "@/lib/inventory";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { requiredFormUuid } from "@/lib/security/form-data";
import { safeReturnPath } from "@/lib/security/redirects";
import { sanitizeUploadFileName, validateReportPhoto } from "@/lib/security/uploads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString } from "@/lib/utils";
import type { AppContext } from "@/lib/auth";
import type { DeliveryNoteItem, InventoryLocation } from "@/types/app";

function redirectTarget(formData: FormData, fallback = "/materials/delivery-notes") {
  return safeReturnPath(formData.get("return_to"), fallback);
}

function firstFile(formData: FormData, key: string) {
  const file = formData.get(key);
  return file instanceof File && file.size > 0 ? file : null;
}

function formArray(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value ?? "").trim());
}

function numberAt(values: string[], index: number, fallback: number | null = null) {
  const parsed = Number(String(values[index] ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function dateValue(value: string | null) {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function ensureOperator(context: AppContext) {
  if (!context.canOperate) {
    throw new SafeActionError("Keine Berechtigung fuer Lieferscheine.");
  }
}

async function findSupplierIdByName({
  supabase,
  context,
  supplierName
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  context: AppContext;
  supplierName: string;
}) {
  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .eq("company_id", context.companyId)
    .or(searchOrFilter(["name"], supplierName))
    .limit(1)
    .maybeSingle();

  return (existing?.id as string | undefined) ?? null;
}

async function findOrCreateSupplier({
  supabase,
  context,
  supplierName
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  context: AppContext;
  supplierName: string | null;
}) {
  if (!supplierName || !context.canManage) return null;

  const existingId = await findSupplierIdByName({ supabase, context, supplierName });
  if (existingId) return existingId;

  const { data: inserted, error: insertError } = await supabase
    .from("suppliers")
    .insert({
      company_id: context.companyId,
      name: supplierName
    })
    .select("id")
    .maybeSingle();

  if (inserted?.id) return inserted.id as string;

  // Parallele Lieferschein-Erfassung kann denselben Lieferanten gleichzeitig
  // anlegen. Nach Unique-Konflikt sauber erneut lesen.
  if (insertError) {
    return findSupplierIdByName({ supabase, context, supplierName });
  }

  return null;
}

async function findMatchingInventoryItem({
  supabase,
  companyId,
  articleName,
  articleNumber
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  articleName: string;
  articleNumber: string | null;
}) {
  if (articleNumber) {
    const { data } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("company_id", companyId)
      .ilike("article_number", articleNumber)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  const { data } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("company_id", companyId)
    .or(searchOrFilter(["name"], articleName))
    .order("stock", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.id as string | undefined) ?? null;
}

async function createInventoryItemForDelivery({
  supabase,
  context,
  locationId,
  supplierId,
  articleName,
  articleNumber,
  unit,
  unitPrice
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  context: AppContext;
  locationId: string;
  supplierId: string | null;
  articleName: string;
  articleNumber: string | null;
  unit: string;
  unitPrice: number | null;
}) {
  if (!context.canManage) {
    throw new SafeActionError("Neue Lagerartikel duerfen nur Chef/Admin anlegen. Bitte Material zuordnen.");
  }

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      company_id: context.companyId,
      location_id: locationId,
      supplier_id: supplierId,
      name: articleName,
      article_number: articleNumber,
      unit,
      stock: 0,
      minimum_stock: 0,
      purchase_price: unitPrice,
      created_by: context.userId
    })
    .select("id")
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Lagerartikel konnte nicht angelegt werden.");
  return data.id as string;
}

async function assertLocation({
  supabase,
  companyId,
  locationId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  locationId: string;
}) {
  const { data } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", locationId)
    .eq("active", true)
    .maybeSingle();

  if (!data) throw new SafeActionError("Lagerort wurde nicht gefunden.");
}

function revalidateDeliveryNoteRoutes(companyId: string, id?: string) {
  revalidatePath("/materials");
  revalidatePath("/materials/inventory");
  revalidatePath("/materials/delivery-notes");
  if (id) revalidatePath(`/materials/delivery-notes/${id}`);
  revalidatePath("/dashboard");
  revalidateDashboardCache(companyId);
}

export async function createDeliveryNoteFromPhotoAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  let target = returnTo;

  try {
    ensureOperator(context);
    const photo = firstFile(formData, "delivery_note_photo");
    if (!photo) throw new SafeActionError("Bitte ein Lieferschein-Foto auswaehlen.");
    await validateReportPhoto(photo);

    const noteId = randomUUID();
    const safeName = sanitizeUploadFileName(photo.name || "lieferschein.jpg");
    const storagePath = `${context.companyId}/delivery-notes/${noteId}/${randomUUID()}-${safeName}`;

    const { error: insertError } = await supabase.from("delivery_notes").insert({
      id: noteId,
      company_id: context.companyId,
      storage_path: storagePath,
      file_name: safeName,
      content_type: photo.type,
      status: "uploaded",
      created_by: context.userId
    });
    if (insertError) throw new SafeActionError("Lieferschein konnte nicht angelegt werden. Ist die Migration eingespielt?");

    const { error: uploadError } = await supabase.storage.from("delivery-notes").upload(storagePath, photo, {
      contentType: photo.type,
      upsert: false
    });
    if (uploadError) throw new SafeActionError("Lieferschein-Foto konnte nicht gespeichert werden.");

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage.from("delivery-notes").createSignedUrl(storagePath, 600);
    if (signedUrlError || !signedUrlData?.signedUrl) {
      throw new SafeActionError("Lieferschein-Foto konnte nicht fuer die Erkennung vorbereitet werden.");
    }

    const recognition = await recognizeDeliveryNoteFromImage(signedUrlData.signedUrl);
    if (!recognition.ok) {
      await supabase
        .from("delivery_notes")
        .update({
          notes: recognition.message,
          recognition_model: recognition.model ?? null
        })
        .eq("id", noteId)
        .eq("company_id", context.companyId);
      throw new SafeActionError(recognition.message);
    }

    const supplierId = await findOrCreateSupplier({ supabase, context, supplierName: recognition.data.supplier_name });
    await ensureDefaultInventoryLocations(supabase, context.companyId);
    const { data: locations } = await supabase
      .from("inventory_locations")
      .select(inventoryLocationSelect)
      .eq("company_id", context.companyId)
      .eq("active", true)
      .order("created_at", { ascending: true });
    const defaultLocation = ((locations ?? []) as InventoryLocation[]).find((location) => location.location_type === "Hauptlager") ?? locations?.[0];

    await supabase
      .from("delivery_notes")
      .update({
        supplier_id: supplierId,
        supplier_name: recognition.data.supplier_name,
        document_date: dateValue(recognition.data.document_date),
        status: "recognized",
        recognition_model: recognition.model,
        recognition_confidence: recognition.data.confidence,
        recognized_json: recognition.data,
        notes: recognition.data.warnings.length > 0 ? recognition.data.warnings.join("\n") : null
      })
      .eq("id", noteId)
      .eq("company_id", context.companyId);

    for (const item of recognition.data.items) {
      const inventoryItemId = await findMatchingInventoryItem({
        supabase,
        companyId: context.companyId,
        articleName: item.article_name,
        articleNumber: item.article_number
      });

      const { data: insertedItem } = await supabase
        .from("delivery_note_items")
        .insert({
          company_id: context.companyId,
          delivery_note_id: noteId,
          inventory_item_id: inventoryItemId,
          supplier_article_number: item.article_number,
          article_name: item.article_name,
          quantity: item.quantity ?? 1,
          unit: item.unit ?? "Stueck",
          target_location_id: defaultLocation?.id ?? null,
          recognition_confidence: item.confidence
        })
        .select("id")
        .maybeSingle();

      if (insertedItem?.id && context.canManage) {
        await supabase.from("delivery_note_item_prices").insert({
          company_id: context.companyId,
          delivery_note_item_id: insertedItem.id,
          unit_price: item.unit_price,
          total_price: item.total_price,
          currency: "EUR"
        });
      }
    }

    target = `/materials/delivery-notes/${noteId}?success=${toQuery("Lieferschein wurde erkannt. Bitte prüfen und bestätigen.")}`;
  } catch (error) {
    target = `${returnTo}?error=${toQuery(safeErrorMessage(error, "Lieferschein konnte nicht erkannt werden."))}`;
  }

  revalidateDeliveryNoteRoutes(context.companyId);
  redirect(target);
}

export async function confirmDeliveryNoteAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const noteId = requiredFormUuid(formData, "delivery_note_id", "Lieferschein");
  const returnTo = redirectTarget(formData, `/materials/delivery-notes/${noteId}`);
  let target = returnTo;

  try {
    ensureOperator(context);
    const { data: note } = await supabase
      .from("delivery_notes")
      .select(deliveryNoteSelect)
      .eq("company_id", context.companyId)
      .eq("id", noteId)
      .maybeSingle();
    if (!note) throw new SafeActionError("Lieferschein wurde nicht gefunden.");
    if (note.status === "confirmed") throw new SafeActionError("Dieser Lieferschein ist bereits gebucht.");

    const supplierName = optionalString(formData, "supplier_name");
    const supplierId = await findOrCreateSupplier({ supabase, context, supplierName });
    const documentDate = dateValue(optionalString(formData, "document_date"));

    await supabase
      .from("delivery_notes")
      .update({
        supplier_id: supplierId,
        supplier_name: supplierName,
        document_date: documentDate,
        notes: optionalString(formData, "notes")
      })
      .eq("company_id", context.companyId)
      .eq("id", noteId);

    const rowIds = formArray(formData, "item_row_id");
    const inventoryIds = formArray(formData, "inventory_item_id");
    const articleNames = formArray(formData, "article_name");
    const articleNumbers = formArray(formData, "supplier_article_number");
    const quantities = formArray(formData, "quantity");
    const units = formArray(formData, "unit");
    const locationIds = formArray(formData, "target_location_id");
    const unitPrices = formArray(formData, "unit_price");
    const totalPrices = formArray(formData, "total_price");

    const { data: existingRows } = await supabase
      .from("delivery_note_items")
      .select(deliveryNoteItemSelect)
      .eq("company_id", context.companyId)
      .eq("delivery_note_id", noteId);
    const existingIds = new Set(((existingRows ?? []) as unknown as DeliveryNoteItem[]).map((item) => item.id));

    for (let index = 0; index < articleNames.length; index += 1) {
      const articleName = articleNames[index]?.trim();
      const quantity = numberAt(quantities, index);
      if (!articleName && !quantity) continue;
      if (!articleName || !quantity || quantity <= 0) throw new SafeActionError("Jede Position braucht Artikelname und Menge.");

      const unit = units[index]?.trim() || "Stueck";
      const articleNumber = articleNumbers[index]?.trim() || null;
      const locationId = locationIds[index]?.trim();
      if (!locationId) throw new SafeActionError("Jede Position braucht einen Lagerort.");
      await assertLocation({ supabase, companyId: context.companyId, locationId });

      let inventoryItemId = inventoryIds[index]?.trim() || null;
      const unitPrice = context.canManage ? numberAt(unitPrices, index) : null;
      const totalPrice = context.canManage ? numberAt(totalPrices, index) : null;

      if (inventoryItemId) {
        const { data: inventoryItem } = await supabase
          .from("inventory_items")
          .select("id")
          .eq("company_id", context.companyId)
          .eq("id", inventoryItemId)
          .maybeSingle();
        if (!inventoryItem) throw new SafeActionError("Ein Lagerartikel gehoert nicht zu deiner Firma.");
      } else {
        inventoryItemId = await createInventoryItemForDelivery({
          supabase,
          context,
          locationId,
          supplierId,
          articleName,
          articleNumber,
          unit,
          unitPrice
        });
      }

      const rowId = rowIds[index]?.trim() || null;
      let savedItemId = rowId;
      const payload = {
        inventory_item_id: inventoryItemId,
        supplier_article_number: articleNumber,
        article_name: articleName,
        quantity,
        unit,
        target_location_id: locationId
      };

      if (rowId && existingIds.has(rowId)) {
        const { error } = await supabase
          .from("delivery_note_items")
          .update(payload)
          .eq("company_id", context.companyId)
          .eq("delivery_note_id", noteId)
          .eq("id", rowId);
        if (error) throw new SafeActionError("Lieferscheinposition konnte nicht aktualisiert werden.");
      } else {
        const { data: inserted, error } = await supabase
          .from("delivery_note_items")
          .insert({
            company_id: context.companyId,
            delivery_note_id: noteId,
            ...payload
          })
          .select("id")
          .maybeSingle();
        if (error || !inserted) throw new SafeActionError("Lieferscheinposition konnte nicht ergaenzt werden.");
        savedItemId = inserted.id as string;
      }

      if (context.canManage && savedItemId) {
        await supabase.from("delivery_note_item_prices").upsert(
          {
            company_id: context.companyId,
            delivery_note_item_id: savedItemId,
            unit_price: unitPrice,
            total_price: totalPrice,
            currency: "EUR"
          },
          { onConflict: "delivery_note_item_id" }
        );
      }
    }

    const { error } = await supabase.rpc("confirm_delivery_note", {
      p_company_id: context.companyId,
      p_delivery_note_id: noteId,
      p_actor_id: context.userId
    });
    if (error) throw new SafeActionError("Lieferschein konnte nicht gebucht werden. Pruefe Zuordnung und Mengen.");

    target = `/materials/delivery-notes/${noteId}?success=${toQuery("Lieferschein wurde bestaetigt und ins Lager gebucht.")}`;
  } catch (error) {
    target = `${returnTo}?error=${toQuery(safeErrorMessage(error, "Lieferschein konnte nicht bestaetigt werden."))}`;
  }

  revalidateDeliveryNoteRoutes(context.companyId, noteId);
  redirect(target);
}
