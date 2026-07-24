"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import {
  customerFormSelect,
  inventoryItemCalculationSelect,
  jobDimensionSelect,
  orderMeasurementItemSelect
} from "@/lib/data/selects";
import { calculateArea } from "@/lib/material-calculations";
import {
  calculateOrderCostEstimate,
  orderCostEstimateSummary,
  type OrderCostEstimateInput
} from "@/lib/order-cost-estimate";
import {
  aggregateMeasurementItems,
  calculateMeasurementDraft,
  orderMeasurementItemTypeLabels,
  type MeasurementDraft
} from "@/lib/order-measurements";
import { buildOrderMaterialRequirementRows, type OrderDimensionValues } from "@/lib/order-materials";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { optionalFormUuid, requiredFormString, requiredFormUuid } from "@/lib/security/form-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formIds,
  numberOrZero,
  optionalDate,
  optionalNumber,
  optionalString
} from "@/lib/utils";
import {
  calculateRoofingMaterialEstimate,
  roofingTileTypeValue,
  type RoofingMaterialEstimate,
  type RoofingMaterialEstimateInput,
  type RoofingMaterialPriceRow
} from "@/lib/roofing-material-estimate";
import type { Customer, OrderMeasurementItem, OrderMeasurementItemType, OrderPriority, OrderStatus, OrderType } from "@/types/app";

const JOB_ESTIMATE_SCHEMA_MISSING_MESSAGE =
  "Auftrag wurde gespeichert, aber die Kostenkalkulation konnte nicht gespeichert werden: Datenbank-Update fehlt. Bitte supabase/migrations/20260711_ai_job_estimates_gap_fix.sql ausführen.";
const ORDER_RPC_SCHEMA_MISSING_MESSAGE =
  "Datenbank-Update fehlt: Bitte supabase/migrations/20260716_atomic_order_creation.sql ausführen.";

type AtomicOrderCreationRow = {
  order_id: string;
  jobsite_id: string;
  order_number: string;
};

function isMissingSchemaRelationError(error: unknown, relationName: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate.message === "string" ? candidate.message : "";

  return candidate.code === "PGRST205" && message.includes("schema cache") && message.includes(relationName);
}

function isMissingRpcError(error: unknown, functionName: string) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const text = [candidate.code, candidate.message, candidate.details, candidate.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return (
    text.includes("PGRST202") ||
    (text.includes("schema cache") && text.includes(functionName)) ||
    (text.includes("function") && text.includes(functionName) && text.includes("does not exist"))
  );
}

function orderTypeValue(value: FormDataEntryValue | null): OrderType {
  const type = String(value ?? "steildach");
  if (
    type === "flachdach" ||
    type === "reparatur" ||
    type === "dachrinne" ||
    type === "blech" ||
    type === "wartung" ||
    type === "sonstiges"
  ) {
    return type;
  }

  return "steildach";
}

function orderStatusValue(value: FormDataEntryValue | null): OrderStatus {
  const status = String(value ?? "anfrage");
  if (
    status === "angebot" ||
    status === "geplant" ||
    status === "in_arbeit" ||
    status === "fertig" ||
    status === "abgerechnet"
  ) {
    return status;
  }

  return "anfrage";
}

function requiredOrderStatusValue(formData: FormData): OrderStatus {
  const rawStatus = requiredFormString(formData, "status", "Status");
  const status = orderStatusValue(rawStatus);
  if (status !== rawStatus) {
    throw new SafeActionError("Bitte einen gueltigen Status fuer den Auftrag waehlen.");
  }

  return status;
}

function requiredDateString(formData: FormData, key: string, label: string) {
  const value = requiredFormString(formData, key, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) {
    throw new SafeActionError(`Bitte ein gueltiges Datum fuer ${label} eintragen.`);
  }

  return value;
}

function orderPriorityValue(value: FormDataEntryValue | null): OrderPriority {
  const priority = String(value ?? "normal");
  return priority === "niedrig" || priority === "hoch" ? priority : "normal";
}

const measurementItemTypes = Object.keys(orderMeasurementItemTypeLabels) as OrderMeasurementItemType[];

function measurementItemTypeValue(value: FormDataEntryValue | null): OrderMeasurementItemType {
  const type = String(value ?? "roof_area");
  return measurementItemTypes.includes(type as OrderMeasurementItemType) ? (type as OrderMeasurementItemType) : "roof_area";
}

