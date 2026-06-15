"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  ASSISTANT_ANSWER_SCHEMA,
  BUSINESS_INPUT_SCHEMA,
  DAILY_REPORT_SCHEMA,
  MATERIAL_MATCH_SCHEMA,
  assistantPrompt,
  businessInputPrompt,
  dailyReportPrompt,
  materialMatchPrompt,
  roleAwareSystemPrompt
} from "@/lib/ai/prompts";
import { createStructuredAiResponse, getOpenAiModel } from "@/lib/ai/openai";
import { aiRuntimeState, canUseAiFeature, loadAiSettings, removePricesForEmployees } from "@/lib/ai/permissions";
import { logAiUsage } from "@/lib/ai/usage-log";
import { requireAppContext, requireManager } from "@/lib/auth";
import { safeErrorMessage } from "@/lib/security/errors";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { isMissingSchemaError, migrationMissingMessage } from "@/lib/supabase/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString, toBoolean } from "@/lib/utils";
import type {
  AiActionRow,
  AiAssistantAnswer,
  AiFeature,
  ClassifiedBusinessInput,
  DailyReportDraft,
  MaterialMatchDraft
} from "@/lib/ai/types";

type QueryResult = {
  data: unknown;
  error: PostgrestError | null;
};

type ActionResult<T> = {
  ok: boolean;
  configured: boolean;
  message: string;
  actionId?: string | null;
  result?: T;
};

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function compactJson(value: unknown) {
  return JSON.stringify(value, null, 2).slice(0, 9000);
}

function clampConfidence(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

async function safeList<T>(query: PromiseLike<QueryResult>) {
  const { data, error } = await query;
  if (error) return [];
  return Array.isArray(data) ? (data as T[]) : [];
}

async function getAiGate(feature: AiFeature) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const settings = await loadAiSettings(supabase, context.companyId);
  const runtime = aiRuntimeState(context, settings);
  let allowed = canUseAiFeature(context, settings, feature);

  try {
    assertRateLimit(`ai:${feature}:${context.companyId}:${context.userId}`, context.canManage ? 60 : 25, 60_000);
  } catch (error) {
    allowed = false;
    runtime.message = safeErrorMessage(error, "Zu viele KI-Anfragen in kurzer Zeit.");
  }

  if (!runtime.configured) {
    await logAiUsage({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      feature,
      model: runtime.model,
      status: "disabled",
      errorMessage: runtime.message
    });
  }

  return { context, supabase, settings, runtime, allowed };
}

