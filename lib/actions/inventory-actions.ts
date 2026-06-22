"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext, requireManager, requirePermission, type AppContext } from "@/lib/auth";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { searchOrFilter } from "@/lib/data/shared";
import { materialCatalogItemSelect } from "@/lib/data/selects";
import { ensureDefaultInventoryLocations, toInventoryLocationType } from "@/lib/inventory";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { optionalFormUuid, positiveFormNumber, requiredFormUuid } from "@/lib/security/form-data";
import { safeReturnPath } from "@/lib/security/redirects";
import { assertBringListAccess, assertJobsiteInCompany, assertSupplierInCompany } from "@/lib/security/tenant-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { numberOrZero, optionalNumber, optionalString, requiredString } from "@/lib/utils";
import type { MaterialCatalogItem, MaterialUsageBookingType } from "@/types/app";

function redirectTarget(formData: FormData, fallback = "/materials/inventory") {
  return safeReturnPath(formData.get("return_to"), fallback);
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

function materialUsageBookingType(value: FormDataEntryValue | null): MaterialUsageBookingType {
  const bookingType = String(value ?? "consume");
  if (bookingType === "return" || bookingType === "loss" || bookingType === "break") return bookingType;
  return "consume";
}

function usageDecisionValue(value: FormDataEntryValue | null) {
  return String(value ?? "confirmed") === "rejected" ? "rejected" : "confirmed";
}

async function loadInventoryItemForBooking(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  context: AppContext,
  itemId: string
) {
  const source = context.canManage ? "inventory_items" : "inventory_items_public";
  const { data, error } = await supabase
    .from(source)
    .select("id, company_id, name, unit, stock, minimum_stock, location_id")
    .eq("company_id", context.companyId)
    .eq("id", itemId)
    .maybeSingle();

  if (error || !data) {
    throw new SafeActionError("Material wurde nicht gefunden.");
  }

  return data as {
    id: string;
    company_id: string;
    name: string;
    unit: string;
    stock: number;
    minimum_stock: number;
    location_id: string | null;
  };
}

function revalidateMaterialRoutes(companyId: string) {
  revalidatePath("/materials");
  revalidatePath("/materials/catalog");
  revalidatePath("/materials/inventory");
  revalidatePath("/materials/locations");
  revalidatePath("/materials/low-stock");
  revalidatePath("/materials/import");
  revalidatePath("/dashboard");
  revalidateDashboardCache(companyId);
}

function revalidateJobMaterialRoutes(companyId: string, jobsiteId?: string | null) {
  revalidateMaterialRoutes(companyId);
  revalidatePath("/material-melden");
  revalidatePath("/bring-lists");
  if (jobsiteId) {
    revalidatePath(`/baustellen/${jobsiteId}`);
  }
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
    .or(searchOrFilter(["name"], supplierName))
    .limit(1)
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
  const context = await requirePermission("inventory.edit", "/materials/inventory");
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
      .select(materialCatalogItemSelect)
      .eq("id", catalogItemId)
      .eq("active", true)
      .single();

    if (catalogError || !catalogItem) {
      throw new SafeActionError("Katalogartikel wurde nicht gefunden.");
    }

    const item = catalogItem as unknown as MaterialCatalogItem;
    const supplierId = await findOrCreateSupplier(
      supabase,
      context.companyId,
      optionalString(formData, "supplier_name")
    );

    const { data: existing } = await supabase
      .from("inventory_items")
      .select("id")
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
      minimum_stock: minimumStock,
      package_unit: item.package_unit,
      manufacturer: item.manufacturer,
      article_number: item.article_number,
      ean: item.ean,
      purchase_price: optionalNumber(formData, "purchase_price") ?? item.purchase_price,
      sales_price: item.sales_price,
      notes: optionalString(formData, "notes")
    };

    const existingItem = existing as { id: string } | null;
    if (existingItem) {
      const { error: updateError } = await supabase
        .from("inventory_items")
        .update(payload)
        .eq("id", existingItem.id)
        .eq("company_id", context.companyId);

      if (updateError) {
        throw new SafeActionError("Material konnte nicht aktualisiert werden.");
      }

      if (stock > 0) {
        const { error: stockError } = await supabase.rpc("adjust_inventory_stock", {
          p_company_id: context.companyId,
          p_item_id: existingItem.id,
          p_mode: "increase",
          p_amount: stock,
          p_actor_id: context.userId
        });

        if (stockError) {
          throw new SafeActionError("Bestand konnte nicht atomar gebucht werden.");
        }
      }
    } else {
      const { error: insertError } = await supabase.from("inventory_items").insert({
        ...payload,
        stock,
        created_by: context.userId
      });

      if (insertError) {
        throw new SafeActionError("Material konnte nicht uebernommen werden.");
      }
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Material konnte nicht uebernommen werden."))}`);
  }

  revalidateMaterialRoutes(context.companyId);
  redirect(`${returnTo}?success=${toQuery("Material ist jetzt im Lager.")}`);
}

export async function createCustomInventoryItemAction(formData: FormData) {
  const context = await requirePermission("inventory.edit", "/materials/inventory");
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

  revalidateMaterialRoutes(context.companyId);
  redirect(`${returnTo}?success=${toQuery("Eigenes Material wurde angelegt.")}`);
}

