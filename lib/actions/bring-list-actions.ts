"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureAutomaticBringListsForDate } from "@/lib/bring-lists/auto-generate";
import { bringListTemplates } from "@/lib/bring-list-templates";
import { requireAppContext, requireManager } from "@/lib/auth";
import {
  bringListItemSelect,
  jobMaterialRequirementPublicSelect,
  orderBringListSourceSelect
} from "@/lib/data/selects";
import { searchOrFilter } from "@/lib/data/shared";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { checkBringListAvailability } from "@/lib/inventory/check-availability";
import { createOrUpdateMaterialAlert } from "@/lib/inventory/alerts";
import { generatePurchaseSuggestions } from "@/lib/inventory/purchase-suggestions";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { optionalFormUuid, requiredFormUuid } from "@/lib/security/form-data";
import { safeReturnPath } from "@/lib/security/redirects";
import { assertBringListAccess, assertJobsiteInCompany, assertProfilesInCompany, assertVehicleInCompany } from "@/lib/security/tenant-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString, requiredString } from "@/lib/utils";
import type { BringListItem, BringListItemType, JobMaterialRequirement, OrderType } from "@/types/app";

type OrderBringListSource = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  title: string;
  order_type: OrderType;
  jobsites?: { id: string; name: string } | null;
};

function redirectTarget(formData: FormData, fallback = "/bring-lists") {
  return safeReturnPath(formData.get("return_to"), fallback);
}

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function itemTypeValue(value: FormDataEntryValue | null): BringListItemType {
  const itemType = String(value ?? "material");
  return ["material", "tool", "document", "safety", "other"].includes(itemType) ? (itemType as BringListItemType) : "other";
}

