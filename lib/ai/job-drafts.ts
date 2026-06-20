import { AI_JOB_DRAFT_SCHEMA, jobDraftPrompt, roleAwareSystemPrompt } from "@/lib/ai/prompts";
import { createStructuredAiResponse, getOpenAiModel } from "@/lib/ai/openai";
import { calculationSettingsSelect } from "@/lib/data/selects";
import { logAiUsage } from "@/lib/ai/usage-log";
import { calculateArea } from "@/lib/material-calculations";
import { buildOrderMaterialRequirementRows, type OrderDimensionValues } from "@/lib/order-materials";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatQuantity } from "@/lib/inventory";
import type { AppContext } from "@/lib/auth";
import type {
  AiJobDraftParsed,
  AiJobDraftPreview,
  AiJobDraftPreviewItem,
  AiJobEstimatePreview,
  CalculationSettings
} from "@/lib/ai/types";
import type { Customer, JobMaterialRequirement, OrderType } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

const DEFAULT_CALCULATION_SETTINGS: Omit<CalculationSettings, "company_id"> = {
  default_waste_percent: 20,
  default_vat_rate: 19,
  default_labor_rate_net: 65,
  default_internal_hourly_cost: 38,
  default_profit_markup_percent: 10,
  default_overhead_percent: 12,
  default_travel_flat_rate: 0,
  allow_ai_job_creation: true,
  require_admin_confirmation: true
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function positiveNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2).slice(0, 10000);
}

async function safeList<T>(query: PromiseLike<{ data: unknown; error: unknown }>) {
  const { data } = await query;
  return Array.isArray(data) ? (data as T[]) : [];
}

export async function loadCalculationSettings(supabase: SupabaseServerClient, companyId: string): Promise<CalculationSettings> {
  const { data, error } = await supabase
    .from("calculation_settings")
    .select(calculationSettingsSelect)
    .eq("company_id", companyId)
    .maybeSingle();
  if (error && !isMissingSchemaError(error)) {
    console.error("calculation-settings-load-failed", error.message);
  }
  return {
    company_id: companyId,
    ...DEFAULT_CALCULATION_SETTINGS,
    ...((data ?? {}) as Partial<CalculationSettings>)
  };
}

function normalizeDraft(raw: AiJobDraftParsed, fallbackWastePercent: number): AiJobDraftParsed {
  const dimensions = raw.dimensions;
  const length = dimensions.length_m;
  const width = dimensions.width_m;
  const area = calculateArea(length, width, dimensions.area_m2);
  const missing = new Set(raw.missing_fields.filter(Boolean));

  if (!raw.customer_name && !raw.existing_customer_id) missing.add("Kunde");
  if (!raw.jobsite_address) missing.add("Baustellenadresse");
  if (!area || area <= 0) missing.add("Maße/Flaeche");

  return {
    ...raw,
    confidence: clampConfidence(raw.confidence),
    title: safeString(raw.title) || "KI-Auftragsentwurf",
    priority: raw.priority ?? "normal",
    description: safeString(raw.description) || safeString(raw.customer_friendly_description) || "Per KI vorbereitet.",
    internal_notes: safeString(raw.internal_notes),
    customer_friendly_description: safeString(raw.customer_friendly_description) || safeString(raw.description),
    internal_work_instructions: safeString(raw.internal_work_instructions),
    suggested_materials: raw.suggested_materials ?? [],
    missing_fields: [...missing],
    follow_up_questions: raw.follow_up_questions ?? [],
    dimensions: {
      length_m: length,
      width_m: width,
      area_m2: area,
      roof_pitch: dimensions.roof_pitch,
      eaves_length_m: dimensions.eaves_length_m,
      ridge_length_m: dimensions.ridge_length_m,
      verge_length_m: dimensions.verge_length_m,
      valley_length_m: dimensions.valley_length_m,
      wall_connection_length_m: dimensions.wall_connection_length_m,
      building_height_m: dimensions.building_height_m,
      downpipe_length_m: dimensions.downpipe_length_m,
      roof_windows_count: Math.max(0, Math.round(positiveNumber(dimensions.roof_windows_count))),
      penetrations_count: Math.max(0, Math.round(positiveNumber(dimensions.penetrations_count))),
      roof_drains_count: Math.max(0, Math.round(positiveNumber(dimensions.roof_drains_count))),
      emergency_overflows_count: Math.max(0, Math.round(positiveNumber(dimensions.emergency_overflows_count)))
    },
    labor_hours_estimated: raw.labor_hours_estimated ?? estimateLaborHours(raw.order_type, area, fallbackWastePercent)
  };
}

