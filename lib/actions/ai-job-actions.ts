"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bringListTemplates } from "@/lib/bring-list-templates";
import { requireManager } from "@/lib/auth";
import { searchOrFilter } from "@/lib/data/shared";
import { aiJobDraftSelect, customerFormSelect } from "@/lib/data/selects";
import { checkBringListAvailability } from "@/lib/inventory/check-availability";
import { generatePurchaseSuggestions } from "@/lib/inventory/purchase-suggestions";
import {
  buildJobDraftPreviewFromParsed,
  createJobDraftFromAI,
  dimensionsFromAiDraft,
  loadCalculationSettings
} from "@/lib/ai/job-drafts";
import { buildOrderMaterialRequirementRows, type OrderDimensionValues } from "@/lib/order-materials";
import { customerDisplayName } from "@/lib/order-labels";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { safeReturnPath } from "@/lib/security/redirects";
import { isMissingSchemaError, migrationMissingMessage } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalNumber, optionalString, requiredString, toBoolean } from "@/lib/utils";
import type { AiJobDraftParsed, AiJobDraftPreview, AiJobDraftRow } from "@/lib/ai/types";
import type { Customer, JobMaterialRequirement, JobsiteStatus, OrderPriority, OrderStatus, OrderType } from "@/types/app";

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function jobsiteStatusFromOrder(status: OrderStatus): JobsiteStatus {
  if (status === "in_arbeit") return "aktiv";
  if (status === "fertig" || status === "abgerechnet") return "abgeschlossen";
  return "geplant";
}

function orderTypeValue(value: FormDataEntryValue | null, fallback: OrderType): OrderType {
  const candidate = String(value ?? "");
  const values: OrderType[] = ["steildach", "flachdach", "reparatur", "dachrinne", "blech", "wartung", "sonstiges"];
  return values.includes(candidate as OrderType) ? (candidate as OrderType) : fallback;
}

function priorityValue(value: FormDataEntryValue | null, fallback: OrderPriority): OrderPriority {
  const candidate = String(value ?? "");
  const values: OrderPriority[] = ["niedrig", "normal", "hoch"];
  return values.includes(candidate as OrderPriority) ? (candidate as OrderPriority) : fallback;
}

