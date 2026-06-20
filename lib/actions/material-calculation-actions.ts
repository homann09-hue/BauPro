"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { suggestRoofMaterialCalculation, type RoofMaterialAiInput, type RoofMaterialAiSuggestion } from "@/lib/ai/material-calculation";
import { canUseAiFeature, loadAiSettings } from "@/lib/ai/permissions";
import { logAiUsage } from "@/lib/ai/usage-log";
import { checkAiLimit } from "@/lib/billing/plans";
import {
  companyPricingSettingsSelect,
  inventoryItemCalculationSelect,
  materialCalculationRuleSelect,
  materialCatalogItemSelect
} from "@/lib/data/selects";
import {
  calculateArea,
  calculateRuleResult,
  materialTypeLabels,
  type CalculationInput
} from "@/lib/material-calculations";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { safeReturnPath } from "@/lib/security/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { numberOrZero, optionalNumber, optionalString, requiredString } from "@/lib/utils";
import type {
  CompanyPricingSettings,
  InventoryItem,
  MaterialCalculationRule,
  MaterialCatalogItem,
  RoofType
} from "@/types/app";

type CalculationItemDraft = {
  rule_id: string | null;
  catalog_item_id: string | null;
  inventory_item_id: string | null;
  material_name: string;
  unit: string;
  base_quantity: number;
  waste_percent: number;
  waste_quantity: number;
  total_quantity: number;
  purchase_price: number | null;
  sales_price: number | null;
  purchase_total: number | null;
  sales_total: number | null;
  margin_total: number | null;
  location_name: string | null;
  stock: number | null;
  minimum_stock: number | null;
  missing_quantity: number;
  source: "rule" | "ai" | "manual";
  ai_reason: string | null;
};

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

function cleanChoice(value: FormDataEntryValue | null, fallback: string) {
  const cleaned = String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  return cleaned || fallback;
}

function intOrZero(formData: FormData, key: string) {
  return Math.max(0, Math.round(numberOrZero(formData, key)));
}

function positiveSetting(value: number | null, fallback: number) {
  if (value === null || !Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

function notNull<T>(value: T | null): value is T {
  return value !== null;
}

function missingQuantity(totalQuantity: number, stock: number | null | undefined) {
  return Math.max(0, Math.round((totalQuantity - Number(stock ?? 0)) * 100) / 100);
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9äöüß]+/g, " ").trim();
}

function materialNameForInput(rule: MaterialCalculationRule, materialType: string | null) {
  if (!materialType || !rule.rule_key.includes("dachziegel")) return rule.material_name;

  const label = materialTypeLabels[materialType] ?? null;
  if (!label || materialType === "sonstiges") return rule.material_name;
  if (materialType === "schiefer") return "Schieferdeckung inklusive Befestigung";
  if (materialType === "metall") return "Metalldachprofil inklusive Befestigung";
  if (materialType === "bitumen") return "Bitumenschindeln mit Naegeln";
  return label;
}

