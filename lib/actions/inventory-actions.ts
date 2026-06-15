"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { ensureDefaultInventoryLocations, toInventoryLocationType } from "@/lib/inventory";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { requiredFormUuid } from "@/lib/security/form-data";
import { assertSupplierInCompany } from "@/lib/security/tenant-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { numberOrZero, optionalNumber, optionalString, requiredString } from "@/lib/utils";
import type { InventoryItem, MaterialCatalogItem } from "@/types/app";

function redirectTarget(formData: FormData, fallback = "/materials/inventory") {
  const value = String(formData.get("return_to") ?? "");
  return value.startsWith("/") ? value : fallback;
}

function positiveNumber(formData: FormData, key: string) {
  const value = numberOrZero(formData, key);
  if (value <= 0) {
    throw new SafeActionError("Die Menge muss groesser als 0 sein.");
  }

  return value;
}

function inventoryModeValue(value: FormDataEntryValue | null) {
  const mode = String(value ?? "increase");
  return mode === "increase" || mode === "decrease" || mode === "set" ? mode : "increase";
}

function revalidateMaterialRoutes() {
  revalidatePath("/materials");
  revalidatePath("/materials/catalog");
  revalidatePath("/materials/inventory");
  revalidatePath("/materials/locations");
  revalidatePath("/materials/low-stock");
  revalidatePath("/materials/import");
  revalidatePath("/dashboard");
}

async function assertCompanyLocation(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  locationId: string
) {
  const { data } = await supabase
    .from("inventory_locations")
    .select("id")
    .eq("company_id", companyId)
    .eq("id", locationId)
    .eq("active", true)
    .maybeSingle();

  return Boolean(data);
}

async function findOrCreateSupplier(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  supplierName: string | null
) {
  if (!supplierName) return null;

  const { data: existing } = await supabase
    .from("suppliers")
    .select("id")
    .eq("company_id", companyId)
    .ilike("name", supplierName)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: inserted } = await supabase
    .from("suppliers")
    .insert({
      company_id: companyId,
      name: supplierName
    })
    .select("id")
    .single();

  return (inserted?.id as string | undefined) ?? null;
}

export async function addCatalogItemToInventoryAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  await ensureDefaultInventoryLocations(supabase, context.companyId);

  const returnTo = redirectTarget(formData, "/materials/catalog");
  const catalogItemId = requiredString(formData, "catalog_item_id");
  const locationId = requiredString(formData, "location_id");
  const stock = numberOrZero(formData, "stock");
  const minimumStock = numberOrZero(formData, "minimum_stock");

  try {
    if (!(await assertCompanyLocation(supabase, context.companyId, locationId))) {
      throw new SafeActionError("Der Lagerort gehoert nicht zu deiner Firma.");
    }

    const { data: catalogItem, error: catalogError } = await supabase
      .from("material_catalog")
      .select("*")
      .eq("id", catalogItemId)
      .eq("active", true)
      .single();

    if (catalogError || !catalogItem) {
      throw new SafeActionError("Katalogartikel wurde nicht gefunden.");
    }

    const item = catalogItem as MaterialCatalogItem;
    const supplierId = await findOrCreateSupplier(
      supabase,
      context.companyId,
      optionalString(formData, "supplier_name")
    );

    const { data: existing } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("company_id", context.companyId)
      .eq("catalog_item_id", item.id)
      .eq("location_id", locationId)
      .maybeSingle();

    const payload = {
      company_id: context.companyId,
      catalog_item_id: item.id,
      category_id: item.category_id,
      subcategory_id: item.subcategory_id,
      location_id: locationId,
      supplier_id: supplierId,
      name: item.name,
      unit: item.unit,
      stock: existing ? Number((existing as InventoryItem).stock) + stock : stock,
      minimum_stock: minimumStock,
      package_unit: item.package_unit,
      manufacturer: item.manufacturer,
      article_number: item.article_number,
      ean: item.ean,
      purchase_price: optionalNumber(formData, "purchase_price") ?? item.purchase_price,
      sales_price: item.sales_price,
      notes: optionalString(formData, "notes"),
      created_by: context.userId
    };

    const result = existing
      ? await supabase
          .from("inventory_items")
          .update(payload)
          .eq("id", (existing as InventoryItem).id)
          .eq("company_id", context.companyId)
      : await supabase.from("inventory_items").insert(payload);

    if (result.error) {
      throw new SafeActionError("Material konnte nicht uebernommen werden.");
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Material konnte nicht uebernommen werden."))}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Material ist jetzt im Lager.")}`);
}

export async function createCustomInventoryItemAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  await ensureDefaultInventoryLocations(supabase, context.companyId);

  const returnTo = redirectTarget(formData);
  const locationId = requiredString(formData, "location_id");

  try {
    if (!(await assertCompanyLocation(supabase, context.companyId, locationId))) {
      throw new SafeActionError("Der Lagerort gehoert nicht zu deiner Firma.");
    }

    const { error } = await supabase.from("inventory_items").insert({
      company_id: context.companyId,
      location_id: locationId,
      name: requiredString(formData, "name"),
      unit: requiredString(formData, "unit"),
      stock: numberOrZero(formData, "stock"),
      minimum_stock: numberOrZero(formData, "minimum_stock"),
      package_unit: optionalString(formData, "package_unit"),
      manufacturer: optionalString(formData, "manufacturer"),
      article_number: optionalString(formData, "article_number"),
      purchase_price: optionalNumber(formData, "purchase_price"),
      sales_price: optionalNumber(formData, "sales_price"),
      notes: optionalString(formData, "notes"),
      created_by: context.userId
    });

    if (error) {
      throw new SafeActionError("Material konnte nicht angelegt werden.");
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Material konnte nicht angelegt werden."))}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Eigenes Material wurde angelegt.")}`);
}