function newCustomerTypeValue(value: FormDataEntryValue | null) {
  const type = String(value ?? "privatkunde");
  if (type === "gewerbekunde" || type === "hausverwaltung" || type === "architekt" || type === "versicherung") {
    return type;
  }

  return "privatkunde";
}

function intOrZero(formData: FormData, key: string) {
  return Math.max(0, Math.round(numberOrZero(formData, key)));
}

function hasDimensionInput(formData: FormData) {
  const numberFields = [
    "length_m",
    "width_m",
    "area_m2",
    "roof_pitch",
    "eaves_length_m",
    "ridge_length_m",
    "verge_length_m",
    "valley_length_m",
    "wall_connection_length_m",
    "building_height_m",
    "downpipe_length_m"
  ];
  const countFields = ["roof_windows_count", "penetrations_count", "roof_drains_count", "emergency_overflows_count"];

  return (
    numberFields.some((field) => optionalNumber(formData, field) !== null) ||
    countFields.some((field) => intOrZero(formData, field) > 0)
  );
}

function dimensionsFromForm(formData: FormData, fallbackWastePercent: number): OrderDimensionValues {
  const length = optionalNumber(formData, "length_m");
  const width = optionalNumber(formData, "width_m");
  const area = calculateArea(length, width, optionalNumber(formData, "area_m2"));
  const waste = optionalNumber(formData, "waste_percent");

  return {
    length_m: length,
    width_m: width,
    area_m2: area,
    roof_pitch: optionalNumber(formData, "roof_pitch"),
    eaves_length_m: optionalNumber(formData, "eaves_length_m"),
    ridge_length_m: optionalNumber(formData, "ridge_length_m"),
    verge_length_m: optionalNumber(formData, "verge_length_m"),
    valley_length_m: optionalNumber(formData, "valley_length_m"),
    wall_connection_length_m: optionalNumber(formData, "wall_connection_length_m"),
    building_height_m: optionalNumber(formData, "building_height_m"),
    downpipe_length_m: optionalNumber(formData, "downpipe_length_m"),
    roof_windows_count: intOrZero(formData, "roof_windows_count"),
    penetrations_count: intOrZero(formData, "penetrations_count"),
    roof_drains_count: intOrZero(formData, "roof_drains_count"),
    emergency_overflows_count: intOrZero(formData, "emergency_overflows_count"),
    waste_percent: Math.max(0, waste ?? fallbackWastePercent)
  };
}

function positiveFormNumber(formData: FormData, key: string) {
  return Math.max(0, optionalNumber(formData, key) ?? 0);
}

function orderCostInputFromForm(formData: FormData, areaM2: number): OrderCostEstimateInput {
  return {
    areaM2,
    materialCostPerM2: positiveFormNumber(formData, "material_cost_per_m2"),
    materialManualTotalNet: positiveFormNumber(formData, "material_manual_total_net"),
    laborHours: positiveFormNumber(formData, "labor_hours_estimated"),
    laborEmployeeCount: Math.max(1, Math.round(positiveFormNumber(formData, "labor_employee_count") || 1)),
    internalLaborRateNet: positiveFormNumber(formData, "internal_labor_rate_net"),
    laborRateNet: positiveFormNumber(formData, "labor_rate_net"),
    travelKm: positiveFormNumber(formData, "travel_km"),
    travelTripCount: Math.max(1, Math.round(positiveFormNumber(formData, "travel_trip_count") || 1)),
    travelRatePerKm: positiveFormNumber(formData, "travel_rate_per_km"),
    travelFlatRate: positiveFormNumber(formData, "travel_flat_rate"),
    machineExtraTotalNet: positiveFormNumber(formData, "machine_extra_total_net"),
    vatRate: positiveFormNumber(formData, "vat_rate") || 19
  };
}

function roofingMaterialInputFromForm(formData: FormData, areaM2: number): RoofingMaterialEstimateInput {
  return {
    areaM2,
    roofPitch: positiveFormNumber(formData, "roof_pitch"),
    tileType: roofingTileTypeValue(formData.get("tile_type")),
    eavesLengthM: positiveFormNumber(formData, "eaves_length_m"),
    ridgeLengthM: positiveFormNumber(formData, "ridge_length_m"),
    vergeLengthM: positiveFormNumber(formData, "verge_length_m"),
    valleyLengthM: positiveFormNumber(formData, "valley_length_m"),
    hipLengthM: positiveFormNumber(formData, "hip_length_m"),
    wastePercent: positiveFormNumber(formData, "waste_percent") || 15
  };
}

