"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkBringListAvailability } from "@/lib/inventory/check-availability";
import { getProposedAiActionForUser, markAiActionStatus } from "@/lib/actions/ai-actions";
import { createOrUpdateMaterialAlert } from "@/lib/inventory/alerts";
import { generatePurchaseSuggestions } from "@/lib/inventory/purchase-suggestions";
import { requireAppContext } from "@/lib/auth";
import { searchOrFilter } from "@/lib/data/shared";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { safeReturnPath } from "@/lib/security/redirects";
import { calculateTimeMinutes } from "@/lib/time-tracking";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseVoiceInput } from "@/lib/voice/voice-router";
import type { ClassifiedBusinessInput } from "@/lib/ai/types";
import type { ParsedMaterialEntity } from "@/lib/voice/entity-parser";

const VOICE_RAW_TEXT_MAX_LENGTH = 5_000;
const VOICE_SEARCH_TEXT_MAX_LENGTH = 100;

function returnTo(formData: FormData) {
  return safeReturnPath(formData.get("return_to"), "/dashboard");
}

function boundedVoiceText(value: string) {
  const text = value.trim();
  if (text.length > VOICE_RAW_TEXT_MAX_LENGTH) {
    throw new SafeActionError(`Diktat ist zu lang. Bitte auf maximal ${VOICE_RAW_TEXT_MAX_LENGTH} Zeichen kürzen.`);
  }

  return text;
}