function positiveInt(formData: FormData, key: string) {
  return Math.max(0, Math.round(optionalNumber(formData, key) ?? 0));
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

async function loadDraft({
  supabase,
  companyId,
  draftId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  draftId: string;
}) {
  const { data, error } = await supabase
    .from("ai_job_drafts")
    .select(aiJobDraftSelect)
    .eq("id", draftId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("KI-Auftragsentwurf wurde nicht gefunden.");
  return data as unknown as AiJobDraftRow;
}

async function resolveCustomer({
  supabase,
  companyId,
  userId,
  preview
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  preview: AiJobDraftPreview;
}) {
  const parsed = preview.parsed;
  if (parsed.existing_customer_id) {
    const { data } = await supabase
      .from("customers")
      .select(customerFormSelect)
      .eq("id", parsed.existing_customer_id)
      .eq("company_id", companyId)
      .maybeSingle();
    if (data) return data as unknown as Customer;
  }

  if (parsed.customer_name) {
    const search = parsed.customer_name.replace(/[(),%]/g, " ").trim();
    const { data } = await supabase
      .from("customers")
      .select(customerFormSelect)
      .eq("company_id", companyId)
      .or(searchOrFilter(["company", "last_name", "first_name"], search))
      .limit(1)
      .maybeSingle();
    if (data) return data as unknown as Customer;
  }

  if (!parsed.customer_name) throw new SafeActionError("Kunde fehlt. Bitte Entwurf ergaenzen.");
  const parts = parsed.customer_name.split(/\s+/).filter(Boolean);
  const { data, error } = await supabase
    .from("customers")
    .insert({
      company_id: companyId,
      customer_type: "privatkunde",
      company: parts.length > 2 ? parsed.customer_name : null,
      first_name: parts.length <= 2 ? parts.slice(0, -1).join(" ") || null : null,
      last_name: parts.length <= 2 ? parts.at(-1) ?? parsed.customer_name : null,
      jobsite_address: parsed.jobsite_address,
      billing_address: parsed.jobsite_address,
      notes: "Aus KI-Auftragsentwurf angelegt.",
      status: "aktiv",
      created_by: userId
    })
    .select(customerFormSelect)
    .single();

  if (error || !data) throw new Error("ai_customer_insert_failed");
  return data as unknown as Customer;
}

async function createBringListForOrder({
  supabase,
  companyId,
  userId,
  orderId,
  jobsiteId,
  title,
  orderType,
  requirements,
  reserve
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  orderId: string;
  jobsiteId: string;
  title: string;
  orderType: OrderType;
  requirements: JobMaterialRequirement[];
  reserve: boolean;
}) {
  const { data: list, error } = await supabase
    .from("bring_lists")
    .insert({
      company_id: companyId,
      job_id: jobsiteId,
      date: tomorrowIsoDate(),
      title: `Mitbringliste fuer ${title}`,
      notes: `Aus KI-Auftragsentwurf und Auftrag ${orderId} erzeugt.`,
      status: "ready",
      created_by: userId
    })
    .select("id")
    .single();

  if (error || !list) throw new Error("ai_bring_list_insert_failed");

  const materialItems = requirements.map((item) => ({
    bring_list_id: list.id,
    inventory_item_id: item.inventory_item_id,
    custom_item_name: item.material_name,
    item_type: "material",
    quantity: Number(item.total_quantity),
    unit: item.unit,
    storage_location: item.location_name
  }));
  const templateItems = bringListTemplates[orderType].map((item) => ({
    bring_list_id: list.id,
    inventory_item_id: null,
    custom_item_name: item.name,
    item_type: item.itemType,
    quantity: item.quantity,
    unit: item.unit,
    storage_location: null
  }));

  const { error: itemError } = await supabase.from("bring_list_items").insert([...materialItems, ...templateItems]);
  if (itemError) throw new Error("ai_bring_list_items_insert_failed");

  await checkBringListAvailability({ supabase, companyId, bringListId: list.id as string, reserve, reservedBy: reserve ? userId : undefined });
  return list.id as string;
}

async function insertEstimate({
  supabase,
  companyId,
  userId,
  orderId,
  draftId,
  preview
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  orderId: string;
  draftId: string;
  preview: AiJobDraftPreview;
}) {
  const estimate = preview.estimate;
  const { data, error } = await supabase
    .from("job_estimates")
    .insert({
      company_id: companyId,
      job_id: orderId,
      ai_job_draft_id: draftId,
      material_ek_total: estimate.material_ek_total,
      material_vk_total: estimate.material_vk_total,
      labor_hours_estimated: estimate.labor_hours_estimated,
      labor_rate_net: estimate.labor_rate_net,
      labor_total_net: estimate.labor_total_net,
      overhead_percent: estimate.overhead_percent,
      overhead_total: estimate.overhead_total,
      profit_markup_percent: estimate.profit_markup_percent,
      profit_total: estimate.profit_total,
      subtotal_net: estimate.subtotal_net,
      vat_rate: estimate.vat_rate,
      vat_total: estimate.vat_total,
      total_gross: estimate.total_gross,
      price_source_summary: estimate.price_source_summary,
      created_by: userId
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("ai_estimate_insert_failed");

  const rows = preview.items.map((item) => ({
    estimate_id: data.id,
    material_id: item.inventory_item_id,
    description: item.material_name,
    quantity: item.total_quantity,
    unit: item.unit,
    ek_unit_price: item.purchase_price,
    vk_unit_price: item.sales_price,
    ek_total: item.purchase_total,
    vk_total: item.sales_total,
    price_source: item.price_source,
    notes: item.missing_quantity > 0 ? `Fehlt: ${item.missing_quantity} ${item.unit}` : null
  }));

  if (rows.length) {
    const { error: itemError } = await supabase.from("job_estimate_items").insert(rows);
    if (itemError) throw new Error("ai_estimate_items_insert_failed");
  }
}

export async function prepareAiJobDraftAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const input = requiredString(formData, "raw_input");
  let target = "/ai/job-wizard";

  try {
    const settings = await loadCalculationSettings(supabase, context.companyId);
    if (!settings.allow_ai_job_creation) throw new SafeActionError("KI-Auftragserstellung ist in den Einstellungen deaktiviert.");

    const result = await createJobDraftFromAI({ supabase, context, input });
    if (!result.ok) {
      throw new SafeActionError(
        result.disabled ? result.message : "KI-Auftrag konnte nicht vorbereitet werden. Bitte Text pruefen oder spaeter erneut versuchen."
      );
    }

    const preview = result.data;
    const status = preview.parsed.confidence < 0.7 || preview.parsed.missing_fields.length ? "incomplete" : "proposed";
    const { data, error } = await supabase
      .from("ai_job_drafts")
      .insert({
        company_id: context.companyId,
        created_by: context.userId,
        raw_input: input,
        parsed_json: preview.parsed,
        preview_json: preview,
        confidence: preview.parsed.confidence,
        status,
        missing_fields: preview.parsed.missing_fields
      })
      .select("id")
      .single();

    if (error || !data) {
      if (error && isMissingSchemaError(error)) throw new SafeActionError(migrationMissingMessage("KI-Auftragswizard"));
      throw new Error("ai_job_draft_insert_failed");
    }

    await supabase.from("ai_actions").insert({
      company_id: context.companyId,
      user_id: context.userId,
      action_type: "ai_job_draft",
      raw_input: input,
      parsed_json: preview,
      confidence: preview.parsed.confidence,
      status: "proposed"
    });

    revalidatePath("/ai/job-wizard");
    target = `/ai/job-wizard?draft_id=${data.id}&success=${toQuery("KI-Auftragsentwurf wurde vorbereitet.")}`;
  } catch (error) {
    target = `/ai/job-wizard?error=${toQuery(safeErrorMessage(error, "KI-Auftrag konnte nicht vorbereitet werden."))}`;
  }

  redirect(target);
}

export async function rejectAiJobDraftAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const draftId = requiredString(formData, "draft_id");

  const { data, error } = await supabase
    .from("ai_job_drafts")
    .update({ status: "rejected" })
    .eq("id", draftId)
    .eq("company_id", context.companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/ai/job-wizard?error=${toQuery("KI-Auftragsentwurf wurde nicht gefunden.")}`);
  }

  revalidatePath("/ai/job-wizard");
  redirect(`/ai/job-wizard?success=${toQuery("KI-Auftragsentwurf wurde verworfen.")}`);
}

export async function saveAiJobDraftAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const draftId = requiredString(formData, "draft_id");

  const { data, error } = await supabase
    .from("ai_job_drafts")
    .update({ status: "incomplete" })
    .eq("id", draftId)
    .eq("company_id", context.companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/ai/job-wizard?error=${toQuery("KI-Auftragsentwurf wurde nicht gefunden.")}`);
  }

  revalidatePath("/ai/job-wizard");
  redirect(`/ai/job-wizard?draft_id=${draftId}&success=${toQuery("Entwurf bleibt gespeichert und unvollstaendig markiert.")}`);
}

export async function updateAiJobDraftPreviewAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const draftId = requiredString(formData, "draft_id");
  let target = `/ai/job-wizard?draft_id=${draftId}`;

  try {
    const draft = await loadDraft({ supabase, companyId: context.companyId, draftId });
    if (draft.status === "rejected") throw new SafeActionError("Verworfene Entwuerfe koennen nicht bearbeitet werden.");
    if (draft.converted_order_id) throw new SafeActionError("Dieser Entwurf wurde bereits in einen Auftrag umgewandelt.");

    const currentPreview = draft.preview_json as AiJobDraftPreview;
    const current = currentPreview.parsed;
    const parsed: AiJobDraftParsed = {
      ...current,
      customer_name: optionalString(formData, "customer_name"),
      title: optionalString(formData, "title") ?? current.title,
      order_type: orderTypeValue(formData.get("order_type"), current.order_type),
      priority: priorityValue(formData.get("priority"), current.priority),
      jobsite_name: optionalString(formData, "jobsite_name"),
      jobsite_address: optionalString(formData, "jobsite_address"),
      start_date: optionalString(formData, "start_date"),
      end_date: optionalString(formData, "end_date"),
      timeframe_text: optionalString(formData, "timeframe_text"),
      material_system: optionalString(formData, "material_system"),
      description: optionalString(formData, "description") ?? current.description,
      internal_notes: optionalString(formData, "internal_notes") ?? "",
      customer_friendly_description: optionalString(formData, "customer_friendly_description") ?? "",
      internal_work_instructions: optionalString(formData, "internal_work_instructions") ?? "",
      labor_hours_estimated: optionalNumber(formData, "labor_hours_estimated") ?? current.labor_hours_estimated,
      confidence: Math.max(Number(current.confidence ?? 0), 0.75),
      dimensions: {
        length_m: optionalNumber(formData, "length_m"),
        width_m: optionalNumber(formData, "width_m"),
        area_m2: optionalNumber(formData, "area_m2"),
        roof_pitch: optionalNumber(formData, "roof_pitch"),
        eaves_length_m: optionalNumber(formData, "eaves_length_m"),
        ridge_length_m: optionalNumber(formData, "ridge_length_m"),
        verge_length_m: optionalNumber(formData, "verge_length_m"),
        valley_length_m: optionalNumber(formData, "valley_length_m"),
        wall_connection_length_m: optionalNumber(formData, "wall_connection_length_m"),
        building_height_m: optionalNumber(formData, "building_height_m"),
        downpipe_length_m: optionalNumber(formData, "downpipe_length_m"),
        roof_windows_count: positiveInt(formData, "roof_windows_count"),
        penetrations_count: positiveInt(formData, "penetrations_count"),
        roof_drains_count: positiveInt(formData, "roof_drains_count"),
        emergency_overflows_count: positiveInt(formData, "emergency_overflows_count")
      }
    };

    const preview = await buildJobDraftPreviewFromParsed({ supabase, context, parsed });
    const status = preview.parsed.confidence < 0.7 || preview.parsed.missing_fields.length ? "incomplete" : "proposed";
    const { error } = await supabase
      .from("ai_job_drafts")
      .update({
        parsed_json: preview.parsed,
        preview_json: preview,
        confidence: preview.parsed.confidence,
        status,
        missing_fields: preview.parsed.missing_fields
      })
      .eq("id", draftId)
      .eq("company_id", context.companyId);

    if (error) {
      if (isMissingSchemaError(error)) throw new SafeActionError(migrationMissingMessage("KI-Auftragswizard"));
      throw new Error("ai_job_draft_update_failed");
    }
    revalidatePath("/ai/job-wizard");
    target = `/ai/job-wizard?draft_id=${draftId}&success=${toQuery("Entwurf wurde aktualisiert und neu berechnet.")}`;
  } catch (error) {
    target = `/ai/job-wizard?draft_id=${draftId}&error=${toQuery(
      safeErrorMessage(error, "KI-Entwurf konnte nicht aktualisiert werden.")
    )}`;
  }

  redirect(target);
}