async function ensurePricingSettings(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  userId: string
) {
  const { data } = await supabase
    .from("company_pricing_settings")
    .select(companyPricingSettingsSelect)
    .eq("company_id", companyId)
    .maybeSingle();

  if (data) return data as unknown as CompanyPricingSettings;

  const { data: inserted } = await supabase
    .from("company_pricing_settings")
    .insert({
      company_id: companyId,
      waste_percent: 20,
      default_markup_percent: 35,
      auto_calculate_sales_price: true,
      created_by: userId
    })
    .select(companyPricingSettingsSelect)
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

function itemDraftFromRule({
  rule,
  input,
  inventoryItems,
  catalogById,
  catalogByName,
  settings,
  materialType
}: {
  rule: MaterialCalculationRule;
  input: CalculationInput;
  inventoryItems: InventoryItem[];
  catalogById: Map<string, MaterialCatalogItem>;
  catalogByName: Map<string, MaterialCatalogItem>;
  settings: CompanyPricingSettings;
  materialType: string | null;
}): CalculationItemDraft | null {
  const result = calculateRuleResult(rule, input);
  if (result.totalQuantity <= 0) return null;

  const inventoryItem = findInventoryItem(rule, inventoryItems);
  const catalogItem =
    (rule.catalog_item_id ? catalogById.get(rule.catalog_item_id) : null) ??
    catalogByName.get(rule.material_name.toLowerCase()) ??
    null;
  const price = priceFromRule({ rule, inventoryItem, catalogItem, settings });
  const materialName = rule.rule_key.includes("dachziegel")
    ? materialNameForInput(rule, materialType)
    : price.materialName;
  const purchaseTotal =
    price.purchasePrice === null ? null : Math.round(price.purchasePrice * result.totalQuantity * 100) / 100;
  const salesTotal =
    price.salesPrice === null ? null : Math.round(price.salesPrice * result.totalQuantity * 100) / 100;
  const marginTotal =
    purchaseTotal === null || salesTotal === null ? null : Math.round((salesTotal - purchaseTotal) * 100) / 100;

  return {
    rule_id: rule.id,
    catalog_item_id: price.catalogItemId,
    inventory_item_id: inventoryItem?.id ?? null,
    material_name: materialName,
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
    missing_quantity: missingQuantity(result.totalQuantity, inventoryItem?.stock),
    source: "rule" as const,
    ai_reason: null
  };
}

function itemDraftFromAiSuggestion({
  suggestion,
  inventoryItems,
  settings
}: {
  suggestion: RoofMaterialAiSuggestion;
  inventoryItems: InventoryItem[];
  settings: CompanyPricingSettings;
}): CalculationItemDraft {
  const normalizedSuggestion = normalizeName(suggestion.material_name);
  const inventoryItem =
    inventoryItems
      .filter((item) => normalizeName(item.name).includes(normalizedSuggestion) || normalizedSuggestion.includes(normalizeName(item.name)))
      .sort((a, b) => Number(b.stock ?? 0) - Number(a.stock ?? 0))[0] ?? null;
  const purchasePrice = inventoryItem?.purchase_price ?? null;
  const markup = positiveSetting(inventoryItem?.markup_percent ?? settings.default_markup_percent, settings.default_markup_percent);
  const salesPrice =
    inventoryItem?.sales_price ??
    (purchasePrice === null || !settings.auto_calculate_sales_price ? null : Math.round(purchasePrice * (1 + markup / 100) * 100) / 100);
  const purchaseTotal = purchasePrice === null ? null : Math.round(purchasePrice * suggestion.total_quantity * 100) / 100;
  const salesTotal = salesPrice === null ? null : Math.round(salesPrice * suggestion.total_quantity * 100) / 100;
  const marginTotal = purchaseTotal === null || salesTotal === null ? null : Math.round((salesTotal - purchaseTotal) * 100) / 100;

  return {
    rule_id: null,
    catalog_item_id: inventoryItem?.catalog_item_id ?? null,
    inventory_item_id: inventoryItem?.id ?? null,
    material_name: suggestion.material_name,
    unit: suggestion.unit,
    base_quantity: suggestion.base_quantity,
    waste_percent: suggestion.waste_percent,
    waste_quantity: suggestion.waste_quantity,
    total_quantity: suggestion.total_quantity,
    purchase_price: purchasePrice,
    sales_price: salesPrice,
    purchase_total: purchaseTotal,
    sales_total: salesTotal,
    margin_total: marginTotal,
    location_name: inventoryItem?.inventory_locations?.name ?? null,
    stock: inventoryItem?.stock ?? null,
    minimum_stock: inventoryItem?.minimum_stock ?? null,
    missing_quantity: missingQuantity(suggestion.total_quantity, inventoryItem?.stock),
    source: "ai" as const,
    ai_reason: suggestion.reason
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
      throw new SafeActionError("Baustelle wurde nicht gefunden.");
    }

    const settings = await ensurePricingSettings(supabase, context.companyId, context.userId);
    const roofForm = cleanChoice(formData.get("roof_form"), roofType === "flachdach" ? "flachdach" : "satteldach");
    const materialType = cleanChoice(formData.get("material_type"), roofType === "flachdach" ? "bitumen" : "tonziegel");
    const length = optionalNumber(formData, "length_m");
    const width = optionalNumber(formData, "width_m");
    const area = calculateArea(length, width, optionalNumber(formData, "area_m2"));
    const wastePercent = positiveSetting(optionalNumber(formData, "waste_percent"), settings.waste_percent);
    const input: CalculationInput = {
      roof_form: roofForm,
      material_type: materialType,
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
      dormers_count: intOrZero(formData, "dormers_count"),
      chimneys_count: intOrZero(formData, "chimneys_count"),
      waste_percent: wastePercent
    };

    const [{ data: rulesData }, { data: inventoryData }, { data: catalogData }] = await Promise.all([
      supabase
        .from("material_calculation_rules")
        .select(materialCalculationRuleSelect)
        .eq("roof_type", roofType)
        .eq("active", true)
        .or(`company_id.is.null,company_id.eq.${context.companyId}`)
        .order("sort_order", { ascending: true }),
      supabase
        .from("inventory_items")
        .select(inventoryItemCalculationSelect)
        .eq("company_id", context.companyId),
      supabase.from("material_catalog").select(materialCatalogItemSelect).eq("active", true)
    ]);

    const rules = pickRulesForCompany((rulesData ?? []) as unknown as MaterialCalculationRule[], context.companyId);
    const inventoryItems = (inventoryData ?? []) as unknown as InventoryItem[];
    const catalogItems = (catalogData ?? []) as unknown as MaterialCatalogItem[];
    const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
    const catalogByName = new Map(catalogItems.map((item) => [item.name.toLowerCase(), item]));

    const calculatedItems = rules
      .map((rule) =>
        itemDraftFromRule({
          rule,
          input,
          inventoryItems,
          catalogById,
          catalogByName,
          settings,
          materialType
        })
      )
      .filter(notNull);

    if (calculatedItems.length === 0) {
      throw new SafeActionError("Keine Materialmenge berechnet. Bitte Flaeche oder passende Laengen eintragen.");
    }

    const useAi = String(formData.get("use_ai") ?? "off") === "on";
    let aiModel: string | null = null;
    let aiConfidence: number | null = null;
    const aiNotes: string[] = [];

    if (useAi) {
      const aiSettings = await loadAiSettings(supabase, context.companyId);
      if (canUseAiFeature(context, aiSettings, "material_calculation")) {
        try {
          await checkAiLimit(supabase, context.companyId);
          assertRateLimit(`ai:material-calculation:${context.companyId}:${context.userId}`, 20, 60_000);

          const aiInput: RoofMaterialAiInput = {
            roof_type: roofType,
            roof_form: roofForm,
            material_type: materialType,
            area_m2: area,
            roof_pitch: input.roof_pitch,
            eaves_length_m: input.eaves_length_m,
            ridge_length_m: input.ridge_length_m,
            verge_length_m: input.verge_length_m,
            valley_length_m: input.valley_length_m,
            wall_connection_length_m: input.wall_connection_length_m,
            dormers_count: input.dormers_count,
            chimneys_count: input.chimneys_count,
            penetrations_count: input.penetrations_count,
            roof_windows_count: input.roof_windows_count,
            waste_percent: wastePercent,
            calculated_items: calculatedItems.map((item) => ({
              material_name: item.material_name,
              unit: item.unit,
              base_quantity: item.base_quantity,
              waste_percent: item.waste_percent,
              total_quantity: item.total_quantity
            }))
          };
          const aiResult = await suggestRoofMaterialCalculation(aiInput);
          aiModel = aiResult.model;

          await logAiUsage({
            supabase,
            companyId: context.companyId,
            userId: context.userId,
            feature: "material_calculation",
            model: aiResult.model,
            inputTokens: aiResult.ok ? aiResult.inputTokens : aiResult.inputTokens ?? null,
            outputTokens: aiResult.ok ? aiResult.outputTokens : aiResult.outputTokens ?? null,
            status: aiResult.ok ? "success" : aiResult.disabled ? "disabled" : "error",
            errorMessage: aiResult.ok ? null : aiResult.message
          });

          if (aiResult.ok) {
            aiConfidence = aiResult.data.confidence;
            aiNotes.push(aiResult.data.summary, ...aiResult.data.warnings);
            const existingNames = new Set(calculatedItems.map((item) => normalizeName(item.material_name)));

            for (const suggestion of aiResult.data.additional_items) {
              const normalized = normalizeName(suggestion.material_name);
              if (existingNames.has(normalized)) continue;
              existingNames.add(normalized);
              calculatedItems.push(itemDraftFromAiSuggestion({ suggestion, inventoryItems, settings }));
            }
          } else {
            aiNotes.push(aiResult.message);
          }
        } catch (error) {
          aiNotes.push(safeErrorMessage(error, "KI-Vorschlag konnte nicht erstellt werden. Regelberechnung wurde gespeichert."));
        }
      } else {
        aiNotes.push("KI-Materialberechnung ist in den Einstellungen deaktiviert.");
      }
    }

    const { data: calculation, error: calculationError } = await supabase
      .from("job_material_calculations")
      .insert({
        company_id: context.companyId,
        jobsite_id: jobsiteId,
        roof_type: roofType,
        roof_form: roofForm,
        material_type: materialType,
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
        dormers_count: input.dormers_count,
        chimneys_count: input.chimneys_count,
        waste_percent: wastePercent,
        ai_enabled: useAi,
        ai_model: aiModel,
        ai_confidence: aiConfidence,
        ai_notes: aiNotes.filter(Boolean).join("\n").slice(0, 2000) || null,
        review_notice: "Materialberechnung ist ein Vorschlag und muss fachlich geprueft werden.",
        notes: optionalString(formData, "notes"),
        created_by: context.userId
      })
      .select("id")
      .single();

    if (calculationError || !calculation) {
      throw new Error("material_calculation_insert_failed");
    }

    const { error: itemsError } = await supabase.from("job_material_calculation_items").insert(
      calculatedItems.map((item) => ({
        ...item,
        company_id: context.companyId,
        jobsite_id: jobsiteId,
        created_by: context.userId,
        calculation_id: calculation.id
      }))
    );

    if (itemsError) {
      throw new Error("material_calculation_items_insert_failed");
    }
  } catch (error) {
    redirect(`/baustellen/${jobsiteId}?error=${toQuery(safeErrorMessage(error, "Materialberechnung fehlgeschlagen."))}`);
  }

  revalidatePath(`/baustellen/${jobsiteId}`);
  redirect(`/baustellen/${jobsiteId}?success=${toQuery("Materialliste wurde berechnet.")}`);
}

export async function updatePricingSettingsAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"), "/settings");

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
    redirect(`${returnTo}?error=${toQuery("Chef-Einstellungen konnten nicht gespeichert werden.")}`);
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?success=${toQuery("Chef-Einstellungen wurden gespeichert.")}`);
}

export async function updateMaterialCalculationRuleAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"), "/settings");
  const ruleId = requiredString(formData, "rule_id");

  const { data: sourceRule, error: ruleError } = await supabase
    .from("material_calculation_rules")
    .select(materialCalculationRuleSelect)
    .eq("id", ruleId)
    .or(`company_id.is.null,company_id.eq.${context.companyId}`)
    .single();

  if (ruleError || !sourceRule) {
    redirect(`${returnTo}?error=${toQuery("Regel wurde nicht gefunden.")}`);
  }

  const rule = sourceRule as unknown as MaterialCalculationRule;
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
    redirect(`${returnTo}?error=${toQuery("Materialregel konnte nicht gespeichert werden.")}`);
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?success=${toQuery("Materialregel wurde gespeichert.")}`);
}
