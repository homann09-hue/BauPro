"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bringListTemplates } from "@/lib/bring-list-templates";
import { requireAppContext, requireManager } from "@/lib/auth";
import { checkBringListAvailability } from "@/lib/inventory/check-availability";
import { createOrUpdateMaterialAlert } from "@/lib/inventory/alerts";
import { generatePurchaseSuggestions } from "@/lib/inventory/purchase-suggestions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString, requiredString } from "@/lib/utils";
import type { BringListItemType, JobMaterialRequirement, Order } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function redirectTarget(formData: FormData, fallback = "/bring-lists") {
  const value = String(formData.get("return_to") ?? "");
  return value.startsWith("/") ? value : fallback;
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
    .ilike("name", `%${name}%`)
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
      storage_location: inventory?.inventory_locations?.name ?? null
    });
  }

  if (rows.length > 0) {
    const { error } = await supabase.from("bring_list_items").insert(rows);
    if (error) throw new Error(error.message);
  }
}

export async function createBringListAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  let target = returnTo;

  try {
    const jobId = requiredString(formData, "job_id");
    const { data: job } = await supabase
      .from("jobsites")
      .select("id, name")
      .eq("id", jobId)
      .eq("company_id", context.companyId)
      .single();
    if (!job) throw new Error("Baustelle wurde nicht gefunden.");

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
        assigned_to: optionalString(formData, "assigned_to"),
        vehicle_id: optionalString(formData, "vehicle_id")
      })
      .select("id")
      .single();

    if (error || !list) throw new Error(error?.message ?? "Mitbringliste konnte nicht erstellt werden.");

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
    target = `/bring-lists/${list.id}?success=${toQuery("Mitbringliste wurde erstellt.")}`;
  } catch (error) {
    target = `${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Mitbringliste konnte nicht erstellt werden.")}`;
  }

  revalidatePath("/bring-lists");
  revalidatePath("/dashboard");
  redirect(target);
}

export async function createBringListFromOrderAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const orderId = requiredString(formData, "order_id");
  let target = `/orders/${orderId}`;

  try {
    const { data: orderData } = await supabase
      .from("orders")
      .select("*, jobsites(id, name)")
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .single();
    if (!orderData) throw new Error("Auftrag wurde nicht gefunden.");

    const order = orderData as Order & { jobsites?: { id: string; name: string } | null };
    if (!order.jobsite_id) throw new Error("Auftrag hat keine verknuepfte Baustelle.");

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

    if (error || !list) throw new Error(error?.message ?? "Mitbringliste konnte nicht erstellt werden.");

    const { data: requirements } = await supabase
      .from("job_material_requirements")
      .select("*")
      .eq("order_id", orderId)
      .eq("company_id", context.companyId);

    const materialItems = ((requirements ?? []) as JobMaterialRequirement[]).map((item) => ({
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
    target = `/orders/${orderId}?error=${toQuery(
      error instanceof Error ? error.message : "Mitbringliste konnte nicht erstellt werden."
    )}`;
  }

  revalidatePath("/bring-lists");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dashboard");
  redirect(target);
}

export async function updateBringListItemPackedAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const itemId = requiredString(formData, "item_id");
  const bringListId = requiredString(formData, "bring_list_id");
  const packed = String(formData.get("packed") ?? "") === "true";

  const { error } = await supabase
    .from("bring_list_items")
    .update({
      packed,
      packed_by: packed ? context.userId : null,
      packed_at: packed ? new Date().toISOString() : null
    })
    .eq("id", itemId)
    .eq("bring_list_id", bringListId);

  if (error) redirect(`/bring-lists/${bringListId}?error=${toQuery(error.message)}`);

  await checkBringListAvailability({ supabase, companyId: context.companyId, bringListId });
  revalidatePath(`/bring-lists/${bringListId}`);
  redirect(`/bring-lists/${bringListId}?success=${toQuery(packed ? "Position eingepackt." : "Position wieder offen.")}`);
}

export async function updateBringListStatusAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const bringListId = requiredString(formData, "bring_list_id");
  const status = String(formData.get("status") ?? "ready");
  if (!["draft", "ready", "packed", "delivered"].includes(status)) {
    redirect(`/bring-lists/${bringListId}?error=${toQuery("Ungueltiger Status.")}`);
  }

  const { error } = await supabase.from("bring_lists").update({ status }).eq("id", bringListId).eq("company_id", context.companyId);
  if (error) redirect(`/bring-lists/${bringListId}?error=${toQuery(error.message)}`);

  revalidatePath("/bring-lists");
  revalidatePath(`/bring-lists/${bringListId}`);
  redirect(`/bring-lists/${bringListId}?success=${toQuery("Status wurde gespeichert.")}`);
}