export async function adjustInventoryStockAction(formData: FormData) {
  const context = await requirePermission("inventory.edit", "/materials/inventory");
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

  revalidateMaterialRoutes(context.companyId);
  redirect(`${returnTo}?success=${toQuery("Bestand wurde aktualisiert.")}`);
}

export async function transferInventoryAction(formData: FormData) {
  const context = await requirePermission("inventory.edit", "/materials/inventory");
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

  revalidateMaterialRoutes(context.companyId);
  redirect(`${returnTo}?success=${toQuery("Material wurde umgelagert.")}`);
}

export async function reportMaterialUsageAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  let jobsiteId: string | null = null;

  try {
    const itemId = requiredFormUuid(formData, "item_id", "Material");
    jobsiteId = requiredFormUuid(formData, "jobsite_id", "Baustelle");
    const bringListId = optionalFormUuid(formData, "bring_list_id", "Mitbringliste");
    const quantity = positiveFormNumber(formData, "quantity", "Menge");
    const bookingType = materialUsageBookingType(formData.get("booking_type"));
    const notes = optionalString(formData, "notes");
    const item = await loadInventoryItemForBooking(supabase, context, itemId);

    await assertJobsiteInCompany({ supabase, context, jobsiteId });
    if (bringListId) {
      await assertBringListAccess({ supabase, context, bringListId });
    }

    const { data, error } = await supabase
      .from("material_usage_reports")
      .insert({
        company_id: context.companyId,
        inventory_item_id: item.id,
        jobsite_id: jobsiteId,
        bring_list_id: bringListId,
        quantity,
        unit: item.unit,
        booking_type: bookingType,
        status: "reported",
        reported_by: context.userId,
        notes
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw new SafeActionError("Materialbuchung konnte nicht gemeldet werden.");
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Materialbuchung konnte nicht gemeldet werden."))}`);
  }

  revalidateJobMaterialRoutes(context.companyId, jobsiteId);
  redirect(`${returnTo}?success=${toQuery("Materialbuchung wurde gemeldet und wartet auf Bestaetigung.")}`);
}

export async function confirmMaterialUsageReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);

  try {
    if (!context.canOperate) {
      throw new SafeActionError("Keine Berechtigung fuer Materialbestaetigungen.");
    }

    const reportId = requiredFormUuid(formData, "usage_report_id", "Materialmeldung");
    const decision = usageDecisionValue(formData.get("decision"));
    const note = optionalString(formData, "confirmation_note");

    const { error } = await supabase.rpc("confirm_material_usage_report", {
      p_company_id: context.companyId,
      p_report_id: reportId,
      p_actor_id: context.userId,
      p_decision: decision,
      p_note: note
    });

    if (error) {
      throw new SafeActionError(
        decision === "rejected"
          ? "Materialmeldung konnte nicht abgelehnt werden."
          : "Materialmeldung konnte nicht bestaetigt werden. Pruefe Bestand und Berechtigung."
      );
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Materialmeldung konnte nicht verarbeitet werden."))}`);
  }

  revalidateJobMaterialRoutes(context.companyId);
  redirect(`${returnTo}?success=${toQuery("Materialmeldung wurde verarbeitet.")}`);
}

export async function reserveMaterialForJobsiteAction(formData: FormData) {
  const context = await requirePermission("inventory.edit", "/materials/inventory");
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  let jobsiteId: string | null = null;

  try {
    const itemId = requiredFormUuid(formData, "item_id", "Material");
    jobsiteId = requiredFormUuid(formData, "jobsite_id", "Baustelle");
    const quantity = positiveFormNumber(formData, "quantity", "Menge");
    const notes = optionalString(formData, "notes");
    const item = await loadInventoryItemForBooking(supabase, context, itemId);

    await assertJobsiteInCompany({ supabase, context, jobsiteId });

    const { error } = await supabase.rpc("reserve_inventory_for_jobsite", {
      p_company_id: context.companyId,
      p_jobsite_id: jobsiteId,
      p_inventory_item_id: item.id,
      p_quantity_required: quantity,
      p_quantity_requested: quantity,
      p_unit: item.unit,
      p_reserved_by: context.userId,
      p_notes: notes
    });

    if (error) {
      throw new SafeActionError("Material konnte nicht reserviert werden.");
    }
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Material konnte nicht reserviert werden."))}`);
  }

  revalidateJobMaterialRoutes(context.companyId, jobsiteId);
  redirect(`${returnTo}?success=${toQuery("Material wurde fuer die Baustelle reserviert.")}`);
}

export async function createInventoryLocationAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/materials/locations");
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

  revalidateMaterialRoutes(context.companyId);
  redirect(`${returnTo}?success=${toQuery("Lagerort wurde angelegt.")}`);
}

export async function updateInventoryLocationAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/materials/locations");
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

  revalidateMaterialRoutes(context.companyId);
  redirect(`${returnTo}?success=${toQuery("Lagerort wurde aktualisiert.")}`);
}

export async function deactivateInventoryLocationAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/materials/locations");
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

  revalidateMaterialRoutes(context.companyId);
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

  revalidateMaterialRoutes(context.companyId);
  redirect(`${returnTo}?success=${toQuery("Preise wurden aktualisiert.")}`);
}