export function dimensionsFromAiDraft(parsed: AiJobDraftParsed, wastePercent: number): OrderDimensionValues {
  return {
    length_m: parsed.dimensions.length_m,
    width_m: parsed.dimensions.width_m,
    area_m2: calculateArea(parsed.dimensions.length_m, parsed.dimensions.width_m, parsed.dimensions.area_m2),
    roof_pitch: parsed.dimensions.roof_pitch,
    eaves_length_m: parsed.dimensions.eaves_length_m,
    ridge_length_m: parsed.dimensions.ridge_length_m,
    verge_length_m: parsed.dimensions.verge_length_m,
    valley_length_m: parsed.dimensions.valley_length_m,
    wall_connection_length_m: parsed.dimensions.wall_connection_length_m,
    building_height_m: parsed.dimensions.building_height_m,
    downpipe_length_m: parsed.dimensions.downpipe_length_m,
    roof_windows_count: parsed.dimensions.roof_windows_count,
    penetrations_count: parsed.dimensions.penetrations_count,
    roof_drains_count: parsed.dimensions.roof_drains_count,
    emergency_overflows_count: parsed.dimensions.emergency_overflows_count,
    waste_percent: wastePercent
  };
}

function estimateLaborHours(orderType: OrderType, area: number, fallbackWastePercent: number) {
  const safeArea = Math.max(0, area);
  const base =
    orderType === "flachdach"
      ? safeArea / 7
      : orderType === "dachrinne"
        ? safeArea / 12
        : orderType === "steildach"
          ? safeArea / 6
          : safeArea / 8;
  return Math.max(3, roundMoney(base * (1 + fallbackWastePercent / 200)));
}

function priceSource(item: JobMaterialRequirement) {
  if (item.inventory_item_id && (item.purchase_price !== null || item.sales_price !== null)) return "Eigener Firmen-EK/VK";
  if (item.purchase_price !== null || item.sales_price !== null) return "Materialkatalog/Markt-Richtpreis";
  return "Kein Preis vorhanden";
}

async function previewItemsFromRequirements({
  supabase,
  companyId,
  requirements
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  requirements: JobMaterialRequirement[];
}): Promise<AiJobDraftPreviewItem[]> {
  const inventoryIds = requirements.map((item) => item.inventory_item_id).filter(Boolean) as string[];
  const reservations = inventoryIds.length
    ? await safeList<{ inventory_item_id: string; quantity_reserved: number; status: string }>(
        supabase
          .from("material_reservations")
          .select("inventory_item_id, quantity_reserved, status")
          .eq("company_id", companyId)
          .in("inventory_item_id", inventoryIds)
          .in("status", ["open", "reserved", "partially_reserved"])
      )
    : [];
  const reservedByInventory = new Map<string, number>();
  for (const reservation of reservations) {
    reservedByInventory.set(
      reservation.inventory_item_id,
      (reservedByInventory.get(reservation.inventory_item_id) ?? 0) + Number(reservation.quantity_reserved ?? 0)
    );
  }

  return requirements.map((item) => {
    const stock = Number(item.stock ?? 0);
    const reserved = item.inventory_item_id ? reservedByInventory.get(item.inventory_item_id) ?? 0 : 0;
    const available = Math.max(0, stock - reserved);
    const missing = Math.max(0, Number(item.total_quantity ?? 0) - available);
    return {
      material_name: item.material_name,
      unit: item.unit,
      base_quantity: Number(item.base_quantity ?? 0),
      waste_percent: Number(item.waste_percent ?? 0),
      waste_quantity: Number(item.waste_quantity ?? 0),
      total_quantity: Number(item.total_quantity ?? 0),
      inventory_item_id: item.inventory_item_id,
      stock: item.stock,
      available_quantity: available,
      missing_quantity: missing,
      purchase_price: item.purchase_price,
      sales_price: item.sales_price,
      purchase_total: item.purchase_total,
      sales_total: item.sales_total,
      margin_total: item.margin_total,
      location_name: item.location_name,
      price_source: priceSource(item)
    };
  });
}

export function calculateJobEstimate({
  parsed,
  items,
  settings
}: {
  parsed: AiJobDraftParsed;
  items: AiJobDraftPreviewItem[];
  settings: CalculationSettings;
}): AiJobEstimatePreview {
  const materialEk = roundMoney(items.reduce((sum, item) => sum + Number(item.purchase_total ?? 0), 0));
  const materialVk = roundMoney(items.reduce((sum, item) => sum + Number(item.sales_total ?? 0), 0));
  const laborHours = parsed.labor_hours_estimated ?? estimateLaborHours(parsed.order_type, parsed.dimensions.area_m2 ?? 0, settings.default_waste_percent);
  const laborTotal = roundMoney(laborHours * settings.default_labor_rate_net);
  const travel = roundMoney(settings.default_travel_flat_rate);
  const overheadBase = materialVk + laborTotal + travel;
  const overhead = roundMoney(overheadBase * (settings.default_overhead_percent / 100));
  const profitBase = materialEk + laborTotal + overhead + travel;
  const profit = roundMoney(profitBase * (settings.default_profit_markup_percent / 100));
  const subtotal = roundMoney(materialVk + laborTotal + overhead + profit + travel);
  const vat = roundMoney(subtotal * (settings.default_vat_rate / 100));
  const sourceSummary = items.reduce<Record<string, number>>((summary, item) => {
    summary[item.price_source] = (summary[item.price_source] ?? 0) + 1;
    return summary;
  }, {});

  return {
    material_ek_total: materialEk,
    material_vk_total: materialVk,
    labor_hours_estimated: roundMoney(laborHours),
    labor_rate_net: settings.default_labor_rate_net,
    labor_total_net: laborTotal,
    overhead_percent: settings.default_overhead_percent,
    overhead_total: overhead,
    profit_markup_percent: settings.default_profit_markup_percent,
    profit_total: profit,
    travel_flat_rate: travel,
    subtotal_net: subtotal,
    vat_rate: settings.default_vat_rate,
    vat_total: vat,
    total_gross: roundMoney(subtotal + vat),
    margin_total: roundMoney(materialVk - materialEk + profit),
    price_source_summary: sourceSummary
  };
}