export async function reportMissingBringListItemAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const bringListId = requiredString(formData, "bring_list_id");
  const itemId = requiredString(formData, "item_id");

  const { data: item } = await supabase
    .from("bring_list_items")
    .select("*, bring_lists(company_id, job_id)")
    .eq("id", itemId)
    .eq("bring_list_id", bringListId)
    .single();

  if (!item) redirect(`/bring-lists/${bringListId}?error=${toQuery("Position wurde nicht gefunden.")}`);

  await supabase.from("bring_list_items").update({ missing_reported: true }).eq("id", itemId);
  const list = item.bring_lists as { job_id?: string | null } | null;
  await createOrUpdateMaterialAlert({
    supabase,
    companyId: context.companyId,
    materialId: item.material_id as string | null,
    inventoryItemId: item.inventory_item_id as string | null,
    jobId: list?.job_id ?? null,
    bringListId,
    alertType: "missing_for_job",
    severity: "critical",
    message: `Mitarbeiter meldet fehlend: ${item.custom_item_name}`,
    requiredQuantity: Number(item.quantity ?? 0),
    availableQuantity: 0,
    missingQuantity: Number(item.quantity ?? 0),
    unit: String(item.unit ?? "Stueck"),
    createdBySystem: false
  });

  await generatePurchaseSuggestions({
    supabase,
    companyId: context.companyId,
    materialId: item.material_id as string | null,
    inventoryItemId: item.inventory_item_id as string | null,
    jobId: list?.job_id ?? null,
    bringListId,
    quantityNeeded: Number(item.quantity ?? 0),
    unit: String(item.unit ?? "Stueck"),
    reason: `Mitarbeiter meldet fehlendes Material: ${item.custom_item_name}`
  });

  revalidatePath(`/bring-lists/${bringListId}`);
  revalidatePath("/dashboard");
  redirect(`/bring-lists/${bringListId}?success=${toQuery("Fehlendes Material wurde dem Chef gemeldet.")}`);
}

export async function reserveBringListMaterialsAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const bringListId = requiredString(formData, "bring_list_id");

  await checkBringListAvailability({
    supabase,
    companyId: context.companyId,
    bringListId,
    reserve: true,
    reservedBy: context.userId
  });

  revalidatePath(`/bring-lists/${bringListId}`);
  revalidatePath("/dashboard");
  redirect(`/bring-lists/${bringListId}?success=${toQuery("Material wurde reserviert und geprueft.")}`);
}

export async function updatePurchaseSuggestionStatusAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");
  const status = String(formData.get("status") ?? "open");
  if (!["open", "ordered", "ignored", "received"].includes(status)) {
    redirect(`/dashboard?error=${toQuery("Ungueltiger Einkaufsvorschlag-Status.")}`);
  }

  const { error } = await supabase
    .from("purchase_suggestions")
    .update({ status })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) redirect(`/dashboard?error=${toQuery(error.message)}`);

  revalidatePath("/dashboard");
  redirect(`/dashboard?success=${toQuery("Einkaufsvorschlag wurde aktualisiert.")}`);
}