function normalizeRoofingMaterialPriceRows(data: unknown): RoofingMaterialPriceRow[] {
  return (Array.isArray(data) ? data : []).map((row) => {
    const item = row as Omit<RoofingMaterialPriceRow, "inventory_locations"> & {
      inventory_locations?: RoofingMaterialPriceRow["inventory_locations"] | RoofingMaterialPriceRow["inventory_locations"][];
    };

    return {
      ...item,
      inventory_locations: Array.isArray(item.inventory_locations)
        ? item.inventory_locations[0] ?? null
        : item.inventory_locations ?? null
    };
  });
}

async function calculateRoofingMaterialsFromInventory({
  supabase,
  companyId,
  input
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  input: RoofingMaterialEstimateInput;
}) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select(inventoryItemCalculationSelect)
    .eq("company_id", companyId)
    .order("name", { ascending: true });

  if (error) {
    throw new Error("inventory_price_lookup_failed");
  }

  return calculateRoofingMaterialEstimate(input, normalizeRoofingMaterialPriceRows(data));
}

async function saveOrderCostEstimate({
  supabase,
  companyId,
  userId,
  orderId,
  input,
  roofingEstimate
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  orderId: string;
  input: OrderCostEstimateInput;
  roofingEstimate: RoofingMaterialEstimate;
}) {
  const estimate = calculateOrderCostEstimate(input);
  const summary = {
    ...orderCostEstimateSummary(input, estimate),
    roofing_material_purchase_total: roofingEstimate.purchaseTotal,
    roofing_material_sales_total: roofingEstimate.salesTotal,
    roofing_material_warnings: roofingEstimate.warnings,
    roofing_material_items: roofingEstimate.items.map((item) => ({
      key: item.key,
      material_name: item.materialName,
      quantity: item.totalQuantity,
      unit: item.unit,
      purchase_price: item.purchasePrice,
      purchase_total: item.purchaseTotal,
      warning: item.warning
    }))
  };

  const { data, error } = await supabase
    .from("job_estimates")
    .insert({
      company_id: companyId,
      job_id: orderId,
      material_ek_total: estimate.materialTotalNet,
      material_vk_total: estimate.materialTotalNet,
      labor_hours_estimated: input.laborHours,
      labor_rate_net: input.laborRateNet,
      labor_total_net: estimate.laborSalesTotalNet,
      overhead_percent: 0,
      overhead_total: 0,
      profit_markup_percent: 0,
      profit_total: 0,
      subtotal_net: estimate.subtotalNet,
      vat_rate: estimate.vatRate,
      vat_total: estimate.vatTotal,
      total_gross: estimate.totalGross,
      price_source_summary: summary,
      created_by: userId
    })
    .select("id")
    .single();

  if (error || !data) {
    if (isMissingSchemaRelationError(error, "job_estimates")) {
      throw new SafeActionError(JOB_ESTIMATE_SCHEMA_MISSING_MESSAGE);
    }

    throw new Error("order_estimate_insert_failed");
  }

  const rows = roofingEstimate.items.map((item) => ({
    estimate_id: data.id as string,
    material_id: item.inventoryItemId,
    description: item.materialName,
    quantity: item.totalQuantity,
    unit: item.unit,
    ek_unit_price: item.purchasePrice,
    vk_unit_price: item.salesPrice,
    ek_total: item.purchaseTotal,
    vk_total: item.salesTotal,
    price_source: item.priceSource,
    notes: item.warning ?? `Grundmenge ${item.baseQuantity} ${item.unit}, Verschnitt ${item.wastePercent} %.`
  }));

  if (rows.length > 0) {
    const { error: itemError } = await supabase.from("job_estimate_items").insert(rows);
    if (itemError) {
      if (isMissingSchemaRelationError(itemError, "job_estimate_items")) {
        throw new SafeActionError(JOB_ESTIMATE_SCHEMA_MISSING_MESSAGE);
      }

      throw new Error("order_estimate_items_insert_failed");
    }
  }
}