export async function adjustInventoryStockAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);

  try {
    const itemId = requiredFormUuid(formData, "item_id", "Material");
    const mode = inventoryModeValue(formData.get("mode"));
    const amount = mode === "set" ? numberOrZero(formData, "amount") : positiveNumber(formData, "amount");
    const { error } = await supabase.rpc("adjust_inventory_stock", {
      p_company_id: context.companyId,
      p_item_id: itemId,
      p_mode: mode,
      p_amount: amount,
      p_actor_id: context.userId
    });

    if (error) throw new SafeActionError("Bestand konnte nicht gebucht werden.");
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Bestand konnte nicht gebucht werden."))}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Bestand wurde aktualisiert.")}`);
}

export async function transferInventoryAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);

  try {
    const sourceItemId = requiredFormUuid(formData, "source_item_id", "Quellmaterial");
    const targetLocationId = requiredFormUuid(formData, "target_location_id", "Ziel-Lagerort");
    const amount = positiveNumber(formData, "amount");

    if (!(await assertCompanyLocation(supabase, context.companyId, targetLocationId))) {
      throw new SafeActionError("Der Ziel-Lagerort gehoert nicht zu deiner Firma.");
    }

    const { error } = await supabase.rpc("transfer_inventory_item", {
      p_company_id: context.companyId,
      p_source_item_id: sourceItemId,
      p_target_location_id: targetLocationId,
      p_amount: amount,
      p_actor_id: context.userId
    });

    if (error) throw new SafeActionError("Umlagerung konnte nicht gebucht werden.");
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Umlagerung konnte nicht gebucht werden."))}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Material wurde umgelagert.")}`);
}

export async function createInventoryLocationAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData, "/materials/locations");

  const { error } = await supabase.from("inventory_locations").insert({
    company_id: context.companyId,
    name: requiredString(formData, "name"),
    location_type: toInventoryLocationType(formData.get("location_type")),
    notes: optionalString(formData, "notes")
  });

  if (error) {
    redirect(`${returnTo}?error=${toQuery("Lagerort konnte nicht angelegt werden.")}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Lagerort wurde angelegt.")}`);
}

export async function updateInventoryLocationAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData, "/materials/locations");
  const id = requiredString(formData, "location_id");

  const { error } = await supabase
    .from("inventory_locations")
    .update({
      name: requiredString(formData, "name"),
      location_type: toInventoryLocationType(formData.get("location_type")),
      notes: optionalString(formData, "notes"),
      active: String(formData.get("active") ?? "true") === "true"
    })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`${returnTo}?error=${toQuery("Lagerort konnte nicht aktualisiert werden.")}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Lagerort wurde aktualisiert.")}`);
}

export async function deactivateInventoryLocationAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData, "/materials/locations");
  const id = requiredString(formData, "location_id");

  const { error } = await supabase
    .from("inventory_locations")
    .update({ active: false })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`${returnTo}?error=${toQuery("Lagerort konnte nicht deaktiviert werden.")}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Lagerort wurde deaktiviert.")}`);
}

export async function updateInventoryPricingAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  const purchasePrice = optionalNumber(formData, "purchase_price");
  const markupPercent = optionalNumber(formData, "markup_percent") ?? 0;
  const manualSalesPrice = optionalNumber(formData, "sales_price");
  const autoSalesPrice =
    purchasePrice === null ? null : Math.round(purchasePrice * (1 + Math.max(markupPercent, 0) / 100) * 100) / 100;
  const shouldAutoCalculate = String(formData.get("auto_calculate_sales_price") ?? "off") === "on";
  const supplierId = optionalString(formData, "supplier_id");

  try {
    const id = requiredFormUuid(formData, "item_id", "Material");
    await assertSupplierInCompany({ supabase, companyId: context.companyId, supplierId });

    const { error } = await supabase
      .from("inventory_items")
      .update({
        purchase_price: purchasePrice,
        markup_percent: Math.max(markupPercent, 0),
        sales_price: shouldAutoCalculate ? autoSalesPrice : manualSalesPrice,
        sales_unit: optionalString(formData, "sales_unit"),
        price_per_unit: optionalNumber(formData, "price_per_unit"),
        supplier_id: supplierId,
        last_price_changed_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("company_id", context.companyId);

    if (error) throw new SafeActionError("Preise konnten nicht aktualisiert werden.");
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Preise konnten nicht aktualisiert werden."))}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Preise wurden aktualisiert.")}`);
}