async function createAiActionProposal({
  companyId,
  userId,
  actionType,
  rawInput,
  parsedJson,
  confidence
}: {
  companyId: string;
  userId: string;
  actionType: string;
  rawInput: string;
  parsedJson: ClassifiedBusinessInput;
  confidence: number;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_actions")
    .insert({
      company_id: companyId,
      user_id: userId,
      action_type: actionType,
      raw_input: rawInput,
      parsed_json: parsedJson,
      confidence,
      status: "proposed"
    })
    .select("id")
    .single();

  if (error) {
    if (!isMissingSchemaError(error)) console.error("AI action proposal failed", error.message);
    return null;
  }

  return (data?.id as string | undefined) ?? null;
}

async function loadBusinessContext() {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const inventorySource = context.canManage ? "inventory_items" : "inventory_items_public";

  const [jobsites, customers, inventoryItems] = await Promise.all([
    safeList<{ id: string; name: string; customer: string; address: string; status: string }>(
      supabase
        .from("jobsites")
        .select("id, name, customer, address, status")
        .eq("company_id", context.companyId)
        .in("status", ["geplant", "aktiv"])
        .order("name", { ascending: true })
        .limit(40)
    ),
    context.canManage
      ? safeList<{ id: string; company: string | null; first_name: string | null; last_name: string | null; contact_person: string | null }>(
          supabase
            .from("customers")
            .select("id, company, first_name, last_name, contact_person")
            .eq("company_id", context.companyId)
            .eq("status", "aktiv")
            .limit(40)
        )
      : Promise.resolve([]),
    safeList<Record<string, unknown>>(
      supabase
        .from(inventorySource)
        .select("id, name, unit, stock, minimum_stock, manufacturer, article_number")
        .eq("company_id", context.companyId)
        .order("name", { ascending: true })
        .limit(80)
    )
  ]);

  return {
    today: new Date().toISOString().slice(0, 10),
    role: context.profile.role,
    can_manage: context.canManage,
    jobsites,
    customers,
    inventory_items: inventoryItems.map((item) => removePricesForEmployees(context, item))
  };
}

async function loadAssistantContext() {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().slice(0, 10);
  const inventorySelect = context.canManage
    ? "id, name, unit, stock, minimum_stock, purchase_price, sales_price, supplier_id"
    : "id, name, unit, stock, minimum_stock, location_name";
  const inventorySource = context.canManage ? "inventory_items" : "inventory_items_public";

  const [jobsites, orders, timeEntries, bringLists, inventory, materialAlerts, purchaseSuggestions] = await Promise.all([
    safeList<Record<string, unknown>>(
      supabase
        .from("jobsites")
        .select("id, name, customer, address, start_date, status")
        .eq("company_id", context.companyId)
        .in("status", ["geplant", "aktiv"])
        .order("start_date", { ascending: true, nullsFirst: false })
        .limit(30)
    ),
    safeList<Record<string, unknown>>(
      supabase
        .from("orders")
        .select("id, order_number, title, order_type, status, priority, start_date, jobsite_address, assigned_employee_ids")
        .eq("company_id", context.companyId)
        .order("created_at", { ascending: false })
        .limit(30)
    ),
    safeList<Record<string, unknown>>(
      (context.canManage
        ? supabase.from("time_entries").select("id, employee_id, job_id, date, start_time, end_time, break_minutes, net_minutes, activity, status")
        : supabase
            .from("time_entries")
            .select("id, employee_id, job_id, date, start_time, end_time, break_minutes, net_minutes, activity, status")
            .eq("employee_id", context.userId)
      )
        .eq("company_id", context.companyId)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(40)
    ),
    safeList<Record<string, unknown>>(
      supabase
        .from("bring_lists")
        .select("id, job_id, date, title, status, assigned_to, created_by")
        .eq("company_id", context.companyId)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(40)
    ),
    safeList<Record<string, unknown>>(
      supabase
        .from(inventorySource)
        .select(inventorySelect)
        .eq("company_id", context.companyId)
        .order("stock", { ascending: true })
        .limit(60)
    ),
    context.canManage
      ? safeList<Record<string, unknown>>(
          supabase
            .from("material_alerts")
            .select("id, job_id, bring_list_id, alert_type, severity, message, missing_quantity, unit, status")
            .eq("company_id", context.companyId)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(30)
        )
      : Promise.resolve([]),
    context.canManage
      ? safeList<Record<string, unknown>>(
          supabase
            .from("purchase_suggestions")
            .select("id, job_id, bring_list_id, quantity_needed, unit, reason, status")
            .eq("company_id", context.companyId)
            .eq("status", "open")
            .order("created_at", { ascending: false })
            .limit(30)
        )
      : Promise.resolve([])
  ]);

  return {
    today,
    user: {
      id: context.userId,
      name: context.profile.full_name,
      role: context.profile.role,
      can_manage: context.canManage
    },
    jobsites,
    orders: context.canManage
      ? orders
      : orders.filter((order) => Array.isArray(order.assigned_employee_ids) && order.assigned_employee_ids.includes(context.userId)),
    time_entries: timeEntries,
    bring_lists: context.canManage
      ? bringLists
      : bringLists.filter((list) => list.assigned_to === context.userId || list.created_by === context.userId),
    inventory: inventory.map((item) => removePricesForEmployees(context, item)),
    material_alerts: materialAlerts,
    purchase_suggestions: purchaseSuggestions
  };
}

export async function classifyBusinessInputAction(rawInput: string): Promise<ActionResult<ClassifiedBusinessInput>> {
  const input = rawInput.trim();
  const { context, supabase, runtime, allowed } = await getAiGate("business_input");

  if (!input) {
    return { ok: false, configured: runtime.configured, message: "Bitte Text eingeben." };
  }

  if (!runtime.enabled || !allowed) {
    return {
      ok: false,
      configured: runtime.configured,
      message: runtime.message ?? "KI ist fuer diese Rolle oder Funktion deaktiviert."
    };
  }

  const businessContext = await loadBusinessContext();
  const result = await createStructuredAiResponse<ClassifiedBusinessInput>({
    feature: "business_input",
    system: roleAwareSystemPrompt(context.profile.role, context.canManage),
    user: `${businessInputPrompt(compactJson(businessContext))}\n\nEingabe:\n${input}`,
    schema: BUSINESS_INPUT_SCHEMA,
    schemaName: "baupro_business_input"
  });

  await logAiUsage({
    supabase,
    companyId: context.companyId,
    userId: context.userId,
    feature: "business_input",
    model: result.model,
    inputTokens: result.ok ? result.inputTokens : result.inputTokens ?? null,
    outputTokens: result.ok ? result.outputTokens : result.outputTokens ?? null,
    status: result.ok ? "success" : result.disabled ? "disabled" : "error",
    errorMessage: result.ok ? null : result.message
  });

  if (!result.ok) {
    return {
      ok: false,
      configured: runtime.configured,
      message: result.message
    };
  }

  const parsed = {
    ...result.data,
    confidence: clampConfidence(result.data.confidence),
    materials: result.data.materials ?? [],
    tools: result.data.tools ?? [],
    follow_up_questions: result.data.follow_up_questions ?? []
  };
  const actionId = await createAiActionProposal({
    companyId: context.companyId,
    userId: context.userId,
    actionType: parsed.intent,
    rawInput: input,
    parsedJson: parsed,
    confidence: parsed.confidence
  });

  return {
    ok: true,
    configured: true,
    message: parsed.confidence < 0.7 ? "KI ist unsicher. Bitte Angaben pruefen." : "KI-Vorschlag erstellt.",
    actionId,
    result: parsed
  };
}

export async function generateDailyReportDraftAction(rawInput: string): Promise<ActionResult<DailyReportDraft>> {
  const input = rawInput.trim();
  const { context, supabase, runtime, allowed } = await getAiGate("daily_report");

  if (!input) {
    return { ok: false, configured: runtime.configured, message: "Bitte Stichpunkte oder Diktat eingeben." };
  }

  if (!runtime.enabled || !allowed) {
    return {
      ok: false,
      configured: runtime.configured,
      message: runtime.message ?? "KI-Tagesberichte sind deaktiviert."
    };
  }

  const businessContext = await loadBusinessContext();
  const result = await createStructuredAiResponse<DailyReportDraft>({
    feature: "daily_report",
    system: roleAwareSystemPrompt(context.profile.role, context.canManage),
    user: `${dailyReportPrompt(compactJson(businessContext))}\n\nStichpunkte:\n${input}`,
    schema: DAILY_REPORT_SCHEMA,
    schemaName: "baupro_daily_report"
  });

  await logAiUsage({
    supabase,
    companyId: context.companyId,
    userId: context.userId,
    feature: "daily_report",
    model: result.model,
    inputTokens: result.ok ? result.inputTokens : result.inputTokens ?? null,
    outputTokens: result.ok ? result.outputTokens : result.outputTokens ?? null,
    status: result.ok ? "success" : result.disabled ? "disabled" : "error",
    errorMessage: result.ok ? null : result.message
  });

  if (!result.ok) {
    return { ok: false, configured: runtime.configured, message: result.message };
  }

  return { ok: true, configured: true, message: "Tagesbericht-Entwurf erstellt.", result: result.data };
}

export async function askAiAssistantAction(rawInput: string): Promise<ActionResult<AiAssistantAnswer>> {
  const input = rawInput.trim();
  const { context, supabase, runtime, allowed } = await getAiGate("assistant_chat");

  if (!input) {
    return { ok: false, configured: runtime.configured, message: "Bitte Frage eingeben." };
  }

  if (!runtime.enabled || !allowed) {
    return {
      ok: false,
      configured: runtime.configured,
      message: runtime.message ?? "KI-Assistent ist fuer diese Rolle deaktiviert."
    };
  }

  const assistantContext = await loadAssistantContext();
  const result = await createStructuredAiResponse<AiAssistantAnswer>({
    feature: "assistant_chat",
    system: roleAwareSystemPrompt(context.profile.role, context.canManage),
    user: `${assistantPrompt(compactJson(assistantContext))}\n\nFrage:\n${input}`,
    schema: ASSISTANT_ANSWER_SCHEMA,
    schemaName: "baupro_assistant_answer",
    maxOutputTokens: 1500
  });

  await logAiUsage({
    supabase,
    companyId: context.companyId,
    userId: context.userId,
    feature: "assistant_chat",
    model: result.model,
    inputTokens: result.ok ? result.inputTokens : result.inputTokens ?? null,
    outputTokens: result.ok ? result.outputTokens : result.outputTokens ?? null,
    status: result.ok ? "success" : result.disabled ? "disabled" : "error",
    errorMessage: result.ok ? null : result.message
  });

  if (!result.ok) {
    return { ok: false, configured: runtime.configured, message: result.message };
  }

  return { ok: true, configured: true, message: "Antwort erstellt.", result: result.data };
}

export async function matchMaterialNameAction(rawInput: string): Promise<ActionResult<MaterialMatchDraft>> {
  const input = rawInput.trim();
  const { context, supabase, runtime, allowed } = await getAiGate("material_matching");

  if (!input) {
    return { ok: false, configured: runtime.configured, message: "Bitte Materialname eingeben." };
  }

  if (!runtime.enabled || !allowed) {
    return {
      ok: false,
      configured: runtime.configured,
      message: runtime.message ?? "KI-Materialabgleich ist deaktiviert."
    };
  }

  const catalog = await safeList<Record<string, unknown>>(
    supabase
      .from("material_catalog")
      .select("id, name, unit, manufacturer, article_number, search_terms")
      .eq("active", true)
      .ilike("name", `%${input.split(/\s+/)[0] ?? input}%`)
      .limit(30)
  );

  const result = await createStructuredAiResponse<MaterialMatchDraft>({
    feature: "material_matching",
    system: roleAwareSystemPrompt(context.profile.role, context.canManage),
    user: `${materialMatchPrompt(compactJson({ catalog }))}\n\nMaterial:\n${input}`,
    schema: MATERIAL_MATCH_SCHEMA,
    schemaName: "baupro_material_match"
  });

  await logAiUsage({
    supabase,
    companyId: context.companyId,
    userId: context.userId,
    feature: "material_matching",
    model: result.model,
    inputTokens: result.ok ? result.inputTokens : result.inputTokens ?? null,
    outputTokens: result.ok ? result.outputTokens : result.outputTokens ?? null,
    status: result.ok ? "success" : result.disabled ? "disabled" : "error",
    errorMessage: result.ok ? null : result.message
  });

  if (!result.ok) {
    return { ok: false, configured: runtime.configured, message: result.message };
  }

  return { ok: true, configured: true, message: "Materialvorschlag erstellt.", result: result.data };
}

export async function getProposedAiActionForUser(actionId: string) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_actions")
    .select("*")
    .eq("id", actionId)
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as AiActionRow;
}