export async function createOrderFromAiDraftAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const draftId = requiredString(formData, "draft_id");
  const nextAction = optionalString(formData, "next_action") ?? "order";
  let createdOrderId: string | null = null;
  let target = `/ai/job-wizard?draft_id=${draftId}`;

  try {
    const draft = await loadDraft({ supabase, companyId: context.companyId, draftId });
    if (draft.converted_order_id) {
      target = `/orders/${draft.converted_order_id}`;
    } else {
      if (draft.status === "rejected") throw new SafeActionError("Dieser KI-Entwurf wurde verworfen.");

      const preview = draft.preview_json as AiJobDraftPreview;
      const parsed = preview.parsed;
      if (!parsed.jobsite_address) throw new SafeActionError("Baustellenadresse fehlt.");
      if (!parsed.dimensions.area_m2 || parsed.dimensions.area_m2 <= 0) throw new SafeActionError("Maße oder Flaeche fehlen.");

      const customer = await resolveCustomer({ supabase, companyId: context.companyId, userId: context.userId, preview });
      const customerName = customerDisplayName(customer);
      const orderNumber = await nextOrderNumber(supabase, context.companyId);
      const orderStatus: OrderStatus = parsed.missing_fields.length ? "anfrage" : "angebot";

      const { data: jobsite, error: jobsiteError } = await supabase
        .from("jobsites")
        .insert({
          company_id: context.companyId,
          name: parsed.jobsite_name ?? parsed.title,
          customer: customerName,
          address: parsed.jobsite_address,
          start_date: parsed.start_date,
          status: jobsiteStatusFromOrder(orderStatus),
          notes: parsed.description,
          assigned_employee_ids: [],
          created_by: context.userId
        })
        .select("id")
        .single();
      if (jobsiteError || !jobsite) throw new Error("ai_jobsite_insert_failed");

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          company_id: context.companyId,
          customer_id: customer.id,
          jobsite_id: jobsite.id,
          order_number: orderNumber,
          title: parsed.title,
          order_type: parsed.order_type,
          status: orderStatus,
          priority: parsed.priority,
          jobsite_address: parsed.jobsite_address,
          start_date: parsed.start_date,
          end_date: parsed.end_date,
          description: parsed.customer_friendly_description || parsed.description,
          internal_notes: [parsed.internal_notes, parsed.internal_work_instructions, draft.raw_input].filter(Boolean).join("\n\n"),
          assigned_employee_ids: [],
          has_dimensions: true,
          created_by: context.userId
        })
        .select("id")
        .single();
      if (orderError || !order) throw new Error("ai_order_insert_failed");
      createdOrderId = order.id as string;

      const settings = await loadCalculationSettings(supabase, context.companyId);
      const dimensions: OrderDimensionValues = dimensionsFromAiDraft(parsed, settings.default_waste_percent);
      const { data: dimension, error: dimensionError } = await supabase
        .from("job_dimensions")
        .insert({
          ...dimensions,
          company_id: context.companyId,
          order_id: createdOrderId,
          notes: `Aus KI-Auftragsentwurf ${draft.id}`,
          created_by: context.userId
        })
        .select("id")
        .single();
      if (dimensionError || !dimension) throw new Error("ai_dimension_insert_failed");

      const requirements = (await buildOrderMaterialRequirementRows({
        supabase,
        companyId: context.companyId,
        userId: context.userId,
        orderId: createdOrderId,
        dimensionId: dimension.id as string,
        jobsiteId: jobsite.id as string,
        orderType: parsed.order_type,
        dimensions
      })) as unknown as JobMaterialRequirement[];

      if (requirements.length) {
        const { error: requirementError } = await supabase.from("job_material_requirements").insert(requirements);
        if (requirementError) throw new Error("ai_requirements_insert_failed");
      }

      for (const item of preview.items.filter((row) => row.missing_quantity > 0)) {
        await generatePurchaseSuggestions({
          supabase,
          companyId: context.companyId,
          inventoryItemId: item.inventory_item_id,
          jobId: jobsite.id as string,
          quantityNeeded: item.missing_quantity,
          unit: item.unit,
          reason: `KI-Auftrag ${parsed.title}: ${item.material_name} fehlt`
        });
      }

      await insertEstimate({
        supabase,
        companyId: context.companyId,
        userId: context.userId,
        orderId: createdOrderId,
        draftId,
        preview
      });

      let bringListId: string | null = null;
      if (nextAction === "order_bringlist" || nextAction === "order_bringlist_reserve") {
        bringListId = await createBringListForOrder({
          supabase,
          companyId: context.companyId,
          userId: context.userId,
          orderId: createdOrderId,
          jobsiteId: jobsite.id as string,
          title: parsed.title,
          orderType: parsed.order_type,
          requirements,
          reserve: nextAction === "order_bringlist_reserve"
        });
      }

      await supabase
        .from("ai_job_drafts")
        .update({ status: "converted_to_job", converted_order_id: createdOrderId })
        .eq("id", draftId)
        .eq("company_id", context.companyId);

      revalidatePath("/orders");
      revalidatePath("/ai/job-wizard");
      revalidatePath("/dashboard");
      target = bringListId
        ? `/bring-lists/${bringListId}?success=${toQuery("Auftrag und Mitbringliste wurden aus KI-Entwurf erstellt.")}`
        : `/orders/${createdOrderId}?success=${toQuery("Auftrag wurde aus KI-Entwurf erstellt.")}`;
    }
  } catch (error) {
    const base = createdOrderId ? `/orders/${createdOrderId}` : `/ai/job-wizard?draft_id=${draftId}`;
    const separator = base.includes("?") ? "&" : "?";
    target = `${base}${separator}error=${toQuery(safeErrorMessage(error, "KI-Auftrag konnte nicht erstellt werden."))}`;
  }

  redirect(target);
}

