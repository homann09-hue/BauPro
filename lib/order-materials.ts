import { calculateRuleResult, type CalculationInput } from "@/lib/material-calculations";
import {
  companyPricingSettingsSelect,
  inventoryItemCalculationSelect,
  materialCalculationRuleSelect,
  materialCatalogItemSelect
} from "@/lib/data/selects";
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

export type OrderMaterialCalculationContext = {
  roof_form?: string | null;
  material_type?: string | null;
};

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
      id: "fallback:steildach_dachziegel",
      rule_key: "steildach_dachziegel",
      name: "Dachziegel/Pfannen aus Dachfläche",
      material_name: "Dachziegel Tonziegel Doppelmulde",
      catalog_item_id: null,
      unit: "Stueck",
      calculation_method: "area",
      factor: 10.5,
      spacing_m: null,
      waste_applies: true,
      sort_order: 5
    },
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
      id: "fallback:steildach_konterlatten",
      rule_key: "steildach_konterlatten",
      name: "Konterlatten grob aus Dachfläche",
      material_name: "Konterlatte 30 x 50 mm",
      catalog_item_id: null,
      unit: "m",
      calculation_method: "area",
      factor: 1.45,
      spacing_m: null,
      waste_applies: true,
      sort_order: 12
    },
    {
      id: "fallback:steildach_dachlatten",
      rule_key: "steildach_dachlatten",
      name: "Dachlatten aus Dachfläche und Lattenabstand",
      material_name: "Dachlatte 30 x 50 mm",
      catalog_item_id: null,
      unit: "m",
      calculation_method: "area_per_spacing",
      factor: 1,
      spacing_m: 0.32,
      waste_applies: true,
      sort_order: 14
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
      id: "fallback:steildach_befestigung",
      rule_key: "steildach_befestigung",
      name: "Schrauben/Nägel/Sturmklammern grob aus Dachfläche",
      material_name: "Dachdecker-Schrauben und Nägel",
      catalog_item_id: null,
      unit: "Stueck",
      calculation_method: "area",
      factor: 8,
      spacing_m: null,
      waste_applies: true,
      sort_order: 30
    },
    {
      id: "fallback:steildach_ortgang",
      rule_key: "steildach_ortgang",
      name: "Ortgangziegel aus Ortganglänge",
      material_name: "Ortgangziegel passend",
      catalog_item_id: null,
      unit: "Stueck",
      calculation_method: "verge_length",
      factor: 3,
      spacing_m: null,
      waste_applies: true,
      sort_order: 40
    },
    {
      id: "fallback:steildach_kehlblech",
      rule_key: "steildach_kehlblech",
      name: "Kehlblech aus Kehllänge",
      material_name: "Kehlblech Zink",
      catalog_item_id: null,
      unit: "m",
      calculation_method: "valley_length",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 50
    },
    {
      id: "fallback:steildach_traufblech",
      rule_key: "steildach_traufblech",
      name: "Traufblech aus Trauflänge",
      material_name: "Traufblech Zink 200 mm",
      catalog_item_id: null,
      unit: "m",
      calculation_method: "eaves_length",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 60
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
      id: "fallback:flachdach_dampfsperre",
      rule_key: "flachdach_dampfsperre",
      name: "Dampfsperre aus Fläche",
      material_name: "Dampfsperrbahn Alu",
      catalog_item_id: null,
      unit: "m2",
      calculation_method: "area",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 12
    },
    {
      id: "fallback:flachdach_daemmung",
      rule_key: "flachdach_daemmung",
      name: "Dämmung aus Fläche",
      material_name: "Flachdachdämmung PIR",
      catalog_item_id: null,
      unit: "m2",
      calculation_method: "area",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 14
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
      id: "fallback:flachdach_voranstrich",
      rule_key: "flachdach_voranstrich",
      name: "Voranstrich aus Fläche",
      material_name: "Bitumen-Voranstrich",
      catalog_item_id: null,
      unit: "l",
      calculation_method: "area",
      factor: 0.25,
      spacing_m: null,
      waste_applies: true,
      sort_order: 30
    },
    {
      id: "fallback:flachdach_ablaeufe",
      rule_key: "flachdach_ablaeufe",
      name: "Dachabläufe/Notüberläufe",
      material_name: "Dachablauf Flachdach",
      catalog_item_id: null,
      unit: "Stueck",
      calculation_method: "penetrations_count",
      factor: 1,
      spacing_m: null,
      waste_applies: false,
      sort_order: 40
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
      id: "fallback:entwaesserung_fallrohr",
      rule_key: "entwaesserung_fallrohr",
      name: "Fallrohr aus Fallrohrlänge",
      material_name: "Fallrohr Zink DN 100",
      catalog_item_id: null,
      unit: "m",
      calculation_method: "wall_connection_length",
      factor: 1,
      spacing_m: null,
      waste_applies: true,
      sort_order: 30
    },
    {
      id: "fallback:entwaesserung_rohrschellen",
      rule_key: "entwaesserung_rohrschellen",
      name: "Rohrschellen grob aus Fallrohrlänge",
      material_name: "Rohrschelle Fallrohr",
      catalog_item_id: null,
      unit: "Stueck",
      calculation_method: "wall_connection_length",
      factor: 0.7,
      spacing_m: null,
      waste_applies: true,
      sort_order: 40
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
  const byKey = new Map<string, MaterialCalculationRule>(
    fallbackRules(roofType).map((rule) => [rule.rule_key, rule])
  );

  for (const rule of rules) {
    if (rule.company_id === null) byKey.set(rule.rule_key, rule);
  }

  for (const rule of rules) {
    if (rule.company_id === companyId) byKey.set(rule.rule_key, rule);
  }

  const picked = [...byKey.values()].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  return picked;
}

