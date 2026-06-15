import { calculateRuleResult, type CalculationInput } from "@/lib/material-calculations";
import { orderTypeToRoofType } from "@/lib/order-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CompanyPricingSettings,
  InventoryItem,
  JobDimension,
  MaterialCalculationRule,
  MaterialCatalogItem,
  OrderType,
  RoofType
} from "@/types/app";

export type OrderDimensionValues = Pick<
  JobDimension,
  | "length_m"
  | "width_m"
  | "area_m2"
  | "roof_pitch"
  | "eaves_length_m"
  | "ridge_length_m"
  | "verge_length_m"
  | "valley_length_m"
  | "wall_connection_length_m"
  | "building_height_m"
  | "downpipe_length_m"
  | "roof_windows_count"
  | "penetrations_count"
  | "roof_drains_count"
  | "emergency_overflows_count"
  | "waste_percent"
>;

function positiveSetting(value: number | null | undefined, fallback: number) {
  if (value === null || value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

function notNull<T>(value: T | null): value is T {
  return value !== null;
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

function fallbackRules(roofType: RoofType): MaterialCalculationRule[] {
  const base = {
    company_id: null,
    roof_type: roofType,
    factor: 1,
    spacing_m: null,
    waste_applies: true,
    active: true
  } satisfies Partial<MaterialCalculationRule>;

  const rows: Array<Omit<MaterialCalculationRule, "company_id" | "roof_type" | "active">> = [
    {
      id: "fallback:steildach_unterspannbahn",
      rule_key: "steildach_unterspannbahn",
      name: "Unterspannbahn aus Dachfläche",
      material_name: "Unterspannbahn diffusionsoffen 160 g",
      catalog_item_id: null,
      unit: "m2",
      calculation_method: "area",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 10
    },
    {
      id: "fallback:steildach_firstrolle",
      rule_key: "steildach_firstrolle",
      name: "Firstrolle aus Firstlänge",
      material_name: "Firstrolle Aluminium 300 mm",
      catalog_item_id: null,
      unit: "m",
      calculation_method: "first_length",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 20
    },
    {
      id: "fallback:flachdach_unterlage",
      rule_key: "flachdach_unterlage",
      name: "Schweißbahn Unterlage aus Fläche",
      material_name: "Bitumenbahn V60 S4 talkumiert",
      catalog_item_id: null,
      unit: "m2",
      calculation_method: "area",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 10
    },
    {
      id: "fallback:flachdach_oberlage",
      rule_key: "flachdach_oberlage",
      name: "Schweißbahn Oberlage aus Fläche",
      material_name: "Polymerbitumenbahn PYE PV200 S5 beschiefert",
      catalog_item_id: null,
      unit: "m2",
      calculation_method: "area",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 20
    },
    {
      id: "fallback:entwaesserung_dachrinne",
      rule_key: "entwaesserung_dachrinne",
      name: "Dachrinne aus Trauflänge",
      material_name: "Dachrinne halbrund RG 333 Zink",
      catalog_item_id: null,
      unit: "m",
      calculation_method: "eaves_length",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 10
    },
    {
      id: "fallback:entwaesserung_rinnenhalter",
      rule_key: "entwaesserung_rinnenhalter",
      name: "Rinnenhalter alle 60 cm",
      material_name: "Rinnenhalter RG 333 verzinkt lang",
      catalog_item_id: null,
      unit: "Stueck",
      calculation_method: "gutter_hangers",
      factor: 1,
      spacing_m: 0.6,
      waste_applies: true,
      sort_order: 20
    },
    {
      id: "fallback:blech_traufblech",
      rule_key: "blech_traufblech",
      name: "Traufblech aus Länge",
      material_name: "Traufblech Zink 200 mm",
      catalog_item_id: null,
      unit: "m",
      calculation_method: "eaves_length",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 10
    },
    {
      id: "fallback:reparatur_unterspannbahn",
      rule_key: "reparatur_unterspannbahn",
      name: "Unterspannbahn Reparaturfläche",
      material_name: "Unterspannbahn diffusionsoffen 160 g",
      catalog_item_id: null,
      unit: "m2",
      calculation_method: "area",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 10
    }
  ];

  return rows
    .filter((rule) => rule.rule_key.startsWith(roofType))
    .map((rule) => ({ ...base, ...rule } as MaterialCalculationRule));
}

function pickRulesForCompany(rules: MaterialCalculationRule[], companyId: string, roofType: RoofType) {
  const byKey = new Map<string, MaterialCalculationRule>();

  for (const rule of rules) {
    if (rule.company_id === null && !byKey.has(rule.rule_key)) byKey.set(rule.rule_key, rule);
  }

  for (const rule of rules) {
    if (rule.company_id === companyId) byKey.set(rule.rule_key, rule);
  }

  const picked = [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return picked.length ? picked : fallbackRules(roofType);
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

export function calculationInputFromDimensions(orderType: OrderType, dimensions: OrderDimensionValues): CalculationInput {
  const wallConnection =
    orderType === "dachrinne"
      ? dimensions.downpipe_length_m ?? dimensions.wall_connection_length_m
      : dimensions.wall_connection_length_m;

  return {
    length_m: dimensions.length_m,
    width_m: dimensions.width_m,
    area_m2: dimensions.area_m2,
    roof_pitch: dimensions.roof_pitch,
    eaves_length_m: dimensions.eaves_length_m,
    ridge_length_m: dimensions.ridge_length_m,
    verge_length_m: dimensions.verge_length_m,
    valley_length_m: dimensions.valley_length_m,
    wall_connection_length_m: wallConnection,
    penetrations_count:
      dimensions.penetrations_count + dimensions.roof_drains_count + dimensions.emergency_overflows_count,
    roof_windows_count: dimensions.roof_windows_count,
    waste_percent: dimensions.waste_percent
  };
}

export async function buildOrderMaterialRequirementRows({
  supabase,
  companyId,
  userId,
  orderId,
  dimensionId,
  jobsiteId,
  orderType,
  dimensions
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  orderId: string;
  dimensionId: string | null;
  jobsiteId: string | null;
  orderType: OrderType;
  dimensions: OrderDimensionValues;
}) {
  const roofType = orderTypeToRoofType(orderType);
  const settings = await ensurePricingSettings(supabase, companyId, userId);
  const input = calculationInputFromDimensions(orderType, dimensions);

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
      .eq("company_id", companyId),
    supabase.from("material_catalog").select("*").eq("active", true)
  ]);

  const rules = pickRulesForCompany((rulesData ?? []) as MaterialCalculationRule[], companyId, roofType);
  const inventoryItems = (inventoryData ?? []) as InventoryItem[];
  const catalogItems = (catalogData ?? []) as MaterialCatalogItem[];
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
  const catalogByName = new Map(catalogItems.map((item) => [item.name.toLowerCase(), item]));

  return rules
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
        company_id: companyId,
        order_id: orderId,
        dimension_id: dimensionId,
        jobsite_id: jobsiteId,
        rule_id: rule.id.startsWith("fallback:") ? null : rule.id,
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
        created_by: userId
      };
    })
    .filter(notNull);
}