function positiveSetting(value: number | null, fallback: number) {
  if (value === null || !Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

export async function updateCalculationSettingsAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const current = await loadCalculationSettings(supabase, context.companyId);
  const returnTo = safeReturnPath(formData.get("return_to"), "/settings");

  const values = {
    company_id: context.companyId,
    default_waste_percent: positiveSetting(optionalNumber(formData, "default_waste_percent"), current.default_waste_percent),
    default_vat_rate: positiveSetting(optionalNumber(formData, "default_vat_rate"), current.default_vat_rate),
    default_labor_rate_net: positiveSetting(optionalNumber(formData, "default_labor_rate_net"), current.default_labor_rate_net),
    default_internal_hourly_cost: positiveSetting(optionalNumber(formData, "default_internal_hourly_cost"), current.default_internal_hourly_cost),
    default_profit_markup_percent: positiveSetting(
      optionalNumber(formData, "default_profit_markup_percent"),
      current.default_profit_markup_percent
    ),
    default_overhead_percent: positiveSetting(optionalNumber(formData, "default_overhead_percent"), current.default_overhead_percent),
    default_travel_rate_per_km: positiveSetting(optionalNumber(formData, "default_travel_rate_per_km"), current.default_travel_rate_per_km),
    default_travel_flat_rate: positiveSetting(optionalNumber(formData, "default_travel_flat_rate"), current.default_travel_flat_rate),
    allow_ai_job_creation: toBoolean(formData, "allow_ai_job_creation"),
    require_admin_confirmation: toBoolean(formData, "require_admin_confirmation")
  };

  const { error } = await supabase.from("calculation_settings").upsert(values, { onConflict: "company_id" });
  if (error) {
    const message = isMissingSchemaError(error)
      ? migrationMissingMessage("KI-Kalkulationseinstellungen")
      : "KI-Kalkulationseinstellungen konnten nicht gespeichert werden.";
    redirect(`${returnTo}?error=${toQuery(message)}`);
  }

  revalidatePath("/settings");
  revalidatePath("/ai/job-wizard");
  redirect(`${returnTo}?success=${toQuery("KI-Kalkulationseinstellungen wurden gespeichert.")}`);
}
