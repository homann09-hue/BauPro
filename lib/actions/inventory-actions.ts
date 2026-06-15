"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { ensureDefaultInventoryLocations, toInventoryLocationType } from "@/lib/inventory";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { numberOrZero, optionalNumber, optionalString, requiredString } from "@/lib/utils";
import type { InventoryItem, MaterialCatalogItem } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function redirectTarget(formData: FormData, fallback = "/materials/inventory") {
  const value = String(formData.get("return_to") ?? "");
  return value.startsWith("/") ? value : fallback;
}

function positiveNumber(formData: FormData, key: string) {
  const value = numberOrZero(formData, key);
  if (value <= 0) {
    throw new Error("Die Menge muss groesser als 0 sein.");
  }

  return value;
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
      throw new Error("Der Lagerort gehoert nicht zu deiner Firma.");
    }

    const { data: catalogItem, error: catalogError } = await supabase
      .from("material_catalog")
      .select("*")
      .eq("id", catalogItemId)
      .eq("active", true)
      .single();

    if (catalogError || !catalogItem) {
      throw new Error("Katalogartikel wurde nicht gefunden.");
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
      throw new Error(result.error.message);
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Material konnte nicht uebernommen werden.")}`);
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
      throw new Error("Der Lagerort gehoert nicht zu deiner Firma.");
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
      throw new Error(error.message);
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Material konnte nicht angelegt werden.")}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Eigenes Material wurde angelegt.")}`);
}

export async function adjustInventoryStockAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  const itemId = requiredString(formData, "item_id");
  const mode = String(formData.get("mode") ?? "increase");

  try {
    const amount = mode === "set" ? numberOrZero(formData, "amount") : positiveNumber(formData, "amount");
    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", itemId)
      .eq("company_id", context.companyId)
      .single();

    if (error || !data) {
      throw new Error("Material wurde nicht gefunden.");
    }

    const item = data as InventoryItem;
    const currentStock = Number(item.stock);
    const nextStock =
      mode === "decrease" ? currentStock - amount : mode === "set" ? amount : currentStock + amount;

    if (nextStock < 0) {
      throw new Error("Der Bestand darf nicht negativ werden.");
    }

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({ stock: nextStock })
      .eq("id", item.id)
      .eq("company_id", context.companyId);

    if (updateError) {
      throw new Error(updateError.message);
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Bestand konnte nicht gebucht werden.")}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Bestand wurde aktualisiert.")}`);
}

export async function transferInventoryAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  const sourceItemId = requiredString(formData, "source_item_id");
  const targetLocationId = requiredString(formData, "target_location_id");

  try {
    const amount = positiveNumber(formData, "amount");

    if (!(await assertCompanyLocation(supabase, context.companyId, targetLocationId))) {
      throw new Error("Der Ziel-Lagerort gehoert nicht zu deiner Firma.");
    }

    const { data, error } = await supabase
      .from("inventory_items")
      .select("*")
      .eq("id", sourceItemId)
      .eq("company_id", context.companyId)
      .single();

    if (error || !data) {
      throw new Error("Material wurde nicht gefunden.");
    }

    const source = data as InventoryItem;
    if (source.location_id === targetLocationId) {
      throw new Error("Quelle und Ziel duerfen nicht gleich sein.");
    }

    if (Number(source.stock) < amount) {
      throw new Error("Nicht genug Bestand am Quellort.");
    }

    const { error: sourceError } = await supabase
      .from("inventory_items")
      .update({ stock: Number(source.stock) - amount })
      .eq("id", source.id)
      .eq("company_id", context.companyId);

    if (sourceError) {
      throw new Error(sourceError.message);
    }

    let target: InventoryItem | null = null;

    if (source.catalog_item_id) {
      const { data: targetData } = await supabase
        .from("inventory_items")
        .select("*")
        .eq("company_id", context.companyId)
        .eq("catalog_item_id", source.catalog_item_id)
        .eq("location_id", targetLocationId)
        .maybeSingle();

      target = (targetData as InventoryItem | null) ?? null;
    }

    if (target) {
      const { error: targetError } = await supabase
        .from("inventory_items")
        .update({ stock: Number(target.stock) + amount })
        .eq("id", target.id)
        .eq("company_id", context.companyId);

      if (targetError) {
        throw new Error(targetError.message);
      }
    } else {
      const { error: insertError } = await supabase.from("inventory_items").insert({
        company_id: context.companyId,
        catalog_item_id: source.catalog_item_id,
        category_id: source.category_id,
        subcategory_id: source.subcategory_id,
        location_id: targetLocationId,
        supplier_id: source.supplier_id,
        name: source.name,
        unit: source.unit,
        stock: amount,
        minimum_stock: source.minimum_stock,
        package_unit: source.package_unit,
        manufacturer: source.manufacturer,
        article_number: source.article_number,
        ean: source.ean,
        purchase_price: source.purchase_price,
        sales_price: source.sales_price,
        notes: source.notes,
        created_by: context.userId
      });

      if (insertError) {
        throw new Error(insertError.message);
      }
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Umlagerung konnte nicht gebucht werden.")}`);
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
    redirect(`${returnTo}?error=${toQuery(error.message)}`);
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
    redirect(`${returnTo}?error=${toQuery(error.message)}`);
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
    redirect(`${returnTo}?error=${toQuery(error.message)}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Lagerort wurde deaktiviert.")}`);
}

export async function updateInventoryPricingAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  const id = requiredString(formData, "item_id");
  const purchasePrice = optionalNumber(formData, "purchase_price");
  const markupPercent = optionalNumber(formData, "markup_percent") ?? 0;
  const manualSalesPrice = optionalNumber(formData, "sales_price");
  const autoSalesPrice =
    purchasePrice === null ? null : Math.round(purchasePrice * (1 + Math.max(markupPercent, 0) / 100) * 100) / 100;
  const shouldAutoCalculate = String(formData.get("auto_calculate_sales_price") ?? "off") === "on";

  const { error } = await supabase
    .from("inventory_items")
    .update({
      purchase_price: purchasePrice,
      markup_percent: Math.max(markupPercent, 0),
      sales_price: shouldAutoCalculate ? autoSalesPrice : manualSalesPrice,
      sales_unit: optionalString(formData, "sales_unit"),
      price_per_unit: optionalNumber(formData, "price_per_unit"),
      supplier_id: optionalString(formData, "supplier_id"),
      last_price_changed_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`${returnTo}?error=${toQuery(error.message)}`);
  }

  revalidateMaterialRoutes();
  redirect(`${returnTo}?success=${toQuery("Preise wurden aktualisiert.")}`);
}
