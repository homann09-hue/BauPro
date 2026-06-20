"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { defectPriorities, defectStatuses } from "@/lib/defects";
import { requireAppContext, requireManager, type AppContext } from "@/lib/auth";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { defectDetailSelect } from "@/lib/data/selects";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { enumFormValue, optionalFormString, optionalFormUuid, requiredFormString, requiredFormUuid } from "@/lib/security/form-data";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertProfilesInCompany } from "@/lib/security/tenant-guards";
import { sanitizeUploadFileName, validateReportPhoto } from "@/lib/security/uploads";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { Defect, DefectPriority, DefectSourceType, DefectStatus, Jobsite } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function bounded(value: string | null, label: string, maxLength: number) {
  const text = value?.trim() ?? "";
  if (!text) return null;
  if (text.length > maxLength) throw new SafeActionError(`${label} ist zu lang.`);
  return text;
}

function boolFromForm(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function safeReturnTo(formData: FormData, fallback: string) {
  const returnTo = optionalFormString(formData, "return_to");
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) return fallback;
  return returnTo;
}

function redirectBack(path: string, message: { success?: string; error?: string }): never {
  const key = message.error ? "error" : "success";
  redirect(`${path}?${key}=${toQuery(message.error ?? message.success ?? "")}`);
}

function sourceType(formData: FormData): DefectSourceType {
  const value = optionalFormString(formData, "source_type");
  if (value === "photo" || value === "report" || value === "checklist" || value === "customer_message") return value;
  return "manual";
}

