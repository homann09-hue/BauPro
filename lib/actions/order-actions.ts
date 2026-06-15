"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { calculateArea } from "@/lib/material-calculations";
import { customerDisplayName } from "@/lib/order-labels";
import { buildOrderMaterialRequirementRows, type OrderDimensionValues } from "@/lib/order-materials";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  formIds,
  numberOrZero,
  optionalDate,
  optionalNumber,
  optionalString,
  requiredString
} from "@/lib/utils";
import type { Customer, JobsiteStatus, OrderPriority, OrderStatus, OrderType } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
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

function orderPriorityValue(value: FormDataEntryValue | null): OrderPriority {
  const priority = String(value ?? "normal");
  return priority === "niedrig" || priority === "hoch" ? priority : "normal";
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
    return { ids: [] as string[], error: error.message };
  }

  return { ids: (data ?? []).map((profile) => profile.id as string), error: null as string | null };
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
  const selectedCustomerId = optionalString(formData, "customer_id");

  if (selectedCustomerId && selectedCustomerId !== "new") {
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .eq("id", selectedCustomerId)
      .eq("company_id", companyId)
      .single();

    if (error || !data) {
      throw new Error("Kunde wurde nicht gefunden.");
    }

    return data as Customer;
  }

  const company = optionalString(formData, "new_customer_company");
  const firstName = optionalString(formData, "new_customer_first_name");
  const lastName = optionalString(formData, "new_customer_last_name");

  if (!company && !firstName && !lastName) {
    throw new Error("Bitte einen bestehenden Kunden waehlen oder einen neuen Kunden eintragen.");
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
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Kunde konnte nicht angelegt werden.");
  }

  return data as Customer;
}

export async function createOrderAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  let createdOrderId: string | null = null;

  try {
    const assignedEmployees = await getAssignableEmployeeIds(supabase, formData, context.companyId);
    if (assignedEmployees.error) throw new Error(assignedEmployees.error);

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
        throw new Error("Bitte eine Baustellenadresse eintragen.");
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
      throw new Error(jobsiteError?.message ?? "Baustelle konnte nicht aus dem Auftrag erzeugt werden.");
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
      throw new Error(orderError?.message ?? "Auftrag konnte nicht gespeichert werden.");
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
        throw new Error(dimensionError?.message ?? "Maße konnten nicht gespeichert werden.");
      }

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
        if (requirementsError) throw new Error(requirementsError.message);
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auftrag konnte nicht gespeichert werden.";
    redirect(createdOrderId ? `/orders/${createdOrderId}?error=${toQuery(message)}` : `/orders/new?error=${toQuery(message)}`);
  }

  revalidatePath("/orders");
  revalidatePath("/customers");
  revalidatePath("/baustellen");
  redirect(`/orders/${createdOrderId}?success=${toQuery("Auftrag wurde angelegt und Materialbedarf berechnet.")}`);
}

export async function recalculateOrderMaterialsAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const orderId = requiredString(formData, "order_id");

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
        .select("*")
        .eq("order_id", orderId)
        .eq("company_id", context.companyId)
        .single()
    ]);

    if (!order || !dimensions) {
      throw new Error("Auftrag oder Maße wurden nicht gefunden.");
    }

    const { error: deleteError } = await supabase
      .from("job_material_requirements")
      .delete()
      .eq("order_id", orderId)
      .eq("company_id", context.companyId);

    if (deleteError) throw new Error(deleteError.message);

    const requirementRows = await buildOrderMaterialRequirementRows({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      orderId,
      dimensionId: dimensions.id as string,
      jobsiteId: (order.jobsite_id as string | null) ?? null,
      orderType: order.order_type as OrderType,
      dimensions: dimensions as OrderDimensionValues
    });

    if (requirementRows.length > 0) {
      const { error: insertError } = await supabase.from("job_material_requirements").insert(requirementRows);
      if (insertError) throw new Error(insertError.message);
    }
  } catch (error) {
    redirect(
      `/orders/${orderId}?error=${toQuery(error instanceof Error ? error.message : "Material konnte nicht neu berechnet werden.")}`
    );
  }

  revalidatePath(`/orders/${orderId}`);
  redirect(`/orders/${orderId}?success=${toQuery("Materialbedarf wurde neu berechnet.")}`);
}

export async function updateOrderStatusAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const orderId = requiredString(formData, "order_id");
  const status = orderStatusValue(formData.get("status"));
  const priority = orderPriorityValue(formData.get("priority"));

  const { error } = await supabase
    .from("orders")
    .update({ status, priority })
    .eq("id", orderId)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/orders/${orderId}?error=${toQuery(error.message)}`);
  }

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/orders");
  redirect(`/orders/${orderId}?success=${toQuery("Auftragsstatus wurde gespeichert.")}`);
}
