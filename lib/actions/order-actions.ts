"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { customerFormSelect, jobDimensionSelect, orderMeasurementItemSelect } from "@/lib/data/selects";
import { calculateArea } from "@/lib/material-calculations";
import { customerDisplayName } from "@/lib/order-labels";
import {
  aggregateMeasurementItems,
  calculateMeasurementDraft,
  orderMeasurementItemTypeLabels,
  type MeasurementDraft
} from "@/lib/order-measurements";
import { buildOrderMaterialRequirementRows, type OrderDimensionValues } from "@/lib/order-materials";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { optionalFormUuid, requiredFormUuid } from "@/lib/security/form-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formIds,
  numberOrZero,
  optionalDate,
  optionalNumber,
  optionalString,
  requiredString
} from "@/lib/utils";
import type { Customer, JobsiteStatus, OrderMeasurementItem, OrderMeasurementItemType, OrderPriority, OrderStatus, OrderType } from "@/types/app";

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

function jobsiteStatusFromOrder(status: OrderStatus): JobsiteStatus {
  if (status === "in_arbeit") return "aktiv";
  if (status === "fertig" || status === "abgerechnet") return "abgeschlossen";
  return "geplant";
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
    throw new SafeActionError("Fuer Flaechen bitte Laenge und Breite groesser 0 eintragen.");
  }

  if (
    ["eaves_length", "ridge_length", "verge_length", "valley_length", "wall_connection_length", "downpipe_length"].includes(itemType) &&
    !(draft.length_m && draft.length_m > 0)
  ) {
    throw new SafeActionError("Fuer laufende Meter bitte eine Laenge groesser 0 eintragen.");
  }

  if (["roof_window", "penetration", "roof_drain", "emergency_overflow"].includes(itemType) && draft.quantity <= 0) {
    throw new SafeActionError("Fuer Stueckzahlen bitte eine Anzahl groesser 0 eintragen.");
  }

  return draft;
}

async function syncDimensionsFromMeasurements({
  supabase,
  companyId,
  userId,
  orderId,
  orderType,
  jobsiteId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  orderId: string;
  orderType: OrderType;
  jobsiteId: string | null;
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
    notes: "Automatisch aus Aufmasspositionen erzeugt."
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
    dimensions
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

async function nextOrderNumber(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string
) {
  const year = new Date().getFullYear();
  const prefix = `AU-${year}-`;

  const { data } = await supabase
    .from("orders")
    .select("order_number")
    .eq("company_id", companyId)
    .like("order_number", `${prefix}%`)
    .order("order_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNumber = Number(String(data?.order_number ?? "").replace(prefix, "")) || 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

async function resolveCustomer(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  formData: FormData,
  companyId: string,
  userId: string
) {
  const selectedCustomerIdRaw = optionalString(formData, "customer_id");

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
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  let createdOrderId: string | null = null;
  let materialCalculationWarning: string | null = null;

  try {
    const assignedEmployees = await getAssignableEmployeeIds(supabase, formData, context.companyId);
    if (assignedEmployees.error) throw new SafeActionError(assignedEmployees.error);

    const customer = await resolveCustomer(supabase, formData, context.companyId, context.userId);
    const title = requiredString(formData, "title");
    const orderType = orderTypeValue(formData.get("order_type"));
    const status = orderStatusValue(formData.get("status"));
    const priority = orderPriorityValue(formData.get("priority"));
    const jobsiteAddress =
      optionalString(formData, "jobsite_address") ??
      customer.jobsite_address ??
      customer.billing_address ??
      (() => {
        throw new SafeActionError("Bitte eine Baustellenadresse eintragen.");
      })();
    const description = optionalString(formData, "description");
    const orderNumber = await nextOrderNumber(supabase, context.companyId);
    const customerName = customerDisplayName(customer);
    const shouldCreateDimensions = hasDimensionInput(formData);

    const { data: jobsite, error: jobsiteError } = await supabase
      .from("jobsites")
      .insert({
        company_id: context.companyId,
        name: title,
        customer: customerName,
        address: jobsiteAddress,
        start_date: optionalDate(formData, "start_date"),
        status: jobsiteStatusFromOrder(status),
        notes: description,
        assigned_employee_ids: assignedEmployees.ids,
        created_by: context.userId
      })
      .select("id")
      .single();

    if (jobsiteError || !jobsite) {
      throw new Error("jobsite_insert_failed");
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        company_id: context.companyId,
        customer_id: customer.id,
        jobsite_id: jobsite.id,
        order_number: orderNumber,
        title,
        order_type: orderType,
        status,
        priority,
        jobsite_address: jobsiteAddress,
        start_date: optionalDate(formData, "start_date"),
        end_date: optionalDate(formData, "end_date"),
        description,
        internal_notes: optionalString(formData, "internal_notes"),
        assigned_employee_ids: assignedEmployees.ids,
        has_dimensions: shouldCreateDimensions,
        created_by: context.userId
      })
      .select("id")
      .single();

    if (orderError || !order) {
      throw new Error("order_insert_failed");
    }

    createdOrderId = order.id as string;

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
          jobsiteId: jobsite.id as string,
          orderType,
          dimensions
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
  redirect(
    `/orders/${createdOrderId}?success=${toQuery(
      materialCalculationWarning ?? (hasDimensionInput(formData) ? "Auftrag, Maße und Materialbedarf wurden gespeichert." : "Auftrag wurde angelegt.")
    )}`
  );
}

export async function updateOrderDimensionsAction(formData: FormData) {
  const context = await requireManager();
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
        dimensions
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
  const context = await requireManager();
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
      jobsiteId: (order.jobsite_id as string | null) ?? null
    });
  } catch (error) {
    redirect(`/orders/${orderId}?error=${toQuery(safeErrorMessage(error, "Aufmassposition konnte nicht gespeichert werden."))}`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?success=${toQuery("Aufmass wurde gespeichert und Material neu berechnet.")}`);
}

export async function archiveOrderMeasurementItemAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const itemId = requiredFormUuid(formData, "item_id", "Aufmassposition");

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
      throw new SafeActionError("Aufmassposition wurde nicht gefunden.");
    }

    await syncDimensionsFromMeasurements({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      orderId,
      orderType: order.order_type as OrderType,
      jobsiteId: (order.jobsite_id as string | null) ?? null
    });
  } catch (error) {
    redirect(`/orders/${orderId}?error=${toQuery(safeErrorMessage(error, "Aufmassposition konnte nicht archiviert werden."))}`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?success=${toQuery("Aufmassposition wurde archiviert und Material neu berechnet.")}`);
}

export async function recalculateOrderMaterialsAction(formData: FormData) {
  const context = await requireManager();
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
      dimensions: dimensions as unknown as OrderDimensionValues
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
  const context = await requireManager();
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