async function loadJobDraftContext(supabase: SupabaseServerClient, companyId: string) {
  const [customers, catalog, inventory, settings] = await Promise.all([
    safeList<Pick<Customer, "id" | "company" | "first_name" | "last_name" | "jobsite_address" | "billing_address">>(
      supabase
        .from("customers")
        .select("id, company, first_name, last_name, jobsite_address, billing_address")
        .eq("company_id", companyId)
        .eq("status", "aktiv")
        .limit(80)
    ),
    safeList<Record<string, unknown>>(
      supabase.from("material_catalog").select("id, name, unit, typical_use, search_terms").eq("active", true).limit(120)
    ),
    safeList<Record<string, unknown>>(
      supabase
        .from("inventory_items")
        .select("id, name, unit, stock, minimum_stock, purchase_price, sales_price")
        .eq("company_id", companyId)
        .limit(120)
    ),
    loadCalculationSettings(supabase, companyId)
  ]);

  return {
    today: new Date().toISOString().slice(0, 10),
    customers,
    order_types: ["steildach", "flachdach", "reparatur", "dachrinne", "blech", "wartung", "sonstiges"],
    material_catalog: catalog,
    inventory,
    calculation_settings: settings
  };
}

export async function createJobDraftFromAI({
  supabase,
  context,
  input
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  input: string;
}) {
  const jobContext = await loadJobDraftContext(supabase, context.companyId);
  const result = await createStructuredAiResponse<AiJobDraftParsed>({
    feature: "ai_job_draft",
    system: roleAwareSystemPrompt(context.profile.role, context.canManage),
    user: `${jobDraftPrompt(compactJson(jobContext))}\n\nAuftragsbeschreibung:\n${input}`,
    schema: AI_JOB_DRAFT_SCHEMA,
    schemaName: "baupro_ai_job_draft",
    maxOutputTokens: 1800
  });

  await logAiUsage({
    supabase,
    companyId: context.companyId,
    userId: context.userId,
    feature: "ai_job_draft",
    model: result.model,
    inputTokens: result.ok ? result.inputTokens : result.inputTokens ?? null,
    outputTokens: result.ok ? result.outputTokens : result.outputTokens ?? null,
    status: result.ok ? "success" : result.disabled ? "disabled" : "error",
    errorMessage: result.ok ? null : result.message
  });

  if (!result.ok) return result;

  const settings = jobContext.calculation_settings;
  const preview = await buildJobDraftPreviewFromParsed({ supabase, context, parsed: result.data, settings });

  return {
    ok: true as const,
    data: preview,
    model: getOpenAiModel(),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens
  };
}

export async function buildJobDraftPreviewFromParsed({
  supabase,
  context,
  parsed,
  settings
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  parsed: AiJobDraftParsed;
  settings?: CalculationSettings;
}) {
  const calculationSettings = settings ?? (await loadCalculationSettings(supabase, context.companyId));
  const normalized = normalizeDraft(parsed, calculationSettings.default_waste_percent);
  const dimensions = dimensionsFromAiDraft(normalized, calculationSettings.default_waste_percent);
  const requirements = (await buildOrderMaterialRequirementRows({
    supabase,
    companyId: context.companyId,
    userId: context.userId,
    orderId: "00000000-0000-0000-0000-000000000000",
    dimensionId: null,
    jobsiteId: null,
    orderType: normalized.order_type,
    dimensions
  })) as unknown as JobMaterialRequirement[];
  const items = await previewItemsFromRequirements({ supabase, companyId: context.companyId, requirements });
  const estimate = calculateJobEstimate({ parsed: normalized, items, settings: calculationSettings });
  const warning = [
    "KI kann Fehler machen. Bitte Maße, Materialbedarf und Preise vor Verwendung prüfen.",
    "Kalkulation basiert auf hinterlegten Regeln und Preisen. Vor Angebotsversand prüfen.",
    normalized.missing_fields.length ? `Unvollständig: ${normalized.missing_fields.join(", ")}` : null
  ]
    .filter(Boolean)
    .join(" ");

  return { parsed: normalized, items, estimate, warning } satisfies AiJobDraftPreview;
}

export function formatMissingMaterial(items: AiJobDraftPreviewItem[]) {
  return items
    .filter((item) => item.missing_quantity > 0)
    .map((item) => `${item.material_name}: fehlt ${formatQuantity(item.missing_quantity)} ${item.unit}`);
}