async function loadAccessibleJobsite(supabase: SupabaseServerClient, context: AppContext, jobsiteId: string) {
  const { data, error } = await supabase
    .from("jobsites")
    .select("id, company_id, name, customer, address, assigned_employee_ids")
    .eq("company_id", context.companyId)
    .eq("id", jobsiteId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Baustelle wurde nicht gefunden.");
  const jobsite = data as Pick<Jobsite, "id" | "company_id" | "name" | "customer" | "address" | "assigned_employee_ids">;
  if (!context.canManage && !jobsite.assigned_employee_ids.includes(context.userId)) {
    throw new SafeActionError("Keine Berechtigung fuer diese Baustelle.");
  }
  return jobsite;
}

async function loadDefectForAction(supabase: SupabaseServerClient, context: AppContext, defectId: string) {
  const { data, error } = await supabase
    .from("defects")
    .select(defectDetailSelect)
    .eq("company_id", context.companyId)
    .eq("id", defectId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Mangel wurde nicht gefunden.");
  const defect = data as unknown as Defect;
  const assigned = defect.jobsites?.assigned_employee_ids ?? [];
  const allowed = context.canManage || defect.assigned_to === context.userId || assigned.includes(context.userId);
  if (!allowed) throw new SafeActionError("Keine Berechtigung fuer diesen Mangel.");
  return defect;
}

async function writeAudit({
  companyId,
  actorId,
  entityId,
  action,
  oldValues,
  newValues
}: {
  companyId: string;
  actorId: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  try {
    await createSupabaseAdminClient().from("company_audit_log").insert({
      company_id: companyId,
      actor_id: actorId,
      entity_type: "defect",
      entity_id: entityId,
      action,
      old_values: oldValues ?? null,
      new_values: newValues ?? null
    });
  } catch (error) {
    console.warn("defect-audit-write-failed", error);
  }
}

async function uploadDefectPhoto({
  supabase,
  context,
  defectId,
  jobsiteId,
  file,
  visibleToCustomer
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  defectId: string;
  jobsiteId: string;
  file: File;
  visibleToCustomer: boolean;
}) {
  await validateReportPhoto(file);
  const safeName = sanitizeUploadFileName(file.name || "mangelfoto.jpg");
  const storagePath = `${context.companyId}/defects/${defectId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("defect-photos").upload(storagePath, file, {
    contentType: file.type,
    upsert: false
  });
  if (uploadError) throw new SafeActionError("Foto konnte nicht hochgeladen werden.");

  const { error } = await supabase.from("defect_photos").insert({
    company_id: context.companyId,
    defect_id: defectId,
    jobsite_id: jobsiteId,
    storage_path: storagePath,
    file_name: safeName,
    content_type: file.type,
    size_bytes: file.size,
    visible_to_customer: visibleToCustomer,
    uploaded_by: context.userId
  });
  if (error) {
    await supabase.storage.from("defect-photos").remove([storagePath]);
    throw new SafeActionError("Foto-Nachweis konnte nicht gespeichert werden.");
  }
}

export async function createDefectAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnTo(formData, "/maengel/neu");
  let defectId = "";
  let jobsiteIdForRevalidate = "";

  try {
    assertRateLimit(`defect-create:${context.companyId}:${context.userId}`, 30, 60_000);
    const jobsiteId = requiredFormUuid(formData, "jobsite_id", "Baustelle");
    jobsiteIdForRevalidate = jobsiteId;
    const jobsite = await loadAccessibleJobsite(supabase, context, jobsiteId);
    const assignedTo = context.canManage ? optionalFormUuid(formData, "assigned_to", "Verantwortlicher") : context.userId;
    if (assignedTo) {
      await assertProfilesInCompany({
        supabase,
        companyId: context.companyId,
        profileIds: [assignedTo],
        allowedRoles: ["vorarbeiter", "mitarbeiter"]
      });
    }

    defectId = crypto.randomUUID();
    const title = requiredFormString(formData, "title", "Titel");
    const description = bounded(optionalFormString(formData, "description"), "Beschreibung", 4000);
    const priority = enumFormValue(formData, "priority", defectPriorities, "mittel") as DefectPriority;
    const visibleToCustomer = context.canManage && boolFromForm(formData, "visible_to_customer");
    const now = new Date().toISOString();

    const { error } = await supabase.from("defects").insert({
      id: defectId,
      company_id: context.companyId,
      jobsite_id: jobsite.id,
      title,
      description,
      priority,
      status: "offen",
      assigned_to: assignedTo,
      due_date: optionalFormString(formData, "due_date"),
      visible_to_customer: visibleToCustomer,
      customer_released_at: visibleToCustomer ? now : null,
      customer_released_by: visibleToCustomer ? context.userId : null,
      source_type: sourceType(formData),
      source_report_id: optionalFormUuid(formData, "source_report_id", "Bericht"),
      source_report_photo_id: optionalFormUuid(formData, "source_report_photo_id", "Berichtsfoto"),
      source_checklist_id: optionalFormUuid(formData, "source_checklist_id", "Checkliste"),
      source_checklist_item_id: optionalFormUuid(formData, "source_checklist_item_id", "Checklistenpunkt"),
      source_customer_message_id: optionalFormUuid(formData, "source_customer_message_id", "Kundennachricht"),
      created_by: context.userId
    });
    if (error) throw new SafeActionError("Mangel konnte nicht gespeichert werden.");

    const file = formData.get("photo");
    if (file instanceof File && file.size > 0) {
      await uploadDefectPhoto({
        supabase,
        context,
        defectId,
        jobsiteId: jobsite.id,
        file,
        visibleToCustomer
      });
    }

    await supabase.from("jobsite_activity_events").insert({
      company_id: context.companyId,
      jobsite_id: jobsite.id,
      event_type: "task",
      title: `Mangel erfasst: ${title}`,
      body: bounded(description, "Beschreibung", 800),
      visibility: visibleToCustomer ? "customer" : "internal",
      actor_id: context.userId,
      source_table: "defects",
      source_id: defectId
    });

    await writeAudit({
      companyId: context.companyId,
      actorId: context.userId,
      entityId: defectId,
      action: "create",
      newValues: { jobsite_id: jobsite.id, priority, visible_to_customer: visibleToCustomer }
    });
  } catch (error) {
    redirectBack(returnTo, { error: safeErrorMessage(error, "Mangel konnte nicht angelegt werden.") });
  }

  revalidatePath("/maengel");
  if (jobsiteIdForRevalidate) revalidatePath(`/baustellen/${jobsiteIdForRevalidate}`);
  revalidateDashboardCache(context.companyId);
  redirect(`/maengel/${defectId}?success=${toQuery("Mangel wurde angelegt.")}`);
}

export async function updateDefectAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const defectId = requiredFormUuid(formData, "defect_id", "Mangel");
  const returnTo = safeReturnTo(formData, `/maengel/${defectId}`);

  try {
    const defect = await loadDefectForAction(supabase, context, defectId);
    const status = enumFormValue(formData, "status", defectStatuses, defect.status) as DefectStatus;
    const updates: Record<string, unknown> = {
      status,
      description: bounded(optionalFormString(formData, "description"), "Beschreibung", 4000)
    };

    if (context.canManage) {
      const assignedTo = optionalFormUuid(formData, "assigned_to", "Verantwortlicher");
      if (assignedTo) {
        await assertProfilesInCompany({
          supabase,
          companyId: context.companyId,
          profileIds: [assignedTo],
          allowedRoles: ["vorarbeiter", "mitarbeiter"]
        });
      }
      const visibleToCustomer = boolFromForm(formData, "visible_to_customer");
      updates.title = requiredFormString(formData, "title", "Titel");
      updates.priority = enumFormValue(formData, "priority", defectPriorities, defect.priority) as DefectPriority;
      updates.assigned_to = assignedTo;
      updates.due_date = optionalFormString(formData, "due_date");
      updates.visible_to_customer = visibleToCustomer;
      updates.customer_released_at = visibleToCustomer && !defect.visible_to_customer ? new Date().toISOString() : defect.customer_released_at;
      updates.customer_released_by = visibleToCustomer && !defect.visible_to_customer ? context.userId : defect.customer_released_by;
    }

    const { error } = await supabase
      .from("defects")
      .update(updates)
      .eq("company_id", context.companyId)
      .eq("id", defect.id)
      .is("archived_at", null);
    if (error) throw new SafeActionError("Mangel konnte nicht aktualisiert werden.");

    await writeAudit({
      companyId: context.companyId,
      actorId: context.userId,
      entityId: defect.id,
      action: "update",
      oldValues: { status: defect.status, priority: defect.priority, assigned_to: defect.assigned_to },
      newValues: updates
    });
  } catch (error) {
    redirectBack(returnTo, { error: safeErrorMessage(error, "Mangel konnte nicht aktualisiert werden.") });
  }

  revalidatePath(returnTo);
  revalidatePath("/maengel");
  revalidateDashboardCache(context.companyId);
  redirectBack(returnTo, { success: "Mangel wurde aktualisiert." });
}

export async function uploadDefectPhotoAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const defectId = requiredFormUuid(formData, "defect_id", "Mangel");
  const returnTo = safeReturnTo(formData, `/maengel/${defectId}`);

  try {
    assertRateLimit(`defect-photo:${context.companyId}:${context.userId}`, 30, 60_000);
    const defect = await loadDefectForAction(supabase, context, defectId);
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new SafeActionError("Bitte ein Foto auswaehlen.");
    await uploadDefectPhoto({
      supabase,
      context,
      defectId: defect.id,
      jobsiteId: defect.jobsite_id,
      file,
      visibleToCustomer: context.canManage && boolFromForm(formData, "visible_to_customer")
    });
  } catch (error) {
    redirectBack(returnTo, { error: safeErrorMessage(error, "Foto konnte nicht gespeichert werden.") });
  }

  revalidatePath(returnTo);
  redirectBack(returnTo, { success: "Foto wurde gespeichert." });
}

export async function archiveDefectAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const defectId = requiredFormUuid(formData, "defect_id", "Mangel");
  const returnTo = safeReturnTo(formData, "/maengel");

  try {
    const { data, error } = await supabase
      .from("defects")
      .update({ archived_at: new Date().toISOString() })
      .eq("company_id", context.companyId)
      .eq("id", defectId)
      .is("archived_at", null)
      .select("id, jobsite_id")
      .maybeSingle();
    if (error || !data) throw new SafeActionError("Mangel konnte nicht archiviert werden.");

    await writeAudit({
      companyId: context.companyId,
      actorId: context.userId,
      entityId: defectId,
      action: "archive",
      newValues: { archived_at: new Date().toISOString() }
    });
  } catch (error) {
    redirectBack(returnTo, { error: safeErrorMessage(error, "Mangel konnte nicht archiviert werden.") });
  }

  revalidatePath("/maengel");
  revalidateDashboardCache(context.companyId);
  redirectBack(returnTo, { success: "Mangel wurde archiviert." });
}

export async function markDefectNotificationReadAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const notificationId = requiredFormUuid(formData, "notification_id", "Benachrichtigung");
  const returnTo = safeReturnTo(formData, "/maengel");

  await supabase
    .from("defect_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("company_id", context.companyId)
    .eq("id", notificationId)
    .is("archived_at", null);

  revalidatePath(returnTo);
  redirectBack(returnTo, { success: "Benachrichtigung erledigt." });
}