async function saveOrderDimensions({
  supabase,
  companyId,
  userId,
  orderId,
  dimensions,
  notes
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  orderId: string;
  dimensions: OrderDimensionValues;
  notes: string | null;
}) {
  const { data: existing, error: lookupError } = await supabase
    .from("job_dimensions")
    .select("id")
    .eq("order_id", orderId)
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookupError) {
    throw new Error("dimension_lookup_failed");
  }

  if (existing?.id) {
    const { data, error } = await supabase
      .from("job_dimensions")
      .update({
        ...dimensions,
        notes,
        created_by: userId,
        archived_at: null
      })
      .eq("id", existing.id as string)
      .eq("company_id", companyId)
      .select("id")
      .single();

    if (error || !data) {
      throw new Error("dimension_update_failed");
    }

    return data;
  }

  const { data, error } = await supabase
    .from("job_dimensions")
    .insert({
      ...dimensions,
      company_id: companyId,
      order_id: orderId,
      notes,
      created_by: userId
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("dimension_insert_failed");
  }

  return data;
}

async function archiveCurrentRequirements({
  supabase,
  companyId,
  orderId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  orderId: string;
}) {
  const { error } = await supabase
    .from("job_material_requirements")
    .update({ archived_at: new Date().toISOString() })
    .eq("order_id", orderId)
    .eq("company_id", companyId)
    .is("archived_at", null);

  if (error) {
    throw new Error("requirements_archive_failed");
  }
}

function measurementDraftFromForm(formData: FormData): MeasurementDraft {
  const itemType = measurementItemTypeValue(formData.get("item_type"));
  const draft: MeasurementDraft = {
    item_type: itemType,
    label: optionalString(formData, "label") ?? orderMeasurementItemTypeLabels[itemType],
    length_m: optionalNumber(formData, "length_m"),
    width_m: optionalNumber(formData, "width_m"),
    quantity: optionalNumber(formData, "quantity") ?? 1,
    pitch_deg: optionalNumber(formData, "pitch_deg"),
    notes: optionalString(formData, "notes")
  };

  if ((itemType === "roof_area" || itemType === "deduction_area") && (!(draft.length_m && draft.length_m > 0) || !(draft.width_m && draft.width_m > 0))) {
    throw new SafeActionError("Für Flächen bitte Länge und Breite größer 0 eintragen.");
  }

  if (
    ["eaves_length", "ridge_length", "verge_length", "valley_length", "wall_connection_length", "downpipe_length"].includes(itemType) &&
    !(draft.length_m && draft.length_m > 0)
  ) {
    throw new SafeActionError("Für laufende Meter bitte eine Länge größer 0 eintragen.");
  }

  if (["roof_window", "penetration", "roof_drain", "emergency_overflow"].includes(itemType) && draft.quantity <= 0) {
    throw new SafeActionError("Für Stückzahlen bitte eine Anzahl größer 0 eintragen.");
  }

  return draft;
}

async function syncDimensionsFromMeasurements({
  supabase,
  companyId,
  userId,
  orderId,
  orderType,
  jobsiteId,
  includePrices
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  orderId: string;
  orderType: OrderType;
  jobsiteId: string | null;
  includePrices: boolean;
}) {
  const [{ data: settings }, { data: itemsData, error: itemsError }] = await Promise.all([
    supabase.from("company_pricing_settings").select("waste_percent").eq("company_id", companyId).maybeSingle(),
    supabase
      .from("order_measurement_items")
      .select(orderMeasurementItemSelect)
      .eq("order_id", orderId)
      .eq("company_id", companyId)
      .is("archived_at", null)
      .order("created_at", { ascending: true })
  ]);

  if (itemsError) {
    throw new Error("measurement_items_load_failed");
  }

  const items = (itemsData ?? []) as unknown as OrderMeasurementItem[];
  await archiveCurrentRequirements({ supabase, companyId, orderId });

  if (items.length === 0) {
    await supabase
      .from("job_dimensions")
      .update({ archived_at: new Date().toISOString() })
      .eq("order_id", orderId)
      .eq("company_id", companyId)
      .is("archived_at", null);
    await supabase.from("orders").update({ has_dimensions: false }).eq("id", orderId).eq("company_id", companyId);
    return { itemCount: 0, requirementCount: 0 };
  }

  const dimensions = aggregateMeasurementItems(items, Number(settings?.waste_percent ?? 20));
  const dimension = await saveOrderDimensions({
    supabase,
    companyId,
    userId,
    orderId,
    dimensions,
    notes: "Automatisch aus Aufmaßpositionen erzeugt."
  });

  const { data: updatedOrder, error: updateOrderError } = await supabase
    .from("orders")
    .update({ has_dimensions: true })
    .eq("id", orderId)
    .eq("company_id", companyId)
    .select("id")
    .maybeSingle();

  if (updateOrderError || !updatedOrder) {
    throw new SafeActionError("Auftrag wurde nicht gefunden.");
  }

  const requirementRows = await buildOrderMaterialRequirementRows({
    supabase,
    companyId,
    userId,
    orderId,
    dimensionId: dimension.id as string,
    jobsiteId,
    orderType,
    dimensions,
    includePrices
  });

  if (requirementRows.length > 0) {
    const { error: insertError } = await supabase.from("job_material_requirements").insert(requirementRows);
    if (insertError) throw new Error("requirements_insert_failed");
  }

  return { itemCount: items.length, requirementCount: requirementRows.length };
}

