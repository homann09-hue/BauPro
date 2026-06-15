"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import {
  calculateArea,
  calculateRuleResult,
  type CalculationInput
} from "@/lib/material-calculations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { numberOrZero, optionalNumber, optionalString, requiredString } from "@/lib/utils";
import type {
  CompanyPricingSettings,
  InventoryItem,
  MaterialCalculationRule,
  MaterialCatalogItem,
  RoofType
} from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function roofTypeValue(value: FormDataEntryValue | null): RoofType {
  const roofType = String(value ?? "steildach");
  if (
    roofType === "flachdach" ||
    roofType === "reparatur" ||
    roofType === "entwaesserung" ||
    roofType === "blech"
  ) {
    return roofType;
  }

  return "steildach";
}

function intOrZero(formData: FormData, key: string) {
  return Math.max(0, Math.round(numberOrZero(formData, key)));
}

function positiveSetting(value: number | null, fallback: number) {
  if (value === null || !Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

async function ensurePricingSettings(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  userId: string
) {
  const { data } = await supabase
    .from("company_pricing_settings")
    .select("*")
    .eq("company_id", companyId)
    .maybeSingle();

  if (data) return data as CompanyPricingSettings;

  const { data: inserted } = await supabase
    .from("company_pricing_settings")
    .insert({
      company_id: companyId,
      waste_percent: 20,
      default_markup_percent: 35,
      auto_calculate_sales_price: true,
      created_by: userId
    })
    .select("*")
    .single();

  return (inserted ?? {
    company_id: companyId,
    waste_percent: 20,
    default_markup_percent: 35,
    auto_calculate_sales_price: true
  }) as CompanyPricingSettings;
}

function pickRulesForCompany(rules: MaterialCalculationRule[], companyId: string) {
  const byKey = new Map<string, MaterialCalculationRule>();

  for (const rule of rules) {
    if (rule.company_id === null && !byKey.has(rule.rule_key)) {
      byKey.set(rule.rule_key, rule);
    }
  }

  for (const rule of rules) {
    if (rule.company_id === companyId) {
      byKey.set(rule.rule_key, rule);
    }
  }

  return [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
}

function findInventoryItem(rule: MaterialCalculationRule, inventoryItems: InventoryItem[]) {
  const byCatalog = rule.catalog_item_id
    ? inventoryItems.filter((item) => item.catalog_item_id === rule.catalog_item_id)
    : [];
  const matches = byCatalog.length
    ? byCatalog
    : inventoryItems.filter((item) => item.name.toLowerCase().includes(rule.material_name.toLowerCase()));

  return matches.sort((a, b) => Number(b.stock ?? 0) - Number(a.stock ?? 0))[0] ?? null;
}

function priceFromRule({
  rule,
  inventoryItem,
  catalogItem,
  settings
}: {
  rule: MaterialCalculationRule;
  inventoryItem: InventoryItem | null;
  catalogItem: MaterialCatalogItem | null;
  settings: CompanyPricingSettings;
}) {
  const purchasePrice = inventoryItem?.purchase_price ?? catalogItem?.purchase_price ?? null;
  const explicitSalesPrice = inventoryItem?.sales_price ?? catalogItem?.sales_price ?? null;
  const markup = positiveSetting(
    inventoryItem?.markup_percent ?? catalogItem?.markup_percent ?? settings.default_markup_percent,
    settings.default_markup_percent
  );
  const calculatedSalesPrice = purchasePrice === null ? null : Math.round(purchasePrice * (1 + markup / 100) * 100) / 100;
  const salesPrice = explicitSalesPrice ?? (settings.auto_calculate_sales_price ? calculatedSalesPrice : null);

  return {
    purchasePrice,
    salesPrice,
    materialName: inventoryItem?.name ?? catalogItem?.name ?? rule.material_name,
    catalogItemId: rule.catalog_item_id ?? inventoryItem?.catalog_item_id ?? catalogItem?.id ?? null
  };
}

export async function createMaterialCalculationAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const jobsiteId = requiredString(formData, "jobsite_id");
  const roofType = roofTypeValue(formData.get("roof_type"));

  try {
    const { data: jobsite } = await supabase
      .from("jobsites")
      .select("id, company_id")
      .eq("id", jobsiteId)
      .eq("company_id", context.companyId)
      .single();

    if (!jobsite) {
      throw new Error("Baustelle wurde nicht gefunden.");
    }

    const settings = await ensurePricingSettings(supabase, context.companyId, context.userId);
    const length = optionalNumber(formData, "length_m");
    const width = optionalNumber(formData, "width_m");
    const area = calculateArea(length, width, optionalNumber(formData, "area_m2"));
    const wastePercent = positiveSetting(optionalNumber(formData, "waste_percent"), settings.waste_percent);
    const input: CalculationInput = {
      length_m: length,
      width_m: width,
      area_m2: area,
      roof_pitch: optionalNumber(formData, "roof_pitch"),
      eaves_length_m: optionalNumber(formData, "eaves_length_m"),
      ridge_length_m: optionalNumber(formData, "ridge_length_m"),
      verge_length_m: optionalNumber(formData, "verge_length_m"),
      valley_length_m: optionalNumber(formData, "valley_length_m"),
      wall_connection_length_m: optionalNumber(formData, "wall_connection_length_m"),
      penetrations_count: intOrZero(formData, "penetrations_count"),
      roof_windows_count: intOrZero(formData, "roof_windows_count"),
      waste_percent: wastePercent
    };

    const [{ data: rulesData }, { data: inventoryData }, { data: catalogData }] = await Promise.all([
      supabase
        .from("material_calculation_rules")
        .select("*")
        .eq("roof_type", roofType)
        .eq("active", true)
        .order("sort_order", { ascending: true }),
      supabase
        .from("inventory_items")
        .select("*, inventory_locations(id, name, location_type)")
        .eq("company_id", context.companyId),
      supabase.from("material_catalog").select("*").eq("active", true)
    ]);

    const rules = pickRulesForCompany((rulesData ?? []) as MaterialCalculationRule[], context.companyId);
    const inventoryItems = (inventoryData ?? []) as InventoryItem[];
    const catalogItems = (catalogData ?? []) as MaterialCatalogItem[];
    const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
    const catalogByName = new Map(catalogItems.map((item) => [item.name.toLowerCase(), item]));

    const calculatedItems = rules
      .map((rule) => {
        const result = calculateRuleResult(rule, input);
        if (result.totalQuantity <= 0) return null;

        const inventoryItem = findInventoryItem(rule, inventoryItems);
        const catalogItem =
          (rule.catalog_item_id ? catalogById.get(rule.catalog_item_id) : null) ??
          catalogByName.get(rule.material_name.toLowerCase()) ??
          null;
        const price = priceFromRule({ rule, inventoryItem, catalogItem, settings });
        const purchaseTotal =
          price.purchasePrice === null ? null : Math.round(price.purchasePrice * result.totalQuantity * 100) / 100;
        const salesTotal =
          price.salesPrice === null ? null : Math.round(price.salesPrice * result.totalQuantity * 100) / 100;
        const marginTotal =
          purchaseTotal === null || salesTotal === null ? null : Math.round((salesTotal - purchaseTotal) * 100) / 100;

        return {
          company_id: context.companyId,
          jobsite_id: jobsiteId,
          rule_id: rule.id,
          catalog_item_id: price.catalogItemId,
          inventory_item_id: inventoryItem?.id ?? null,
          material_name: price.materialName,
          unit: rule.unit,
          base_quantity: result.baseQuantity,
          waste_percent: result.wastePercent,
          waste_quantity: result.wasteQuantity,
          total_quantity: result.totalQuantity,
          purchase_price: price.purchasePrice,
          sales_price: price.salesPrice,
          purchase_total: purchaseTotal,
          sales_total: salesTotal,
          margin_total: marginTotal,
          location_name: inventoryItem?.inventory_locations?.name ?? null,
          stock: inventoryItem?.stock ?? null,
          minimum_stock: inventoryItem?.minimum_stock ?? null,
          created_by: context.userId
        };
      })
      .filter(Boolean);

    if (calculatedItems.length === 0) {
      throw new Error("Keine Materialmenge berechnet. Bitte Flaeche oder passende Laengen eintragen.");
    }

    const { data: calculation, error: calculationError } = await supabase
      .from("job_material_calculations")
      .insert({
        company_id: context.companyId,
        jobsite_id: jobsiteId,
        roof_type: roofType,
        length_m: length,
        width_m: width,
        area_m2: area,
        roof_pitch: input.roof_pitch,
        eaves_length_m: input.eaves_length_m,
        ridge_length_m: input.ridge_length_m,
        verge_length_m: input.verge_length_m,
        valley_length_m: input.valley_length_m,
        wall_connection_length_m: input.wall_connection_length_m,
        penetrations_count: input.penetrations_count,
        roof_windows_count: input.roof_windows_count,
        waste_percent: wastePercent,
        notes: optionalString(formData, "notes"),
        created_by: context.userId
      })
      .select("id")
      .single();

    if (calculationError || !calculation) {
      throw new Error(calculationError?.message ?? "Berechnung konnte nicht gespeichert werden.");
    }

    const { error: itemsError } = await supabase.from("job_material_calculation_items").insert(
      calculatedItems.map((item) => ({
        ...item,
        calculation_id: calculation.id
      }))
    );

    if (itemsError) {
      throw new Error(itemsError.message);
    }
  } catch (error) {
    redirect(
      `/baustellen/${jobsiteId}?error=${toQuery(error instanceof Error ? error.message : "Materialberechnung fehlgeschlagen.")}`
    );
  }

  revalidatePath(`/baustellen/${jobsiteId}`);
  redirect(`/baustellen/${jobsiteId}?success=${toQuery("Materialliste wurde berechnet.")}`);
}

export async function updatePricingSettingsAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = requiredString(formData, "return_to");

  const { error } = await supabase.from("company_pricing_settings").upsert(
    {
      company_id: context.companyId,
      waste_percent: positiveSetting(optionalNumber(formData, "waste_percent"), 20),
      default_markup_percent: positiveSetting(optionalNumber(formData, "default_markup_percent"), 35),
      auto_calculate_sales_price: String(formData.get("auto_calculate_sales_price") ?? "off") === "on",
      created_by: context.userId
    },
    { onConflict: "company_id" }
  );

  if (error) {
    redirect(`${returnTo}?error=${toQuery(error.message)}`);
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?success=${toQuery("Chef-Einstellungen wurden gespeichert.")}`);
}

export async function updateMaterialCalculationRuleAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = requiredString(formData, "return_to");
  const ruleId = requiredString(formData, "rule_id");

  const { data: sourceRule, error: ruleError } = await supabase
    .from("material_calculation_rules")
    .select("*")
    .eq("id", ruleId)
    .single();

  if (ruleError || !sourceRule) {
    redirect(`${returnTo}?error=${toQuery("Regel wurde nicht gefunden.")}`);
  }

  const rule = sourceRule as MaterialCalculationRule;
  const payload = {
    company_id: context.companyId,
    rule_key: rule.rule_key,
    roof_type: rule.roof_type,
    name: requiredString(formData, "name"),
    material_name: requiredString(formData, "material_name"),
    catalog_item_id: rule.catalog_item_id,
    unit: requiredString(formData, "unit"),
    calculation_method: rule.calculation_method,
    factor: positiveSetting(optionalNumber(formData, "factor"), rule.factor),
    spacing_m: optionalNumber(formData, "spacing_m"),
    waste_applies: String(formData.get("waste_applies") ?? "off") === "on",
    sort_order: rule.sort_order,
    active: true,
    created_by: context.userId
  };

  const { error } = await supabase
    .from("material_calculation_rules")
    .upsert(payload, { onConflict: "company_id,rule_key" });

  if (error) {
    redirect(`${returnTo}?error=${toQuery(error.message)}`);
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?success=${toQuery("Materialregel wurde gespeichert.")}`);
}