function numberValue(value: FormDataEntryValue | null, fallback = 1) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function findInventoryItemByName({
  supabase,
  companyId,
  name
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  name: string;
}) {
  const { data } = await supabase
    .from("inventory_items")
    .select("id, name, unit, location_id, stock, minimum_stock, inventory_locations(id, name, location_type)")
    .eq("company_id", companyId)
    .or(searchOrFilter(["name"], name))
    .order("stock", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as
    | {
        id: string;
        name: string;
        unit: string;
        inventory_locations?: { name?: string | null } | null;
      }
    | null;
}

async function logBringListAudit({
  supabase,
  context,
  bringListId,
  action,
  oldValues,
  newValues
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  context: Awaited<ReturnType<typeof requireAppContext>>;
  bringListId: string;
  action: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}) {
  await supabase.from("bring_list_audit_log").insert({
    company_id: context.companyId,
    bring_list_id: bringListId,
    actor_id: context.userId,
    action,
    old_values: oldValues ?? null,
    new_values: newValues ?? null
  });
}

async function insertBringListItems({
  supabase,
  companyId,
  bringListId,
  items
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  bringListId: string;
  items: Array<{ name: string; quantity: number; unit: string; itemType: BringListItemType }>;
}) {
  const rows = [];
  for (const item of items.filter((row) => row.name.trim())) {
    const inventory = item.itemType === "material" ? await findInventoryItemByName({ supabase, companyId, name: item.name }) : null;
    rows.push({
      bring_list_id: bringListId,
      inventory_item_id: inventory?.id ?? null,
      custom_item_name: inventory?.name ?? item.name.trim(),
      item_type: item.itemType,
      quantity: item.quantity,
      unit: inventory?.unit ?? item.unit,
      storage_location: inventory?.inventory_locations?.name ?? null,
      auto_generated: false,
      source_type: "manual"
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("bring_list_items").insert(rows);
    if (error) throw new SafeActionError("Positionen konnten nicht gespeichert werden.");
  }
}

async function resolveBringListAssignment({
  supabase,
  context,
  formData
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  context: Awaited<ReturnType<typeof requireAppContext>>;
  formData: FormData;
}) {
  if (!context.canManage) {
    return { assigned_to: context.userId, vehicle_id: null };
  }

  const assignedTo = optionalFormUuid(formData, "assigned_to", "Mitarbeiter");
  const vehicleId = optionalFormUuid(formData, "vehicle_id", "Fahrzeug");

  if (assignedTo) {
    await assertProfilesInCompany({
      supabase,
      companyId: context.companyId,
      profileIds: [assignedTo],
      allowedRoles: ["vorarbeiter", "mitarbeiter"]
    });
  }

  await assertVehicleInCompany({ supabase, companyId: context.companyId, vehicleId });
  return { assigned_to: assignedTo, vehicle_id: vehicleId };
}

export async function createBringListAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  let target = returnTo;

  try {
    const jobId = requiredFormUuid(formData, "job_id", "Baustelle");
    await assertJobsiteInCompany({ supabase, context, jobsiteId: jobId });
    const { assigned_to, vehicle_id } = await resolveBringListAssignment({ supabase, context, formData });
    const { data: job } = await supabase.from("jobsites").select("id, name").eq("id", jobId).eq("company_id", context.companyId).single();
    if (!job) throw new SafeActionError("Baustelle wurde nicht gefunden.");

    const { data: list, error } = await supabase
      .from("bring_lists")
      .insert({
        company_id: context.companyId,
        job_id: jobId,
        date: requiredString(formData, "date"),
        title: optionalString(formData, "title") ?? `Mitbringliste ${job.name}`,
        notes: optionalString(formData, "notes"),
        status: context.canManage ? "ready" : "draft",
        created_by: context.userId,
        assigned_to,
        vehicle_id
      })
      .select("id")
      .single();

    if (error || !list) throw new SafeActionError("Mitbringliste konnte nicht erstellt werden.");

    const names = formData.getAll("item_name");
    const quantities = formData.getAll("item_quantity");
    const units = formData.getAll("item_unit");
    const types = formData.getAll("item_type");
    await insertBringListItems({
      supabase,
      companyId: context.companyId,
      bringListId: list.id as string,
      items: names.map((name, index) => ({
        name: String(name ?? ""),
        quantity: numberValue(quantities[index] ?? null),
        unit: String(units[index] ?? "Stueck") || "Stueck",
        itemType: itemTypeValue(types[index] ?? null)
      }))
    });

    await checkBringListAvailability({ supabase, companyId: context.companyId, bringListId: list.id as string });
    await logBringListAudit({
      supabase,
      context,
      bringListId: list.id as string,
      action: "created_manual",
      newValues: { item_count: names.length }
    });
    target = `/bring-lists/${list.id}?success=${toQuery("Mitbringliste wurde erstellt.")}`;
  } catch (error) {
    target = `${returnTo}?error=${toQuery(safeErrorMessage(error, "Mitbringliste konnte nicht erstellt werden."))}`;
  }

  revalidatePath("/bring-lists");
  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(target);
}

export async function createBringListFromOrderAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  let target = `/orders/${orderId}`;

  try {
    const { data: orderData } = await supabase
      .from("orders")
      .select(orderBringListSourceSelect)
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .single();
    if (!orderData) throw new SafeActionError("Auftrag wurde nicht gefunden.");

    const order = orderData as unknown as OrderBringListSource;
    if (!order.jobsite_id) throw new SafeActionError("Auftrag hat keine verknuepfte Baustelle.");

    const { data: list, error } = await supabase
      .from("bring_lists")
      .insert({
        company_id: context.companyId,
        job_id: order.jobsite_id,
        date: tomorrowIsoDate(),
        title: `Mitbringliste fuer ${order.title}`,
        notes: "Automatisch aus Auftrag erstellt.",
        status: "ready",
        created_by: context.userId
      })
      .select("id")
      .single();

    if (error || !list) throw new SafeActionError("Mitbringliste konnte nicht erstellt werden.");

    const { data: requirements } = await supabase
      .from("job_material_requirements")
      .select(jobMaterialRequirementPublicSelect)
      .eq("order_id", orderId)
      .eq("company_id", context.companyId)
      .is("archived_at", null);

    const materialItems = ((requirements ?? []) as unknown as JobMaterialRequirement[]).map((item) => ({
      name: item.material_name,
      quantity: Number(item.total_quantity),
      unit: item.unit,
      itemType: "material" as const
    }));
    const templateItems = bringListTemplates[order.order_type].map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      itemType: item.itemType
    }));

    await insertBringListItems({
      supabase,
      companyId: context.companyId,
      bringListId: list.id as string,
      items: [...materialItems, ...templateItems]
    });

    await checkBringListAvailability({ supabase, companyId: context.companyId, bringListId: list.id as string });
    target = `/bring-lists/${list.id}?success=${toQuery("Mitbringliste fuer morgen wurde erstellt.")}`;
  } catch (error) {
    target = `/orders/${orderId}?error=${toQuery(safeErrorMessage(error, "Mitbringliste konnte nicht erstellt werden."))}`;
  }

  revalidatePath("/bring-lists");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(target);
}