async function getAssignableEmployeeIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  formData: FormData,
  companyId: string
) {
  const requestedIds = [...new Set(formIds(formData, "assigned_employee_ids"))];

  if (requestedIds.length === 0) {
    return { ids: [] as string[], error: null as string | null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("active", true)
    .in("role", ["mitarbeiter", "vorarbeiter"])
    .in("id", requestedIds);

  if (error) {
    return { ids: [] as string[], error: "Mitarbeiter konnten nicht geprueft werden." };
  }

  const ids = (data ?? []).map((profile) => profile.id as string);
  if (ids.length !== requestedIds.length) {
    return { ids: [] as string[], error: "Nur aktive Mitarbeiter oder Vorarbeiter dieser Firma duerfen zugeordnet werden." };
  }

  return { ids, error: null as string | null };
}

async function resolveCustomer(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  formData: FormData,
  companyId: string,
  userId: string
) {
  const selectedCustomerIdRaw = optionalString(formData, "customer_id");

  if (!selectedCustomerIdRaw) {
    throw new SafeActionError("Bitte einen Kunden auswaehlen oder einen neuen Kunden anlegen.");
  }

  if (selectedCustomerIdRaw && selectedCustomerIdRaw !== "new") {
    const selectedCustomerId = optionalFormUuid(formData, "customer_id", "Kunde");
    const { data, error } = await supabase
      .from("customers")
      .select(customerFormSelect)
      .eq("id", selectedCustomerId)
      .eq("company_id", companyId)
      .single();

    if (error || !data) {
      throw new SafeActionError("Kunde wurde nicht gefunden.");
    }

    return data as unknown as Customer;
  }

  const company = optionalString(formData, "new_customer_company");
  const firstName = optionalString(formData, "new_customer_first_name");
  const lastName = optionalString(formData, "new_customer_last_name");

  if (!company && !firstName && !lastName) {
    throw new SafeActionError("Bitte einen bestehenden Kunden waehlen oder einen neuen Kunden eintragen.");
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      customer_type: newCustomerTypeValue(formData.get("new_customer_type")),
      company,
      first_name: firstName,
      last_name: lastName,
      contact_person: optionalString(formData, "new_customer_contact_person"),
      phone: optionalString(formData, "new_customer_phone"),
      email: optionalString(formData, "new_customer_email"),
      billing_address: optionalString(formData, "new_customer_billing_address"),
      jobsite_address: optionalString(formData, "jobsite_address") ?? optionalString(formData, "new_customer_jobsite_address"),
      status: "aktiv",
      created_by: userId
    })
    .select(customerFormSelect)
    .single();

  if (error || !data) {
    throw new Error("customer_insert_failed");
  }

  return data as unknown as Customer;
}

export async function createOrderAction(formData: FormData) {
  const context = await requirePermission("orders.create", "/orders");
  const supabase = await createSupabaseServerClient();
  let createdOrderId: string | null = null;
  let materialCalculationWarning: string | null = null;
  let costEstimateWarning: string | null = null;

  try {
    const assignedEmployees = await getAssignableEmployeeIds(supabase, formData, context.companyId);
    if (assignedEmployees.error) throw new SafeActionError(assignedEmployees.error);

    const customer = await resolveCustomer(supabase, formData, context.companyId, context.userId);
    const title = requiredFormString(formData, "title", "Auftragstitel");
    const orderType = orderTypeValue(formData.get("order_type"));
    const status = requiredOrderStatusValue(formData);
    const priority = orderPriorityValue(formData.get("priority"));
    const jobsiteAddress = requiredFormString(formData, "jobsite_address", "Baustellenadresse");
    const description = requiredFormString(formData, "description", "Beschreibung");
    const startDate = requiredDateString(formData, "start_date", "Startdatum");
    const shouldCreateDimensions = hasDimensionInput(formData);
    const formAreaM2 = calculateArea(optionalNumber(formData, "length_m"), optionalNumber(formData, "width_m"), optionalNumber(formData, "area_m2"));
    const roofingMaterialInput = roofingMaterialInputFromForm(formData, formAreaM2);

    const { data: createdRows, error: createOrderError } = await supabase.rpc("create_order_with_jobsite", {
      p_company_id: context.companyId,
      p_customer_id: customer.id,
      p_title: title,
      p_order_type: orderType,
      p_status: status,
      p_priority: priority,
      p_jobsite_address: jobsiteAddress,
      p_start_date: startDate,
      p_end_date: optionalDate(formData, "end_date"),
      p_description: description,
      p_internal_notes: optionalString(formData, "internal_notes"),
      p_assigned_employee_ids: assignedEmployees.ids,
      p_has_dimensions: shouldCreateDimensions,
      p_created_by: context.userId
    });

    if (createOrderError) {
      if (isMissingRpcError(createOrderError, "create_order_with_jobsite")) {
        throw new SafeActionError(ORDER_RPC_SCHEMA_MISSING_MESSAGE);
      }
      throw new Error("order_atomic_insert_failed");
    }

    const createdOrder = (Array.isArray(createdRows) ? createdRows[0] : createdRows) as AtomicOrderCreationRow | null;
    if (!createdOrder?.order_id || !createdOrder.jobsite_id) {
      throw new Error("order_atomic_insert_empty");
    }

    createdOrderId = createdOrder.order_id;
    const createdJobsiteId = createdOrder.jobsite_id;

    if (context.canManage) {
      try {
        const roofingEstimate = await calculateRoofingMaterialsFromInventory({
          supabase,
          companyId: context.companyId,
          input: roofingMaterialInput
        });
        const manualMaterialTotal = positiveFormNumber(formData, "material_manual_total_net");
        const costInput = orderCostInputFromForm(formData, formAreaM2);

        await saveOrderCostEstimate({
          supabase,
          companyId: context.companyId,
          userId: context.userId,
          orderId: createdOrderId,
          input: {
            ...costInput,
            materialCostPerM2: manualMaterialTotal > 0 || roofingEstimate.purchaseTotal > 0 ? 0 : costInput.materialCostPerM2,
            materialManualTotalNet: manualMaterialTotal > 0 ? manualMaterialTotal : roofingEstimate.purchaseTotal
          },
          roofingEstimate
        });
      } catch (error) {
        costEstimateWarning = safeErrorMessage(
          error,
          "Auftrag wurde gespeichert, aber die Kostenkalkulation konnte noch nicht gespeichert werden."
        );
      }
    }

    if (shouldCreateDimensions) {
      const { data: settings } = await supabase
        .from("company_pricing_settings")
        .select("waste_percent")
        .eq("company_id", context.companyId)
        .maybeSingle();
      const dimensions = dimensionsFromForm(formData, Number(settings?.waste_percent ?? 20));

      const { data: dimension, error: dimensionError } = await supabase
        .from("job_dimensions")
        .insert({
          ...dimensions,
          company_id: context.companyId,
          order_id: createdOrderId,
          notes: optionalString(formData, "dimension_notes"),
          created_by: context.userId
        })
        .select("id")
        .single();

      if (dimensionError || !dimension) {
        throw new Error("dimension_insert_failed");
      }

      try {
        const requirementRows = await buildOrderMaterialRequirementRows({
          supabase,
          companyId: context.companyId,
          userId: context.userId,
          orderId: createdOrderId,
          dimensionId: dimension.id as string,
          jobsiteId: createdJobsiteId,
          orderType,
          dimensions,
          includePrices: context.canManage
        });

        if (requirementRows.length > 0) {
          const { error: requirementsError } = await supabase.from("job_material_requirements").insert(requirementRows);
          if (requirementsError) throw new Error("requirements_insert_failed");
        }
      } catch {
        materialCalculationWarning = "Maße wurden gespeichert, aber die Materialliste konnte noch nicht berechnet werden.";
      }
    }
  } catch (error) {
    const message = safeErrorMessage(error, "Auftrag konnte nicht gespeichert werden.");
    redirect(createdOrderId ? `/orders/${createdOrderId}?error=${toQuery(message)}` : `/orders/new?error=${toQuery(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath("/customers");
  revalidatePath("/baustellen");
  const successMessage =
    costEstimateWarning ??
    materialCalculationWarning ??
    (context.canManage
      ? hasDimensionInput(formData)
        ? "Auftrag, Maße, Materialbedarf und Kostenkalkulation wurden gespeichert."
        : "Auftrag und Kostenkalkulation wurden gespeichert."
      : hasDimensionInput(formData)
        ? "Auftrag, Maße und Materialbedarf wurden gespeichert."
        : "Auftrag wurde gespeichert.");

  redirect(
    `/orders/${createdOrderId}?success=${toQuery(successMessage)}`
  );
}

export async function updateOrderDimensionsAction(formData: FormData) {
  const context = await requirePermission("orders.edit", "/orders");
  const supabase = await createSupabaseServerClient();
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  let materialCalculationWarning: string | null = null;

  try {
    const { data: order } = await supabase
      .from("orders")
      .select("id, company_id, order_type, jobsite_id")
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .single();

    if (!order) throw new SafeActionError("Auftrag wurde nicht gefunden.");

    if (!hasDimensionInput(formData)) {
      throw new SafeActionError("Bitte mindestens Länge/Breite, Fläche oder eine relevante Länge eintragen.");
    }

    const { data: settings } = await supabase
      .from("company_pricing_settings")
      .select("waste_percent")
      .eq("company_id", context.companyId)
      .maybeSingle();

    const dimensions = dimensionsFromForm(formData, Number(settings?.waste_percent ?? 20));
    const dimension = await saveOrderDimensions({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      orderId,
      dimensions,
      notes: optionalString(formData, "dimension_notes")
    });

    const { data: updatedOrder, error: updateOrderError } = await supabase
      .from("orders")
      .update({ has_dimensions: true })
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .select("id")
      .maybeSingle();

    if (updateOrderError || !updatedOrder) {
      throw new SafeActionError("Auftrag wurde nicht gefunden.");
    }

    try {
      await archiveCurrentRequirements({ supabase, companyId: context.companyId, orderId });

      const requirementRows = await buildOrderMaterialRequirementRows({
        supabase,
        companyId: context.companyId,
        userId: context.userId,
        orderId,
        dimensionId: dimension.id as string,
        jobsiteId: (order.jobsite_id as string | null) ?? null,
        orderType: order.order_type as OrderType,
        dimensions,
        includePrices: context.canManage
      });

      if (requirementRows.length > 0) {
        const { error: insertError } = await supabase.from("job_material_requirements").insert(requirementRows);
        if (insertError) throw new Error("requirements_insert_failed");
      }
    } catch {
      materialCalculationWarning = "Maße wurden gespeichert, aber die Materialliste konnte noch nicht berechnet werden.";
    }
  } catch (error) {
    redirect(`/orders/${orderId}?error=${toQuery(safeErrorMessage(error, "Maße konnten nicht gespeichert werden."))}`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?success=${toQuery(materialCalculationWarning ?? "Maße und Materialbedarf wurden gespeichert.")}`);
}

export async function createOrderMeasurementItemAction(formData: FormData) {
  const context = await requirePermission("orders.edit", "/orders");
  const supabase = await createSupabaseServerClient();
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");

  try {
    const { data: order } = await supabase
      .from("orders")
      .select("id, company_id, order_type, jobsite_id")
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .single();

    if (!order) {
      throw new SafeActionError("Auftrag wurde nicht gefunden.");
    }

    const draft = measurementDraftFromForm(formData);
    const calculated = calculateMeasurementDraft(draft);
    const { error: insertError } = await supabase.from("order_measurement_items").insert({
      company_id: context.companyId,
      order_id: orderId,
      item_type: draft.item_type,
      label: draft.label,
      length_m: draft.length_m,
      width_m: draft.width_m,
      quantity: draft.quantity,
      pitch_deg: draft.pitch_deg,
      ...calculated,
      notes: draft.notes,
      created_by: context.userId
    });

    if (insertError) {
      throw new Error("measurement_item_insert_failed");
    }

    await syncDimensionsFromMeasurements({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      orderId,
      orderType: order.order_type as OrderType,
      jobsiteId: (order.jobsite_id as string | null) ?? null,
      includePrices: context.canManage
    });
  } catch (error) {
    redirect(`/orders/${orderId}?error=${toQuery(safeErrorMessage(error, "Aufmaßposition konnte nicht gespeichert werden."))}`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?success=${toQuery("Aufmaß wurde gespeichert und Material neu berechnet.")}`);
}

export async function archiveOrderMeasurementItemAction(formData: FormData) {
  const context = await requirePermission("orders.edit", "/orders");
  const supabase = await createSupabaseServerClient();
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const itemId = requiredFormUuid(formData, "item_id", "Aufmaßposition");

  try {
    const { data: order } = await supabase
      .from("orders")
      .select("id, company_id, order_type, jobsite_id")
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .single();

    if (!order) {
      throw new SafeActionError("Auftrag wurde nicht gefunden.");
    }

    const { data: archivedItem, error: archiveError } = await supabase
      .from("order_measurement_items")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", itemId)
      .eq("order_id", orderId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (archiveError || !archivedItem) {
      throw new SafeActionError("Aufmaßposition wurde nicht gefunden.");
    }

    await syncDimensionsFromMeasurements({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      orderId,
      orderType: order.order_type as OrderType,
      jobsiteId: (order.jobsite_id as string | null) ?? null,
      includePrices: context.canManage
    });
  } catch (error) {
    redirect(`/orders/${orderId}?error=${toQuery(safeErrorMessage(error, "Aufmaßposition konnte nicht archiviert werden."))}`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?success=${toQuery("Aufmaßposition wurde archiviert und Material neu berechnet.")}`);
}

export async function recalculateOrderMaterialsAction(formData: FormData) {
  const context = await requirePermission("orders.edit", "/orders");
  const supabase = await createSupabaseServerClient();
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");

  try {
    const [{ data: order }, { data: dimensions }] = await Promise.all([
      supabase
        .from("orders")
        .select("id, company_id, order_type, jobsite_id")
        .eq("id", orderId)
        .eq("company_id", context.companyId)
        .single(),
      supabase
        .from("job_dimensions")
        .select(jobDimensionSelect)
        .eq("order_id", orderId)
        .eq("company_id", context.companyId)
        .is("archived_at", null)
        .single()
    ]);

    if (!order || !dimensions) {
      throw new SafeActionError("Auftrag oder Maße wurden nicht gefunden.");
    }

    await archiveCurrentRequirements({ supabase, companyId: context.companyId, orderId });

    const requirementRows = await buildOrderMaterialRequirementRows({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      orderId,
      dimensionId: dimensions.id as string,
      jobsiteId: (order.jobsite_id as string | null) ?? null,
      orderType: order.order_type as OrderType,
      dimensions: dimensions as unknown as OrderDimensionValues,
      includePrices: context.canManage
    });

    if (requirementRows.length > 0) {
      const { error: insertError } = await supabase.from("job_material_requirements").insert(requirementRows);
      if (insertError) throw new Error("requirements_insert_failed");
    }
  } catch (error) {
    redirect(`/orders/${orderId}?error=${toQuery(safeErrorMessage(error, "Material konnte nicht neu berechnet werden."))}`);
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}?success=${toQuery("Materialbedarf wurde neu berechnet.")}`);
}

export async function updateOrderStatusAction(formData: FormData) {
  const context = await requirePermission("orders.edit", "/orders");
  const supabase = await createSupabaseServerClient();
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const status = orderStatusValue(formData.get("status"));
  const priority = orderPriorityValue(formData.get("priority"));

  const { data, error } = await supabase
    .from("orders")
    .update({ status, priority })
    .eq("id", orderId)
    .eq("company_id", context.companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/orders/${orderId}?error=${toQuery("Auftragsstatus konnte nicht gespeichert werden.")}`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?success=${toQuery("Auftragsstatus wurde gespeichert.")}`);
}