function voiceSearchTerm(value: string | null) {
  const cleaned = String(value ?? "")
    .replace(/[%_\\,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, VOICE_SEARCH_TEXT_MAX_LENGTH);

  return cleaned || null;
}

function aiIntentToVoiceIntent(intent: ClassifiedBusinessInput["intent"]) {
  if (intent === "time_entry") return "time_tracking";
  if (intent === "bring_list") return "bring_list";
  if (intent === "material_request") return "material_alert";
  if (intent === "job_note" || intent === "customer_note" || intent === "new_task" || intent === "report_entry") return "job_note";
  return "unknown";
}

function parsedFromAi(classified: ClassifiedBusinessInput): ReturnType<typeof parseVoiceInput> {
  return {
    intent: aiIntentToVoiceIntent(classified.intent),
    date: classified.date,
    targetName: classified.job_name ?? classified.customer_name,
    startTime: classified.time_start,
    endTime: classified.time_end,
    breakMinutes: classified.break_minutes,
    materials: [...classified.materials, ...classified.tools].map((item) => ({
      name: item.name,
      quantity: item.quantity || 1,
      unit: item.unit || "Stueck"
    })),
    note: classified.notes
  };
}

async function parseConfirmedInput(formData: FormData, rawText: string) {
  const aiActionId = String(formData.get("ai_action_id") ?? "").trim() || null;
  if (!aiActionId) return { parsed: parseVoiceInput(rawText), aiActionId: null };

  const action = await getProposedAiActionForUser(aiActionId);
  if (!action || action.status !== "proposed") return { parsed: parseVoiceInput(rawText), aiActionId: null };

  if (Number(action.confidence) < 0.7) {
    const questions = action.parsed_json.follow_up_questions.join(" ");
    throw new SafeActionError(`KI ist noch unsicher. Bitte zuerst pruefen: ${questions || "Angaben fehlen."}`);
  }

  return { parsed: parsedFromAi(action.parsed_json), aiActionId };
}

async function findJobsite(companyId: string, targetName: string | null) {
  const supabase = await createSupabaseServerClient();
  if (!targetName) return null;
  const searchTerm = voiceSearchTerm(targetName);
  if (!searchTerm) return null;

  const { data } = await supabase
    .from("jobsites")
    .select("id, name, address, customer")
    .eq("company_id", companyId)
    .or(searchOrFilter(["name", "customer", "address"], searchTerm))
    .limit(1)
    .maybeSingle();

  return data as { id: string; name: string; address: string; customer: string } | null;
}

async function findInventoryItem(companyId: string, material: ParsedMaterialEntity) {
  const supabase = await createSupabaseServerClient();
  const searchTerm = voiceSearchTerm(material.name);
  if (!searchTerm) return null;

  const { data } = await supabase
    .from("inventory_items")
    .select("id, name, unit, inventory_locations(id, name, location_type)")
    .eq("company_id", companyId)
    .or(searchOrFilter(["name"], searchTerm))
    .order("stock", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as { id: string; name: string; unit: string; inventory_locations?: { name?: string | null } | null } | null;
}

async function createVoiceNote({
  companyId,
  userId,
  rawText,
  status,
  entities,
  linkedJobId,
  linkedTimeEntryId,
  linkedBringListId,
  linkedMaterialAlertId
}: {
  companyId: string;
  userId: string;
  rawText: string;
  status: "confirmed" | "discarded" | "draft";
  entities: ReturnType<typeof parseVoiceInput>;
  linkedJobId?: string | null;
  linkedTimeEntryId?: string | null;
  linkedBringListId?: string | null;
  linkedMaterialAlertId?: string | null;
}) {
  const supabase = await createSupabaseServerClient();
  await supabase.from("voice_notes").insert({
    company_id: companyId,
    user_id: userId,
    raw_text: rawText,
    detected_intent: entities.intent,
    detected_entities: entities,
    linked_job_id: linkedJobId ?? null,
    linked_time_entry_id: linkedTimeEntryId ?? null,
    linked_bring_list_id: linkedBringListId ?? null,
    linked_material_alert_id: linkedMaterialAlertId ?? null,
    status
  });
}

export async function confirmVoiceNoteAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const target = returnTo(formData);
  let rawText: string;

  try {
    rawText = boundedVoiceText(String(formData.get("raw_text") ?? ""));
  } catch (error) {
    redirect(`${target}?error=${toQuery(safeErrorMessage(error, "Diktat konnte nicht gelesen werden."))}`);
  }

  if (!rawText) {
    redirect(`${target}?error=${toQuery("Kein Diktat vorhanden.")}`);
  }
  let redirectTo = target;

  try {
    const { parsed, aiActionId } = await parseConfirmedInput(formData, rawText);
    const jobsite = await findJobsite(context.companyId, parsed.targetName);

    if (parsed.intent === "bring_list") {
      if (!jobsite) throw new SafeActionError("Bitte Baustelle im Diktat nennen oder Text bearbeiten.");

      const { data: list, error } = await supabase
        .from("bring_lists")
        .insert({
          company_id: context.companyId,
          job_id: jobsite.id,
          date: parsed.date ?? new Date().toISOString().slice(0, 10),
          title: `Diktat: ${jobsite.name}`,
          notes: rawText,
          status: context.canManage ? "ready" : "draft",
          created_by: context.userId,
          assigned_to: context.canManage ? null : context.userId
        })
        .select("id")
        .single();

      if (error || !list) throw new Error("voice_bring_list_insert_failed");

      const rows = [];
      for (const material of parsed.materials) {
        const inventory = await findInventoryItem(context.companyId, material);
        rows.push({
          bring_list_id: list.id,
          inventory_item_id: inventory?.id ?? null,
          custom_item_name: inventory?.name ?? material.name,
          item_type: "material",
          quantity: material.quantity,
          unit: inventory?.unit ?? material.unit,
          storage_location: inventory?.inventory_locations?.name ?? null
        });
      }

      if (rows.length > 0) {
        const { error: itemError } = await supabase.from("bring_list_items").insert(rows);
        if (itemError) throw new Error("voice_bring_list_items_insert_failed");
      }

      await checkBringListAvailability({ supabase, companyId: context.companyId, bringListId: list.id as string });
      await createVoiceNote({
        companyId: context.companyId,
        userId: context.userId,
        rawText,
        status: "confirmed",
        entities: parsed,
        linkedJobId: jobsite.id,
        linkedBringListId: list.id as string
      });
      await markAiActionStatus({ actionId: aiActionId, status: "executed", linkedJobId: jobsite.id, linkedBringListId: list.id as string });
      revalidatePath("/bring-lists");
      revalidatePath("/dashboard");
      redirectTo = `/bring-lists/${list.id}?success=${toQuery("Diktat wurde als Mitbringliste gespeichert.")}`;
    } else if (parsed.intent === "time_tracking") {
      if (!jobsite) throw new SafeActionError("Bitte Baustelle im Diktat nennen oder Text bearbeiten.");
      if (!parsed.startTime || !parsed.endTime) throw new SafeActionError("Bitte Beginn und Ende nennen, z. B. von 7 bis 16 Uhr.");

      const breakMinutes = parsed.breakMinutes ?? 0;
      const calculated = calculateTimeMinutes({ startTime: parsed.startTime, endTime: parsed.endTime, breakMinutes });
      const { data: entry, error } = await supabase
        .from("time_entries")
        .insert({
          company_id: context.companyId,
          employee_id: context.userId,
          job_id: jobsite.id,
          date: parsed.date ?? new Date().toISOString().slice(0, 10),
          work_location: jobsite.name,
          work_address: jobsite.address,
          start_time: parsed.startTime,
          end_time: parsed.endTime,
          break_minutes: breakMinutes,
          gross_minutes: calculated.grossMinutes,
          net_minutes: calculated.netMinutes,
          activity: parsed.note ?? rawText,
          status: "submitted",
          created_by: context.userId
        })
        .select("id")
        .single();

      if (error || !entry) throw new Error("voice_time_entry_insert_failed");
      await createVoiceNote({
        companyId: context.companyId,
        userId: context.userId,
        rawText,
        status: "confirmed",
        entities: parsed,
        linkedJobId: jobsite.id,
        linkedTimeEntryId: entry.id as string
      });
      await markAiActionStatus({ actionId: aiActionId, status: "executed", linkedJobId: jobsite.id, linkedTimeEntryId: entry.id as string });
      revalidatePath("/time-tracking");
      redirectTo = `/time-tracking?success=${toQuery("Diktat wurde als Arbeitszeit gespeichert.")}`;
    } else if (parsed.intent === "material_alert") {
      const firstMaterial = parsed.materials[0];
      if (!firstMaterial) throw new SafeActionError("Bitte Material und Menge nennen.");
      const inventory = await findInventoryItem(context.companyId, firstMaterial);
      const alertId = await createOrUpdateMaterialAlert({
        supabase,
        companyId: context.companyId,
        inventoryItemId: inventory?.id ?? null,
        jobId: jobsite?.id ?? null,
        alertType: "missing_for_job",
        severity: "critical",
        message: `Per Diktat gemeldet: ${firstMaterial.quantity} ${firstMaterial.unit} ${firstMaterial.name} fehlen.`,
        requiredQuantity: firstMaterial.quantity,
        availableQuantity: 0,
        missingQuantity: firstMaterial.quantity,
        unit: inventory?.unit ?? firstMaterial.unit,
        createdBySystem: false
      });

      await generatePurchaseSuggestions({
        supabase,
        companyId: context.companyId,
        inventoryItemId: inventory?.id ?? null,
        jobId: jobsite?.id ?? null,
        quantityNeeded: firstMaterial.quantity,
        unit: inventory?.unit ?? firstMaterial.unit,
        reason: `Diktierte Materialmeldung: ${firstMaterial.name}`
      });

      await createVoiceNote({
        companyId: context.companyId,
        userId: context.userId,
        rawText,
        status: "confirmed",
        entities: parsed,
        linkedJobId: jobsite?.id ?? null,
        linkedMaterialAlertId: alertId
      });
      await markAiActionStatus({ actionId: aiActionId, status: "executed", linkedJobId: jobsite?.id ?? null });
      revalidatePath("/dashboard");
      redirectTo = `${target}?success=${toQuery("Materialmeldung wurde an Chef/Admin weitergegeben.")}`;
    } else {
      await createVoiceNote({
        companyId: context.companyId,
        userId: context.userId,
        rawText,
        status: "draft",
        entities: parsed,
        linkedJobId: jobsite?.id ?? null
      });
      await markAiActionStatus({ actionId: aiActionId, status: "confirmed", linkedJobId: jobsite?.id ?? null });
      redirectTo = `${target}?error=${toQuery("Diktat konnte keinem Bereich sicher zugeordnet werden. Bitte Text bearbeiten.")}`;
    }
  } catch (error) {
    redirect(`${target}?error=${toQuery(safeErrorMessage(error, "Diktat konnte nicht gespeichert werden."))}`);
  }

  redirect(redirectTo);
}

export async function discardVoiceNoteAction(formData: FormData) {
  const context = await requireAppContext();
  const rawText = String(formData.get("raw_text") ?? "").trim();
  const parsed = parseVoiceInput(rawText);

  if (rawText) {
    await createVoiceNote({
      companyId: context.companyId,
      userId: context.userId,
      rawText,
      status: "discarded",
      entities: parsed
    });
  }

  const aiActionId = String(formData.get("ai_action_id") ?? "").trim() || null;
  await markAiActionStatus({ actionId: aiActionId, status: "rejected" });

  redirect(`${returnTo(formData)}?success=${toQuery("Diktat wurde verworfen.")}`);
}