export async function updateBringListItemPackedAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const itemId = requiredFormUuid(formData, "item_id", "Position");
  const bringListId = requiredFormUuid(formData, "bring_list_id", "Mitbringliste");
  const packed = String(formData.get("packed") ?? "") === "true";

  try {
    await assertBringListAccess({ supabase, context, bringListId });

    const { data, error } = await supabase
      .from("bring_list_items")
      .update({
        packed,
        packed_by: packed ? context.userId : null,
        packed_at: packed ? new Date().toISOString() : null
      })
      .eq("id", itemId)
      .eq("bring_list_id", bringListId)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Position konnte nicht aktualisiert werden.");

    await checkBringListAvailability({ supabase, companyId: context.companyId, bringListId });
    await logBringListAudit({
      supabase,
      context,
      bringListId,
      action: packed ? "item_packed" : "item_reopened",
      newValues: { item_id: itemId, packed }
    });
  } catch (error) {
    redirect(`/bring-lists/${bringListId}?error=${toQuery(safeErrorMessage(error, "Position konnte nicht aktualisiert werden."))}`);
  }

  revalidatePath(`/bring-lists/${bringListId}`);
  revalidateDashboardCache(context.companyId);
  redirect(`/bring-lists/${bringListId}?success=${toQuery(packed ? "Position eingepackt." : "Position wieder offen.")}`);
}

export async function updateBringListStatusAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const bringListId = requiredFormUuid(formData, "bring_list_id", "Mitbringliste");
  const status = String(formData.get("status") ?? "ready");
  if (!["draft", "ready", "packed", "delivered"].includes(status)) {
    redirect(`/bring-lists/${bringListId}?error=${toQuery("Ungueltiger Status.")}`);
  }

  try {
    await assertBringListAccess({ supabase, context, bringListId });
    const { data, error } = await supabase
      .from("bring_lists")
      .update({ status })
      .eq("id", bringListId)
      .eq("company_id", context.companyId)
      .select("id")
      .maybeSingle();
    if (error || !data) throw new SafeActionError("Status konnte nicht gespeichert werden.");
    await logBringListAudit({
      supabase,
      context,
      bringListId,
      action: "status_changed",
      newValues: { status }
    });
  } catch (error) {
    redirect(`/bring-lists/${bringListId}?error=${toQuery(safeErrorMessage(error, "Status konnte nicht gespeichert werden."))}`);
  }

  revalidatePath("/bring-lists");
  revalidatePath(`/bring-lists/${bringListId}`);
  revalidateDashboardCache(context.companyId);
  redirect(`/bring-lists/${bringListId}?success=${toQuery("Status wurde gespeichert.")}`);
}

export async function reportMissingBringListItemAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const bringListId = requiredFormUuid(formData, "bring_list_id", "Mitbringliste");
  const itemId = requiredFormUuid(formData, "item_id", "Position");

  try {
    const list = await assertBringListAccess({ supabase, context, bringListId });

    const { data: item } = await supabase
      .from("bring_list_items")
      .select(bringListItemSelect)
      .eq("id", itemId)
      .eq("bring_list_id", bringListId)
      .single();

    if (!item) throw new SafeActionError("Position wurde nicht gefunden.");
    const typedItem = item as unknown as BringListItem;

    const { data: updatedItem, error: updateError } = await supabase
      .from("bring_list_items")
      .update({ missing_reported: true })
      .eq("id", itemId)
      .eq("bring_list_id", bringListId)
      .select("id")
      .maybeSingle();
    if (updateError || !updatedItem) throw new SafeActionError("Fehlmeldung konnte nicht gespeichert werden.");

    await createOrUpdateMaterialAlert({
      supabase,
      companyId: context.companyId,
      materialId: typedItem.material_id,
      inventoryItemId: typedItem.inventory_item_id,
      jobId: list.job_id ?? null,
      bringListId,
      alertType: "missing_for_job",
      severity: "critical",
      message: `Mitarbeiter meldet fehlend: ${typedItem.custom_item_name}`,
      requiredQuantity: Number(typedItem.quantity ?? 0),
      availableQuantity: 0,
      missingQuantity: Number(typedItem.quantity ?? 0),
      unit: typedItem.unit,
      createdBySystem: false
    });

    await generatePurchaseSuggestions({
      supabase,
      companyId: context.companyId,
      materialId: typedItem.material_id,
      inventoryItemId: typedItem.inventory_item_id,
      jobId: list.job_id ?? null,
      bringListId,
      quantityNeeded: Number(typedItem.quantity ?? 0),
      unit: typedItem.unit,
      reason: `Mitarbeiter meldet fehlendes Material: ${typedItem.custom_item_name}`
    });
    await logBringListAudit({
      supabase,
      context,
      bringListId,
      action: "missing_reported",
      newValues: { item_id: itemId, item_name: typedItem.custom_item_name }
    });
  } catch (error) {
    redirect(`/bring-lists/${bringListId}?error=${toQuery(safeErrorMessage(error, "Fehlendes Material konnte nicht gemeldet werden."))}`);
  }

  revalidatePath(`/bring-lists/${bringListId}`);
  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(`/bring-lists/${bringListId}?success=${toQuery("Fehlendes Material wurde dem Chef gemeldet.")}`);
}