function findInventoryItem(rule: MaterialCalculationRule, inventoryItems: InventoryItem[]) {
  const byCatalog = rule.catalog_item_id
    ? inventoryItems.filter((item) => item.catalog_item_id === rule.catalog_item_id)
    : [];
  if (byCatalog.length) return byCatalog.sort((a, b) => Number(b.stock ?? 0) - Number(a.stock ?? 0))[0] ?? null;

  const ruleTerms = rule.material_name
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 4);

  const scored = inventoryItems
    .map((item) => {
      const itemName = item.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
      const exactBonus = itemName.includes(rule.material_name.toLowerCase()) ? 30 : 0;
      const termScore = ruleTerms.reduce((score, term) => score + (itemName.includes(term) ? 8 : 0), 0);
      const priceBonus = item.purchase_price !== null || item.sales_price !== null ? 3 : 0;
      const stockBonus = Number(item.stock ?? 0) > 0 ? 2 : 0;
      return { item, score: exactBonus + termScore + priceBonus + stockBonus };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.item.stock ?? 0) - Number(a.item.stock ?? 0));

  return scored[0]?.item ?? null;
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

export function calculationInputFromDimensions(
  orderType: OrderType,
  dimensions: OrderDimensionValues,
  calculationContext: OrderMaterialCalculationContext = {}
): CalculationInput {
  const wallConnection =
    orderType === "dachrinne"
      ? dimensions.downpipe_length_m ?? dimensions.wall_connection_length_m
      : dimensions.wall_connection_length_m;

  return {
    roof_form: calculationContext.roof_form ?? null,
    material_type: calculationContext.material_type ?? null,
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
    dormers_count: 0,
    chimneys_count: 0,
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
  dimensions,
  includePrices = true,
  calculationContext = {}
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  orderId: string;
  dimensionId: string | null;
  jobsiteId: string | null;
  orderType: OrderType;
  dimensions: OrderDimensionValues;
  includePrices?: boolean;
  calculationContext?: OrderMaterialCalculationContext;
}) {
  const roofType = orderTypeToRoofType(orderType);
  const settings = await ensurePricingSettings(supabase, companyId, userId);
  const input = calculationInputFromDimensions(orderType, dimensions, calculationContext);

  const inventorySource = includePrices ? "inventory_items" : "inventory_items_public";
  const inventorySelect = includePrices
    ? inventoryItemCalculationSelect
    : "id, company_id, catalog_item_id, location_id, name, unit, stock, minimum_stock, inventory_locations(id, name)";

  const [{ data: rulesData }, { data: inventoryData }, { data: catalogData }] = await Promise.all([
    supabase
      .from("material_calculation_rules")
      .select(materialCalculationRuleSelect)
      .eq("roof_type", roofType)
      .eq("active", true)
      .or(`company_id.is.null,company_id.eq.${companyId}`)
      .order("sort_order", { ascending: true }),
    supabase
      .from(inventorySource)
      .select(inventorySelect)
      .eq("company_id", companyId),
    includePrices
      ? supabase.from("material_catalog").select(materialCatalogItemSelect).eq("active", true)
      : Promise.resolve({ data: [] })
  ]);

  const rules = pickRulesForCompany((rulesData ?? []) as unknown as MaterialCalculationRule[], companyId, roofType);
  const inventoryItems = (inventoryData ?? []) as unknown as InventoryItem[];
  const catalogItems = (catalogData ?? []) as unknown as MaterialCatalogItem[];
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
      const price = includePrices
        ? priceFromRule({ rule, inventoryItem, catalogItem, settings })
        : {
            purchasePrice: null,
            salesPrice: null,
            materialName: inventoryItem?.name ?? catalogItem?.name ?? rule.material_name,
            catalogItemId: rule.catalog_item_id ?? inventoryItem?.catalog_item_id ?? catalogItem?.id ?? null
          };
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
