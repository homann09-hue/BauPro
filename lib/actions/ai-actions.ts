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
import { checkAiLimit } from "@/lib/billing/plans";
import { searchOrFilter } from "@/lib/data/shared";
import { aiActionSelect } from "@/lib/data/selects";
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
  DailyReportAutomationPayload,
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

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
}

function textValue(row: Record<string, unknown>, key: string, fallback = "") {
  const value = row[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(row: Record<string, unknown>, key: string) {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function shortList(rows: Record<string, unknown>[], label: (row: Record<string, unknown>) => string, empty: string) {
  if (rows.length === 0) return empty;
  return rows.slice(0, 6).map((row) => `- ${label(row)}`).join("\n");
}

function localAssistantFallback(input: string, assistantContext: Record<string, unknown>, canManage: boolean): AiAssistantAnswer {
  const lowerInput = input.toLowerCase();
  const inventory = records(assistantContext.inventory);
  const jobsites = records(assistantContext.jobsites);
  const bringLists = records(assistantContext.bring_lists);
  const timeEntries = records(assistantContext.time_entries);
  const materialAlerts = canManage ? records(assistantContext.material_alerts) : [];
  const purchaseSuggestions = canManage ? records(assistantContext.purchase_suggestions) : [];
  const lowStock = inventory.filter((item) => numberValue(item, "stock") <= numberValue(item, "minimum_stock"));
  const lines = ["OpenAI ist gerade nicht nutzbar. Ich nutze deshalb die lokalen BauPro-Daten als schnellen Fallback."];
  const warnings = ["Lokaler Fallback: Vorschlag bitte besonders pruefen."];

  if (lowerInput.includes("knapp") || lowerInput.includes("bestell") || lowerInput.includes("material")) {
    lines.push(
      "",
      "Knappe oder offene Materialpunkte:",
      shortList(
        materialAlerts.length > 0 ? materialAlerts : lowStock,
        (row) => {
          const name = textValue(row, "message", textValue(row, "name", "Material"));
          const missing = numberValue(row, "missing_quantity");
          const unit = textValue(row, "unit");
          const stock = numberValue(row, "stock");
          const min = numberValue(row, "minimum_stock");
          if (missing > 0) return `${name}${unit ? ` (${missing} ${unit} fehlen)` : ""}`;
          return `${name} - Bestand ${stock}, Mindestbestand ${min}`;
        },
        "Aktuell sind keine knappen Materialien im geladenen Kontext sichtbar."
      )
    );

    if (canManage && purchaseSuggestions.length > 0) {
      lines.push(
        "",
        "Einkaufsvorschlaege:",
        shortList(
          purchaseSuggestions,
          (row) => `${textValue(row, "reason", "Nachbestellen")} - ${numberValue(row, "quantity_needed")} ${textValue(row, "unit")}`,
          "Keine offenen Einkaufsvorschlaege."
        )
      );
    }
  } else if (lowerInput.includes("morgen") || lowerInput.includes("mitnehmen") || lowerInput.includes("mitbring")) {
    lines.push(
      "",
      "Naechste Mitbringlisten und Baustellen:",
      shortList(
        bringLists,
        (row) => `${textValue(row, "title", "Mitbringliste")} am ${textValue(row, "date", "Datum offen")} - Status ${textValue(row, "status", "offen")}`,
        "Keine kommenden Mitbringlisten im geladenen Kontext."
      ),
      "",
      "Baustellen im Fokus:",
      shortList(
        jobsites,
        (row) => `${textValue(row, "name", "Baustelle")} - ${textValue(row, "address", "Adresse offen")}`,
        "Keine aktiven/geplanten Baustellen im geladenen Kontext."
      )
    );
  } else if (lowerInput.includes("zeit") || lowerInput.includes("stunden")) {
    const totalMinutes = timeEntries.reduce((sum, entry) => sum + numberValue(entry, "net_minutes"), 0);
    lines.push(
      "",
      `Geladene Zeiteintraege: ${timeEntries.length}. Netto gesamt im Kontext: ${(totalMinutes / 60).toFixed(1).replace(".", ",")} Stunden.`,
      shortList(
        timeEntries,
        (row) => `${textValue(row, "date", "Datum offen")} - ${textValue(row, "activity", "Taetigkeit offen")} (${numberValue(row, "net_minutes")} Min.)`,
        "Keine passenden Zeiteintraege im geladenen Kontext."
      )
    );
  } else {
    lines.push(
      "",
      `Geladene Daten: ${jobsites.length} Baustellen, ${bringLists.length} Mitbringlisten, ${timeEntries.length} Zeiteintraege, ${inventory.length} Materialpositionen.`,
      "Frag z. B. nach knappem Material, Mitbringlisten fuer morgen oder fehlenden Zeiten."
    );
  }

  return {
    answer: lines.join("\n"),
    warnings,
    suggested_action: "none",
    action_draft: "",
    needs_confirmation: false,
    follow_up_questions: canManage
      ? ["Soll ich daraus als naechstes eine Einkaufsliste oder Mitbringliste vorbereiten?"]
      : ["Soll ich daraus eine Materialmeldung oder einen Tagesbericht vorbereiten?"]
  };
}

function localMaterialMatchFallback(input: string, catalog: Record<string, unknown>[]): MaterialMatchDraft {
  const normalizedInput = input.trim();
  const candidates = catalog.slice(0, 3).map((item) => ({
    catalog_id: textValue(item, "id") || null,
    name: textValue(item, "name", normalizedInput),
    unit: textValue(item, "unit", "Stk"),
    reason: "Lokaler Katalogtreffer ohne OpenAI-Bewertung."
  }));
  const first = candidates[0];

  return {
    original_name: normalizedInput,
    normalized_name: first?.name ?? normalizedInput,
    unit: first?.unit ?? "Stk",
    confidence: first ? 0.65 : 0.35,
    explanation: first
      ? "OpenAI ist gerade nicht nutzbar. BauPro nutzt den besten lokalen Katalogtreffer als Vorschlag."
      : "OpenAI ist gerade nicht nutzbar und der lokale Katalog hat keinen sicheren Treffer gefunden.",
    candidates
  };
}

function contextArray(values: unknown) {
  return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && Boolean(value.trim())) : [];
}

function localDailyReportFallback(input: string, context?: DailyReportAutomationPayload["context"]): DailyReportDraft {
  const text = input.trim();
  const employees = contextArray(context?.employees).join(", ");
  const timeEntries = contextArray(context?.time_entries).join("; ");
  const vehicles = contextArray(context?.vehicle_names).join(", ");
  const weather = context?.weather?.summary ?? null;
  const material = context?.material_usage?.trim() ?? "";
  const machineUsage = [context?.machine_usage, vehicles].filter(Boolean).join("\n");
  const missing = [
    !context?.jobsite_label ? "Baustelle" : null,
    !employees ? "Anwesende Mitarbeiter" : null,
    !timeEntries ? "Arbeitszeiten" : null,
    !weather ? "Wetter" : null,
    !material ? "Materialverbrauch" : null
  ].filter((value): value is string => Boolean(value));

  return {
    general_information: [context?.jobsite_label, context?.report_date].filter(Boolean).join(" | ") || "Allgemeine Angaben bitte pruefen.",
    weather_section: weather ?? "Wetter nicht angegeben.",
    employees_section: employees || "Mitarbeiter nicht angegeben.",
    activities: text,
    material_usage: material,
    machine_usage: machineUsage,
    special_notes: "",
    defects_obstructions: "",
    next_steps: "",
    issues: "",
    weather,
    summary: "Lokaler Entwurf aus deinem Text. Bitte Taetigkeiten, Material und Besonderheiten vor dem Speichern pruefen.",
    missing_information: missing,
    follow_up_questions: missing.length
      ? missing.map((field) => `Bitte ${field} ergaenzen oder bestaetigen.`)
      : ["Bitte Entwurf fachlich pruefen und bei Bedarf ergaenzen."],
    token_note: "Lokaler Fallback ohne OpenAI-Tokenverbrauch."
  };
}

function localBusinessInputFallback(input: string): ClassifiedBusinessInput {
  const lowerInput = input.toLowerCase();
  const intent: ClassifiedBusinessInput["intent"] = lowerInput.includes("stunden") || lowerInput.includes("arbeitszeit")
    ? "time_entry"
    : lowerInput.includes("bericht")
      ? "report_entry"
      : lowerInput.includes("mitbringen") || lowerInput.includes("morgen")
        ? "bring_list"
        : lowerInput.includes("fehlt") || lowerInput.includes("material")
          ? "material_request"
          : lowerInput.includes("aufgabe")
            ? "new_task"
            : "unknown";

  return {
    intent,
    confidence: intent === "unknown" ? 0.35 : 0.6,
    customer_name: null,
    job_name: null,
    date: lowerInput.includes("morgen") ? new Date(Date.now() + 86_400_000).toISOString().slice(0, 10) : null,
    time_start: null,
    time_end: null,
    break_minutes: null,
    materials: [],
    tools: [],
    notes: input.trim(),
    follow_up_questions: ["Bitte pruefen und fehlende Baustelle, Datum, Zeiten oder Materialmengen ergaenzen."]
  };
}

async function getAiGate(feature: AiFeature) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const settings = await loadAiSettings(supabase, context.companyId);
  const runtime = aiRuntimeState(context, settings);
  let allowed = canUseAiFeature(context, settings, feature);

  try {
    await checkAiLimit(supabase, context.companyId);
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
  const jobsitesQuery = (
    context.canManage
      ? supabase.from("jobsites").select("id, name, customer, address, status").eq("company_id", context.companyId)
      : supabase
          .from("jobsites")
          .select("id, name, customer, address, status")
          .eq("company_id", context.companyId)
          .contains("assigned_employee_ids", [context.userId])
  )
    .in("status", ["geplant", "aktiv"])
    .order("name", { ascending: true })
    .limit(40);

  const [jobsites, customers, inventoryItems] = await Promise.all([
    safeList<{ id: string; name: string; customer: string; address: string; status: string }>(jobsitesQuery),
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
  const jobsitesQuery = (
    context.canManage
      ? supabase.from("jobsites").select("id, name, customer, address, start_date, status").eq("company_id", context.companyId)
      : supabase
          .from("jobsites")
          .select("id, name, customer, address, start_date, status")
          .eq("company_id", context.companyId)
          .contains("assigned_employee_ids", [context.userId])
  )
    .in("status", ["geplant", "aktiv"])
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(30);
  const ordersQuery = (
    context.canManage
      ? supabase
          .from("orders")
          .select("id, order_number, title, order_type, status, priority, start_date, jobsite_address, assigned_employee_ids")
          .eq("company_id", context.companyId)
      : supabase
          .from("orders")
          .select("id, order_number, title, order_type, status, priority, start_date, jobsite_address, assigned_employee_ids")
          .eq("company_id", context.companyId)
          .contains("assigned_employee_ids", [context.userId])
  )
    .order("created_at", { ascending: false })
    .limit(30);
  const bringListsQuery = (
    context.canManage
      ? supabase.from("bring_lists").select("id, job_id, date, title, status, assigned_to, created_by").eq("company_id", context.companyId)
      : supabase
          .from("bring_lists")
          .select("id, job_id, date, title, status, assigned_to, created_by")
          .eq("company_id", context.companyId)
          .or(`assigned_to.eq.${context.userId},created_by.eq.${context.userId}`)
  )
    .gte("date", today)
    .order("date", { ascending: true })
    .limit(40);

  const [jobsites, orders, timeEntries, bringLists, inventory, materialAlerts, purchaseSuggestions] = await Promise.all([
    safeList<Record<string, unknown>>(jobsitesQuery),
    safeList<Record<string, unknown>>(ordersQuery),
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
    safeList<Record<string, unknown>>(bringListsQuery),
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
    const parsed = localBusinessInputFallback(input);
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
      configured: runtime.configured,
      message: `${result.message} Lokaler Vorschlag erstellt.`,
      actionId,
      result: parsed
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

function compactDailyReportPayload(payload: DailyReportAutomationPayload, businessContext: unknown) {
  return compactJson({
    app_context: businessContext,
    report_context: payload.context ?? {},
    photo_context: {
      existing_photo_names: payload.context?.existing_photo_names ?? [],
      selected_photo_names: payload.context?.selected_photo_names ?? [],
      image_count_sent_to_ai: payload.imageUrls?.length ?? 0,
      note: payload.context?.photo_context_note ?? null
    }
  });
}

export async function generateDailyReportDraftFromPayload(payload: DailyReportAutomationPayload): Promise<ActionResult<DailyReportDraft>> {
  const input = payload.input.trim();
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
  const contextJson = compactDailyReportPayload(payload, businessContext);
  const result = await createStructuredAiResponse<DailyReportDraft>({
    feature: "daily_report",
    system: roleAwareSystemPrompt(context.profile.role, context.canManage),
    user: `${dailyReportPrompt(contextJson)}\n\nStichpunkte oder Diktat:\n${input}`,
    schema: DAILY_REPORT_SCHEMA,
    schemaName: "baupro_daily_report",
    imageUrls: payload.imageUrls ?? [],
    maxOutputTokens: 1800
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
    return {
      ok: true,
      configured: runtime.configured,
      message: `${result.message} Lokaler Tagesbericht-Entwurf erstellt.`,
      result: localDailyReportFallback(input, payload.context)
    };
  }

  return {
    ok: true,
    configured: true,
    message: "Bautagesbericht-Entwurf erstellt.",
    result: {
      ...result.data,
      token_note: `OpenAI genutzt: ${result.inputTokens ?? 0} Eingabe-Token, ${result.outputTokens ?? 0} Ausgabe-Token.`
    }
  };
}

export async function generateDailyReportDraftAction(rawInput: string): Promise<ActionResult<DailyReportDraft>> {
  return generateDailyReportDraftFromPayload({ input: rawInput });
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
    return {
      ok: true,
      configured: runtime.configured,
      message: `${result.message} Lokaler Fallback erstellt.`,
      result: localAssistantFallback(input, assistantContext, context.canManage)
    };
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
      .or(searchOrFilter(["name"], input.split(/\s+/)[0] ?? input))
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
    return {
      ok: true,
      configured: runtime.configured,
      message: `${result.message} Lokaler Katalogvorschlag erstellt.`,
      result: localMaterialMatchFallback(input, catalog)
    };
  }

  return { ok: true, configured: true, message: "Materialvorschlag erstellt.", result: result.data };
}

export async function getProposedAiActionForUser(actionId: string) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_actions")
    .select(aiActionSelect)
    .eq("id", actionId)
    .eq("company_id", context.companyId)
    .eq("user_id", context.userId)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as AiActionRow;
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
