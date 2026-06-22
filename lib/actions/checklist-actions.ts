"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checklistCategories, checklistItemStatuses } from "@/lib/checklists";
import { requireAppContext, requireManager, type AppContext } from "@/lib/auth";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { enumFormValue, optionalFormString, requiredFormString, requiredFormUuid } from "@/lib/security/form-data";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizeUploadFileName, validateReportPhoto } from "@/lib/security/uploads";
import { signerRole, validateSignatureDataUrl } from "@/lib/signatures/signature";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isForeman, toBoolean } from "@/lib/utils";
import type {
  ChecklistCategory,
  ChecklistItemStatus,
  ChecklistTemplate,
  ChecklistTemplateItem,
  Jobsite,
  JobsiteChecklist,
  JobsiteChecklistItem
} from "@/types/app";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type ChecklistLine = {
  label: string;
  help_text: string | null;
  required: boolean;
  photo_required: boolean;
};

function bounded(value: string | null, label: string, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  if (trimmed.length > maxLength) throw new SafeActionError(`${label} ist zu lang.`);
  return trimmed;
}

function parseChecklistLines(requiredText: string | null, optionalText: string | null) {
  const parse = (text: string | null, required: boolean) =>
    (text ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map<ChecklistLine>((line) => {
        const photoRequired = line.toLowerCase().startsWith("#foto");
        const withoutMarker = photoRequired ? line.replace(/^#foto\s*/i, "").trim() : line;
        const [label, helpText] = withoutMarker.split("|").map((part) => part.trim());
        if (!label) throw new SafeActionError("Ein Checklistenpunkt ist leer.");
        if (label.length > 180) throw new SafeActionError("Ein Checklistenpunkt ist zu lang.");
        return {
          label,
          help_text: bounded(helpText ?? null, "Hilfetext", 240),
          required,
          photo_required: photoRequired
        };
      });

  const lines = [...parse(requiredText, true), ...parse(optionalText, false)];
  if (lines.length === 0) throw new SafeActionError("Bitte mindestens einen Checklistenpunkt anlegen.");
  if (lines.length > 80) throw new SafeActionError("Eine Vorlage darf maximal 80 Punkte enthalten.");
  return lines;
}

function redirectWithError(returnTo: string, error: unknown, fallback: string) {
  redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, fallback))}`);
}

function canAccessJobsite(context: AppContext, jobsite: Pick<Jobsite, "assigned_employee_ids">) {
  return context.canManage || jobsite.assigned_employee_ids.includes(context.userId);
}

function canCreateOrCompleteChecklist(context: AppContext, jobsite: Pick<Jobsite, "assigned_employee_ids">) {
  return context.canManage || (isForeman(context.profile.role) && jobsite.assigned_employee_ids.includes(context.userId));
}

async function loadAccessibleJobsite(supabase: SupabaseClient, context: AppContext, jobsiteId: string) {
  const { data, error } = await supabase
    .from("jobsites")
    .select("id, name, customer, address, assigned_employee_ids, archived_at")
    .eq("id", jobsiteId)
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Baustelle wurde nicht gefunden.");
  const jobsite = data as Pick<Jobsite, "id" | "name" | "customer" | "address" | "assigned_employee_ids">;
  if (!canAccessJobsite(context, jobsite)) throw new SafeActionError("Keine Berechtigung fuer diese Baustelle.");
  return jobsite;
}

async function loadChecklistForAction(supabase: SupabaseClient, context: AppContext, checklistId: string) {
  const { data, error } = await supabase
    .from("jobsite_checklists")
    .select("id, company_id, jobsite_id, title, category, status, archived_at, jobsites(id, name, customer, address, assigned_employee_ids)")
    .eq("id", checklistId)
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Checkliste wurde nicht gefunden.");
  const checklist = data as unknown as Pick<
    JobsiteChecklist,
    "id" | "company_id" | "jobsite_id" | "title" | "category" | "status" | "archived_at" | "jobsites"
  >;
  if (!checklist.jobsites || !canAccessJobsite(context, checklist.jobsites)) {
    throw new SafeActionError("Keine Berechtigung fuer diese Checkliste.");
  }
  return checklist;
}

async function loadChecklistItemForAction(supabase: SupabaseClient, context: AppContext, itemId: string) {
  const { data, error } = await supabase
    .from("jobsite_checklist_items")
    .select("id, company_id, checklist_id, jobsite_id, label, required, photo_required, status, archived_at")
    .eq("id", itemId)
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Checklistenpunkt wurde nicht gefunden.");
  const item = data as Pick<
    JobsiteChecklistItem,
    "id" | "company_id" | "checklist_id" | "jobsite_id" | "label" | "required" | "photo_required" | "status" | "archived_at"
  >;
  const checklist = await loadChecklistForAction(supabase, context, item.checklist_id);
  return { item, checklist };
}

async function updateChecklistStatusFromItems(supabase: SupabaseClient, checklistId: string, companyId: string) {
  const { data } = await supabase
    .from("jobsite_checklist_items")
    .select("status")
    .eq("company_id", companyId)
    .eq("checklist_id", checklistId)
    .is("archived_at", null);

  const items = (data ?? []) as Pick<JobsiteChecklistItem, "status">[];
  if (items.length === 0) return;

  await supabase
    .from("jobsite_checklists")
    .update({ status: "in_progress" })
    .eq("id", checklistId)
    .eq("company_id", companyId)
    .neq("status", "completed")
    .neq("status", "archived");
}

function safeReturnTo(formData: FormData, fallback: string) {
  const returnTo = optionalFormString(formData, "return_to");
  if (!returnTo || !returnTo.startsWith("/") || returnTo.startsWith("//")) return fallback;
  return returnTo;
}

export async function createChecklistTemplateAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnTo(formData, "/checklists/templates/new");

  try {
    await checkRateLimit(`checklist-template:${context.userId}`, 20, 60_000);
    const name = requiredFormString(formData, "name", "Vorlagenname");
    if (name.length > 140) throw new SafeActionError("Vorlagenname ist zu lang.");
    const category = enumFormValue(formData, "category", checklistCategories, "baustart") as ChecklistCategory;
    const description = bounded(optionalFormString(formData, "description"), "Beschreibung", 600);
    const lines = parseChecklistLines(optionalFormString(formData, "required_items"), optionalFormString(formData, "optional_items"));

    const { data: templateData, error: templateError } = await supabase
      .from("checklist_templates")
      .insert({
        company_id: context.companyId,
        name,
        category,
        description,
        active: true,
        created_by: context.userId
      })
      .select("id")
      .single();

    if (templateError || !templateData) throw new SafeActionError("Vorlage konnte nicht angelegt werden.");
    const template = templateData as Pick<ChecklistTemplate, "id">;

    const { error: itemsError } = await supabase.from("checklist_template_items").insert(
      lines.map((line, index) => ({
        template_id: template.id,
        company_id: context.companyId,
        label: line.label,
        help_text: line.help_text,
        required: line.required,
        photo_required: line.photo_required,
        sort_order: (index + 1) * 10
      }))
    );

    if (itemsError) throw new SafeActionError("Vorlagenpunkte konnten nicht gespeichert werden.");
  } catch (error) {
    redirectWithError(returnTo, error, "Checkliste konnte nicht angelegt werden.");
  }

  revalidatePath("/checklists");
  redirect(`/checklists?success=${toQuery("Checklistenvorlage wurde angelegt.")}`);
}

export async function createJobsiteChecklistFromTemplateAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const fallback = safeReturnTo(formData, "/checklists");
  let createdChecklistId: string | null = null;

  try {
    await checkRateLimit(`jobsite-checklist:${context.userId}`, 40, 60_000);
    const jobsiteId = requiredFormUuid(formData, "jobsite_id", "Baustelle");
    const templateId = requiredFormUuid(formData, "template_id", "Vorlage");
    const jobsite = await loadAccessibleJobsite(supabase, context, jobsiteId);
    if (!canCreateOrCompleteChecklist(context, jobsite)) {
      throw new SafeActionError("Nur Chef/Admin oder zugewiesene Vorarbeiter duerfen Checklisten starten.");
    }

    const { data: templateData, error: templateError } = await supabase
      .from("checklist_templates")
      .select("id, company_id, name, category, description, active")
      .or(`company_id.is.null,company_id.eq.${context.companyId}`)
      .eq("id", templateId)
      .eq("active", true)
      .is("archived_at", null)
      .maybeSingle();

    if (templateError || !templateData) throw new SafeActionError("Checklistenvorlage wurde nicht gefunden.");
    const template = templateData as ChecklistTemplate;
    const customTitle = bounded(optionalFormString(formData, "title"), "Titel", 160);
    const dueDate = optionalFormString(formData, "due_date");

    const { data: checklistData, error: checklistError } = await supabase
      .from("jobsite_checklists")
      .insert({
        company_id: context.companyId,
        jobsite_id: jobsite.id,
        template_id: template.id,
        title: customTitle ?? template.name,
        category: template.category,
        due_date: dueDate,
        notes: bounded(optionalFormString(formData, "notes"), "Notizen", 1200),
        created_by: context.userId
      })
      .select("id")
      .single();

    if (checklistError || !checklistData) throw new SafeActionError("Checkliste konnte nicht angelegt werden.");
    const checklist = checklistData as Pick<JobsiteChecklist, "id">;
    createdChecklistId = checklist.id;

    const { data: templateItems, error: itemsLoadError } = await supabase
      .from("checklist_template_items")
      .select("id, label, help_text, required, photo_required, sort_order")
      .eq("template_id", template.id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true });

    if (itemsLoadError) throw new SafeActionError("Vorlagenpunkte konnten nicht geladen werden.");
    const items = (templateItems ?? []) as Pick<
      ChecklistTemplateItem,
      "id" | "label" | "help_text" | "required" | "photo_required" | "sort_order"
    >[];
    if (items.length === 0) throw new SafeActionError("Diese Vorlage hat keine aktiven Punkte.");

    const { error: insertItemsError } = await supabase.from("jobsite_checklist_items").insert(
      items.map((item) => ({
        company_id: context.companyId,
        checklist_id: checklist.id,
        template_item_id: item.id,
        jobsite_id: jobsite.id,
        label: item.label,
        help_text: item.help_text,
        required: item.required,
        photo_required: item.photo_required,
        sort_order: item.sort_order
      }))
    );

    if (insertItemsError) throw new SafeActionError("Checklistenpunkte konnten nicht angelegt werden.");

    await supabase.from("jobsite_activity_events").insert({
      company_id: context.companyId,
      jobsite_id: jobsite.id,
      event_type: "task",
      title: `Checkliste gestartet: ${customTitle ?? template.name}`,
      body: "Aus wiederverwendbarer Vorlage erstellt.",
      visible_to_customer: false,
      created_by: context.userId
    });

    revalidatePath(`/baustellen/${jobsite.id}`);
    revalidatePath("/checklists");
    revalidateDashboardCache(context.companyId);
  } catch (error) {
    redirectWithError(fallback, error, "Checkliste konnte nicht angelegt werden.");
  }

  redirect(`/checklists/${createdChecklistId}?success=${toQuery("Checkliste wurde angelegt.")}`);
}

export async function updateChecklistItemAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const itemId = requiredFormUuid(formData, "item_id", "Checklistenpunkt");
  const returnTo = safeReturnTo(formData, `/checklists/${itemId}`);
  let successMessage = "Punkt gespeichert.";

  try {
    const { item, checklist } = await loadChecklistItemForAction(supabase, context, itemId);
    const status = enumFormValue(formData, "status", checklistItemStatuses, "offen") as ChecklistItemStatus;
    const problemDescription = bounded(optionalFormString(formData, "problem_description"), "Problembeschreibung", 1200);
    if (status === "problem" && !problemDescription) {
      throw new SafeActionError("Bitte kurz beschreiben, was das Problem ist.");
    }

    const { error } = await supabase
      .from("jobsite_checklist_items")
      .update({
        status,
        notes: bounded(optionalFormString(formData, "notes"), "Notizen", 1000),
        problem_description: status === "problem" ? problemDescription : null,
        checked_by: context.userId,
        checked_at: new Date().toISOString()
      })
      .eq("id", item.id)
      .eq("company_id", context.companyId)
      .is("archived_at", null);

    if (error) throw new SafeActionError("Checklistenpunkt konnte nicht gespeichert werden.");

    await updateChecklistStatusFromItems(supabase, checklist.id, context.companyId);
    revalidatePath(`/checklists/${checklist.id}`);
    revalidatePath(`/baustellen/${checklist.jobsite_id}`);
    revalidateDashboardCache(context.companyId);
    successMessage = status === "problem" ? "Problem gespeichert und Aufgabe erzeugt." : "Punkt gespeichert.";
  } catch (error) {
    redirectWithError(returnTo, error, "Checklistenpunkt konnte nicht gespeichert werden.");
  }

  redirect(`${returnTo}?success=${toQuery(successMessage)}`);
}

export async function uploadChecklistItemPhotoAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const itemId = requiredFormUuid(formData, "item_id", "Checklistenpunkt");
  const returnTo = safeReturnTo(formData, `/checklists/${itemId}`);

  try {
    await checkRateLimit(`checklist-photo:${context.userId}`, 30, 60_000);
    const { item, checklist } = await loadChecklistItemForAction(supabase, context, itemId);
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new SafeActionError("Bitte ein Foto auswaehlen.");
    await validateReportPhoto(file);

    const safeName = sanitizeUploadFileName(file.name || "checklistenfoto.jpg");
    const storagePath = `${context.companyId}/checklists/${checklist.id}/items/${item.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("checklist-photos").upload(storagePath, file, {
      contentType: file.type,
      upsert: false
    });
    if (uploadError) throw new SafeActionError("Foto konnte nicht hochgeladen werden.");

    const { error: insertError } = await supabase.from("checklist_item_photos").insert({
      company_id: context.companyId,
      checklist_id: checklist.id,
      checklist_item_id: item.id,
      jobsite_id: checklist.jobsite_id,
      storage_path: storagePath,
      file_name: safeName,
      content_type: file.type,
      size_bytes: file.size,
      uploaded_by: context.userId
    });
    if (insertError) throw new SafeActionError("Foto-Nachweis konnte nicht gespeichert werden.");
  } catch (error) {
    redirectWithError(returnTo, error, "Foto konnte nicht gespeichert werden.");
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?success=${toQuery("Foto-Nachweis wurde gespeichert.")}`);
}

export async function completeJobsiteChecklistAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const checklistId = requiredFormUuid(formData, "checklist_id", "Checkliste");
  const returnTo = safeReturnTo(formData, `/checklists/${checklistId}`);

  try {
    const checklist = await loadChecklistForAction(supabase, context, checklistId);
    if (!checklist.jobsites || !canCreateOrCompleteChecklist(context, checklist.jobsites)) {
      throw new SafeActionError("Nur Chef/Admin oder zugewiesene Vorarbeiter duerfen Checklisten abschliessen.");
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("jobsite_checklist_items")
      .select("id, status, required, photo_required, label")
      .eq("company_id", context.companyId)
      .eq("checklist_id", checklist.id)
      .is("archived_at", null);

    if (itemsError) throw new SafeActionError("Checklistenpunkte konnten nicht geprueft werden.");
    const items = (itemsData ?? []) as Pick<JobsiteChecklistItem, "id" | "status" | "required" | "photo_required" | "label">[];
    const blockingItem = items.find((item) => item.required && item.status === "offen");
    if (blockingItem) throw new SafeActionError(`Pflichtpunkt ist noch offen: ${blockingItem.label}`);

    const photoRequiredIds = items
      .filter((item) => item.photo_required && item.status === "erledigt")
      .map((item) => item.id);
    if (photoRequiredIds.length > 0) {
      const { data: photos } = await supabase
        .from("checklist_item_photos")
        .select("checklist_item_id")
        .eq("company_id", context.companyId)
        .eq("checklist_id", checklist.id)
        .in("checklist_item_id", photoRequiredIds)
        .is("archived_at", null);
      const withPhoto = new Set((photos ?? []).map((photo) => String(photo.checklist_item_id)));
      const missingPhoto = items.find((item) => photoRequiredIds.includes(item.id) && !withPhoto.has(item.id));
      if (missingPhoto) throw new SafeActionError(`Foto-Nachweis fehlt: ${missingPhoto.label}`);
    }

    const signatureName = bounded(optionalFormString(formData, "signature_name"), "Name", 140);
    const signatureDataUrl = validateSignatureDataUrl(optionalFormString(formData, "signature_data_url"), {
      required: Boolean(signatureName) || toBoolean(formData, "signature_required")
    });
    if (signatureDataUrl && !signatureName) throw new SafeActionError("Bitte Name des Unterzeichners eintragen.");

    const now = new Date().toISOString();
    const { error } = await supabase
      .from("jobsite_checklists")
      .update({
        status: "completed",
        completed_at: now,
        completed_by: context.userId,
        signature_name: signatureName,
        signature_data_url: signatureDataUrl,
        signature_role: signatureDataUrl ? signerRole(context.profile.role) : null,
        signature_signed_at: signatureDataUrl ? now : null,
        notes: bounded(optionalFormString(formData, "completion_notes"), "Abschlussnotiz", 1200)
      })
      .eq("id", checklist.id)
      .eq("company_id", context.companyId)
      .is("archived_at", null);

    if (error) throw new SafeActionError("Checkliste konnte nicht abgeschlossen werden.");
  } catch (error) {
    redirectWithError(returnTo, error, "Checkliste konnte nicht abgeschlossen werden.");
  }

  revalidatePath(returnTo);
  redirect(`${returnTo}?success=${toQuery("Checkliste wurde abgeschlossen.")}`);
}

export async function archiveJobsiteChecklistAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const checklistId = requiredFormUuid(formData, "checklist_id", "Checkliste");
  const returnTo = safeReturnTo(formData, "/checklists");

  try {
    const { data, error } = await supabase
      .from("jobsite_checklists")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("id", checklistId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id, jobsite_id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Checkliste konnte nicht archiviert werden.");
    const checklist = data as Pick<JobsiteChecklist, "id" | "jobsite_id">;
    revalidatePath(`/baustellen/${checklist.jobsite_id}`);
    revalidatePath("/checklists");
  } catch (error) {
    redirectWithError(returnTo, error, "Checkliste konnte nicht archiviert werden.");
  }

  redirect(`${returnTo}?success=${toQuery("Checkliste wurde archiviert.")}`);
}