export async function markAiActionStatus({
  actionId,
  status,
  linkedJobId,
  linkedTimeEntryId,
  linkedBringListId
}: {
  actionId: string | null;
  status: "confirmed" | "rejected" | "executed";
  linkedJobId?: string | null;
  linkedTimeEntryId?: string | null;
  linkedBringListId?: string | null;
}) {
  if (!actionId) return;

  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_actions")
    .update({
      status,
      linked_job_id: linkedJobId ?? null,
      linked_time_entry_id: linkedTimeEntryId ?? null,
      linked_bring_list_id: linkedBringListId ?? null,
      confirmed_at: status === "rejected" ? null : new Date().toISOString()
    })
    .eq("id", actionId)
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId);

  if (error && !isMissingSchemaError(error)) {
    console.error("AI action status update failed", error.message);
  }
}

export async function updateAiSettingsAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const defaultModel = optionalString(formData, "default_model") ?? getOpenAiModel();

  const { error } = await supabase.from("ai_settings").upsert(
    {
      company_id: context.companyId,
      enabled: toBoolean(formData, "enabled"),
      default_model: defaultModel,
      allow_employee_ai: toBoolean(formData, "allow_employee_ai"),
      allow_ai_daily_reports: toBoolean(formData, "allow_ai_daily_reports"),
      allow_ai_time_tracking: toBoolean(formData, "allow_ai_time_tracking"),
      allow_ai_material_matching: toBoolean(formData, "allow_ai_material_matching"),
      updated_at: new Date().toISOString()
    },
    { onConflict: "company_id" }
  );

  if (error) {
    const message = isMissingSchemaError(error)
      ? migrationMissingMessage("KI-Einstellungen")
      : "KI-Einstellungen konnten nicht gespeichert werden.";
    redirect(`/settings?error=${toQuery(message)}`);
  }

  revalidatePath("/settings");
  redirect(`/settings?success=${toQuery("KI-Einstellungen gespeichert.")}`);
}