export async function reserveBringListMaterialsAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const bringListId = requiredFormUuid(formData, "bring_list_id", "Mitbringliste");

  try {
    await assertBringListAccess({ supabase, context, bringListId });
    await checkBringListAvailability({
      supabase,
      companyId: context.companyId,
      bringListId,
      reserve: true,
      reservedBy: context.userId
    });
  } catch (error) {
    redirect(`/bring-lists/${bringListId}?error=${toQuery(safeErrorMessage(error, "Material konnte nicht reserviert werden."))}`);
  }

  revalidatePath(`/bring-lists/${bringListId}`);
  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(`/bring-lists/${bringListId}?success=${toQuery("Material wurde reserviert und geprueft.")}`);
}

export async function syncAutomaticBringListsAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  const dateValue = String(formData.get("date") ?? tomorrowIsoDate());
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue) ? dateValue : tomorrowIsoDate();
  let target = returnTo;

  if (!context.canOperate) {
    redirect(`${returnTo}?error=${toQuery("Keine Berechtigung fuer automatische Mitbringlisten.")}`);
  }

  try {
    const result = await ensureAutomaticBringListsForDate({ supabase, context, date });
    target = `${returnTo}?success=${toQuery(
      `Mitbringlisten aktualisiert: ${result.created} neu, ${result.updated} aktualisiert, ${result.checked} geprueft.`
    )}`;
  } catch (error) {
    target = `${returnTo}?error=${toQuery(safeErrorMessage(error, "Automatische Mitbringlisten konnten nicht aktualisiert werden."))}`;
  }

  revalidatePath("/bring-lists");
  revalidatePath("/bring-lists/tomorrow");
  revalidatePath("/morgen");
  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(target);
}

export async function addBringListItemAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const bringListId = requiredFormUuid(formData, "bring_list_id", "Mitbringliste");
  const returnTo = redirectTarget(formData, `/bring-lists/${bringListId}`);
  let target = returnTo;

  try {
    await assertBringListAccess({ supabase, context, bringListId });
    const name = requiredString(formData, "item_name");
    const itemType = itemTypeValue(formData.get("item_type"));
    const quantity = numberValue(formData.get("item_quantity"));
    const unit = optionalString(formData, "item_unit") ?? "Stueck";
    const notes = optionalString(formData, "item_notes");
    const inventory = itemType === "material" ? await findInventoryItemByName({ supabase, companyId: context.companyId, name }) : null;

    const { data, error } = await supabase
      .from("bring_list_items")
      .insert({
        bring_list_id: bringListId,
        inventory_item_id: inventory?.id ?? null,
        custom_item_name: inventory?.name ?? name,
        item_type: itemType,
        quantity,
        unit: inventory?.unit ?? unit,
        storage_location: inventory?.inventory_locations?.name ?? null,
        notes,
        auto_generated: false,
        source_type: "manual"
      })
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Position konnte nicht ergaenzt werden.");

    await checkBringListAvailability({ supabase, companyId: context.companyId, bringListId });
    await logBringListAudit({
      supabase,
      context,
      bringListId,
      action: "item_added_manual",
      newValues: { item_id: data.id as string, item_name: inventory?.name ?? name, item_type: itemType }
    });

    target = `${returnTo}?success=${toQuery("Position wurde ergaenzt.")}`;
  } catch (error) {
    target = `${returnTo}?error=${toQuery(safeErrorMessage(error, "Position konnte nicht ergaenzt werden."))}`;
  }

  revalidatePath(`/bring-lists/${bringListId}`);
  revalidatePath("/bring-lists");
  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(target);
}

export async function updatePurchaseSuggestionStatusAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Einkaufsvorschlag");
  const status = String(formData.get("status") ?? "open");
  if (!["open", "ordered", "ignored", "received"].includes(status)) {
    redirect(`/dashboard?error=${toQuery("Ungueltiger Einkaufsvorschlag-Status.")}`);
  }

  const { data, error } = await supabase
    .from("purchase_suggestions")
    .update({ status })
    .eq("id", id)
    .eq("company_id", context.companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) redirect(`/dashboard?error=${toQuery("Einkaufsvorschlag konnte nicht aktualisiert werden.")}`);

  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(`/dashboard?success=${toQuery("Einkaufsvorschlag wurde aktualisiert.")}`);
}
