"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireManager, requirePermission } from "@/lib/auth";
import { addDaysIso, parseIsoDate } from "@/lib/planning";
import { resourceKinds, resourceStatuses } from "@/lib/resources";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { optionalFormString, optionalFormUuid, requiredFormString, requiredFormUuid } from "@/lib/security/form-data";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { safeReturnPath, withStatusMessage } from "@/lib/security/redirects";
import { sanitizeUploadFileName, validateCustomerDocument } from "@/lib/security/uploads";
import { assertProfilesInCompany, assertVehicleInCompany } from "@/lib/security/tenant-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalDate, optionalNumber } from "@/lib/utils";
import type { PlanningAssignment, PlanningAssignmentStatus, PlanningResourceKind, PlanningResourceStatus, PlanningResourceType, ResourceDocumentType } from "@/types/app";

const assignmentStatuses = [
  "geplant",
  "aktiv",
  "erledigt",
  "verschoben",
  "krank",
  "urlaub",
  "werkstatt",
  "defekt",
  "weiterbildung"
] as const;
const resourceTypes = ["employee", "vehicle", "equipment"] as const;
const documentTypes = ["foto", "dokument", "pruefung", "wartung", "sonstiges"] as const;

const moveInputSchema = z.object({
  assignmentId: z.string().uuid(),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  resourceType: z.enum(resourceTypes),
  resourceId: z.string().uuid()
});

export type MovePlanningAssignmentInput = z.infer<typeof moveInputSchema>;

function enumValue<T extends readonly [string, ...string[]]>(value: string | null, values: T, fallback: T[number]) {
  if (value && (values as readonly string[]).includes(value)) return value as T[number];
  return fallback;
}

function requiredDate(formData: FormData, key: string, label: string) {
  const value = requiredFormString(formData, key, label);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new SafeActionError(`${label} muss ein Datum sein.`);
  return value;
}

function assertDateOrder(startDate: string, endDate: string) {
  if (endDate < startDate) throw new SafeActionError("Enddatum darf nicht vor dem Startdatum liegen.");
}

function safeColor(value: string | null) {
  if (!value) return "#2E7D32";
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#2E7D32";
}

function optionalPositiveInteger(formData: FormData, key: string) {
  const value = optionalNumber(formData, key);
  if (value === null) return null;
  if (!Number.isInteger(value) || value <= 0 || value > 3650) {
    throw new SafeActionError("Wartungsintervall muss eine ganze Zahl zwischen 1 und 3650 Tagen sein.");
  }
  return value;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextMaintenanceDate(formData: FormData) {
  const explicit = optionalDate(formData, "next_maintenance_at");
  if (explicit) return explicit;

  const lastMaintenance = optionalDate(formData, "last_maintenance_at");
  const intervalDays = optionalPositiveInteger(formData, "maintenance_interval_days");
  if (!lastMaintenance || !intervalDays) return null;
  return addDays(lastMaintenance, intervalDays);
}

async function resourceMetaFromForm({
  formData,
  supabase,
  companyId
}: {
  formData: FormData;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
}) {
  const responsibleEmployeeId = optionalFormUuid(formData, "responsible_employee_id", "verantwortlicher Mitarbeiter");
  const vehicleId = optionalFormUuid(formData, "vehicle_id", "Fahrzeug");

  if (responsibleEmployeeId) {
    await assertProfilesInCompany({
      supabase,
      companyId,
      profileIds: [responsibleEmployeeId],
      allowedRoles: ["vorarbeiter", "mitarbeiter"]
    });
  }

  if (vehicleId) {
    await assertVehicleInCompany({ supabase, companyId, vehicleId });
  }

  return {
    inspection_due_date: optionalDate(formData, "inspection_due_date"),
    maintenance_interval_days: optionalPositiveInteger(formData, "maintenance_interval_days"),
    last_maintenance_at: optionalDate(formData, "last_maintenance_at"),
    next_maintenance_at: nextMaintenanceDate(formData),
    location_text: optionalFormString(formData, "location_text"),
    responsible_employee_id: responsibleEmployeeId,
    vehicle_id: vehicleId,
    qr_code: optionalFormString(formData, "qr_code"),
    nfc_tag_id: optionalFormString(formData, "nfc_tag_id")
  };
}

async function assertPlanningResourceInCompany({
  supabase,
  companyId,
  resourceId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  resourceId: string;
}) {
  const { data, error } = await supabase
    .from("planning_resources")
    .select("id")
    .eq("id", resourceId)
    .eq("company_id", companyId)
    .eq("active", true)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Geraet/Ressource wurde nicht gefunden.");
  return data;
}

async function assertTargetInCompany({
  supabase,
  companyId,
  resourceType,
  resourceId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  resourceType: PlanningResourceType;
  resourceId: string;
}) {
  if (resourceType === "employee") {
    await assertProfilesInCompany({
      supabase,
      companyId,
      profileIds: [resourceId],
      allowedRoles: ["vorarbeiter", "mitarbeiter"]
    });
    return;
  }

  if (resourceType === "vehicle") {
    await assertVehicleInCompany({ supabase, companyId, vehicleId: resourceId });
    return;
  }

  await assertPlanningResourceInCompany({ supabase, companyId, resourceId });
}

function resourceTargetFromForm(formData: FormData) {
  const resourceKey = optionalFormString(formData, "resource_key");
  if (resourceKey) {
    const [type, id] = resourceKey.split(":");
    if ((resourceTypes as readonly string[]).includes(type) && z.string().uuid().safeParse(id).success) {
      return { resourceType: type as PlanningResourceType, resourceId: id };
    }
    throw new SafeActionError("Ungueltige Ressource.");
  }

  return {
    resourceType: enumValue(optionalFormString(formData, "resource_type"), resourceTypes, "employee") as PlanningResourceType,
    resourceId: requiredFormUuid(formData, "resource_id", "Ressource")
  };
}

function targetColumns(resourceType: PlanningResourceType, resourceId: string) {
  return {
    employee_id: resourceType === "employee" ? resourceId : null,
    vehicle_id: resourceType === "vehicle" ? resourceId : null,
    planning_resource_id: resourceType === "equipment" ? resourceId : null
  };
}

async function loadJobsiteName({
  supabase,
  companyId,
  jobsiteId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  jobsiteId: string | null;
}) {
  if (!jobsiteId) return null;
  const { data, error } = await supabase
    .from("jobsites")
    .select("id, name")
    .eq("id", jobsiteId)
    .eq("company_id", companyId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Baustelle wurde nicht gefunden.");
  return data as { id: string; name: string };
}

export async function createPlanningResourceAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"), "/plantafel");

  try {
    const resourceKind = enumValue(optionalFormString(formData, "resource_kind"), resourceKinds, "geraet") as PlanningResourceKind;
    const status = enumValue(optionalFormString(formData, "status"), resourceStatuses, "verfuegbar") as PlanningResourceStatus;
    const meta = await resourceMetaFromForm({ formData, supabase, companyId: context.companyId });
    const { data, error } = await supabase
      .from("planning_resources")
      .insert({
        company_id: context.companyId,
        name: requiredFormString(formData, "name", "Name"),
        resource_kind: resourceKind,
        status,
        ...meta,
        notes: optionalFormString(formData, "notes"),
        created_by: context.userId
      })
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Ressource konnte nicht angelegt werden. Ist die Plantafel-Migration eingespielt?");
  } catch (error) {
    redirect(withStatusMessage(returnTo, "error", safeErrorMessage(error, "Ressource konnte nicht angelegt werden.")));
  }

  revalidatePath("/plantafel");
  revalidatePath("/fahrzeuge");
  redirect(withStatusMessage(returnTo, "success", "Ressource wurde angelegt."));
}

export async function updatePlanningResourceAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const resourceId = requiredFormUuid(formData, "resource_id", "Ressource");
  const returnTo = safeReturnPath(formData.get("return_to"), `/fahrzeuge/ressourcen/${resourceId}/bearbeiten`);

  try {
    const resourceKind = enumValue(optionalFormString(formData, "resource_kind"), resourceKinds, "geraet") as PlanningResourceKind;
    const status = enumValue(optionalFormString(formData, "status"), resourceStatuses, "verfuegbar") as PlanningResourceStatus;
    const meta = await resourceMetaFromForm({ formData, supabase, companyId: context.companyId });

    const { data, error } = await supabase
      .from("planning_resources")
      .update({
        name: requiredFormString(formData, "name", "Name"),
        resource_kind: resourceKind,
        status,
        ...meta,
        notes: optionalFormString(formData, "notes"),
        active: status !== "archiviert"
      })
      .eq("id", resourceId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Ressource konnte nicht gespeichert werden. Ist die Ressourcen-Migration eingespielt?");
  } catch (error) {
    redirect(withStatusMessage(returnTo, "error", safeErrorMessage(error, "Ressource konnte nicht gespeichert werden.")));
  }

  revalidatePath("/plantafel");
  revalidatePath("/fahrzeuge");
  revalidatePath(`/fahrzeuge/ressourcen/${resourceId}/bearbeiten`);
  redirect(withStatusMessage(returnTo, "success", "Ressource wurde gespeichert."));
}

export async function archivePlanningResourceAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const resourceId = requiredFormUuid(formData, "resource_id", "Ressource");
  const returnTo = safeReturnPath(formData.get("return_to"), "/fahrzeuge");

  try {
    const { data, error } = await supabase
      .from("planning_resources")
      .update({
        status: "archiviert",
        active: false,
        archived_at: new Date().toISOString()
      })
      .eq("id", resourceId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Ressource konnte nicht archiviert werden.");
  } catch (error) {
    redirect(withStatusMessage(returnTo, "error", safeErrorMessage(error, "Ressource konnte nicht archiviert werden.")));
  }

  revalidatePath("/plantafel");
  revalidatePath("/fahrzeuge");
  redirect(withStatusMessage(returnTo, "success", "Ressource wurde archiviert."));
}

function documentType(value: string | null): ResourceDocumentType {
  return enumValue(value, documentTypes, "sonstiges") as ResourceDocumentType;
}

function cleanDocumentTitle(value: string | null, fallback: string) {
  const title = (value ?? "").trim();
  if (!title) return fallback;
  if (title.length > 140) throw new SafeActionError("Dokumenttitel ist zu lang.");
  return title;
}

async function assertDocumentTarget({
  supabase,
  companyId,
  targetType,
  targetId
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  targetType: "resource" | "vehicle";
  targetId: string;
}) {
  if (targetType === "vehicle") {
    await assertVehicleInCompany({ supabase, companyId, vehicleId: targetId });
    return { planning_resource_id: null, vehicle_id: targetId, storageSegment: "vehicles" };
  }

  await assertPlanningResourceInCompany({ supabase, companyId, resourceId: targetId });
  return { planning_resource_id: targetId, vehicle_id: null, storageSegment: "resources" };
}

export async function uploadResourceDocumentAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const targetType = enumValue(optionalFormString(formData, "target_type"), ["resource", "vehicle"] as const, "resource");
  const targetId = requiredFormUuid(formData, "target_id", "Ressource");
  const returnTo = safeReturnPath(
    formData.get("return_to"),
    targetType === "vehicle" ? `/fahrzeuge/${targetId}/bearbeiten` : `/fahrzeuge/ressourcen/${targetId}/bearbeiten`
  );

  try {
    const target = await assertDocumentTarget({
      supabase,
      companyId: context.companyId,
      targetType,
      targetId
    });
    const file = formData.get("document");
    if (!(file instanceof File) || file.size === 0) throw new SafeActionError("Bitte ein Foto oder Dokument auswaehlen.");

    await checkRateLimit(`resource-document-upload:${context.companyId}:${context.userId}`, 20, 60_000);
    await validateCustomerDocument(file);

    const safeName = sanitizeUploadFileName(file.name);
    const type = documentType(optionalFormString(formData, "document_type"));
    const title = cleanDocumentTitle(optionalFormString(formData, "title"), safeName);
    const storagePath = `${context.companyId}/${target.storageSegment}/${targetId}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("resource-documents").upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false
    });

    if (uploadError) throw new SafeActionError("Datei konnte nicht hochgeladen werden.");

    const { data, error } = await supabase
      .from("resource_documents")
      .insert({
        company_id: context.companyId,
        planning_resource_id: target.planning_resource_id,
        vehicle_id: target.vehicle_id,
        document_type: type,
        title,
        storage_path: storagePath,
        file_name: safeName,
        content_type: file.type || null,
        size_bytes: file.size,
        uploaded_by: context.userId
      })
      .select("id")
      .maybeSingle();

    if (error || !data) {
      await supabase.storage.from("resource-documents").remove([storagePath]);
      throw new SafeActionError("Datei-Metadaten konnten nicht gespeichert werden. Ist die Ressourcen-Migration eingespielt?");
    }
  } catch (error) {
    redirect(withStatusMessage(returnTo, "error", safeErrorMessage(error, "Datei konnte nicht gespeichert werden.")));
  }

  revalidatePath(returnTo);
  redirect(withStatusMessage(returnTo, "success", "Datei wurde gespeichert."));
}

export async function archiveResourceDocumentAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const documentId = requiredFormUuid(formData, "document_id", "Datei");
  const returnTo = safeReturnPath(formData.get("return_to"), "/fahrzeuge");

  try {
    const { data, error } = await supabase
      .from("resource_documents")
      .update({ archived_at: new Date().toISOString() })
      .eq("company_id", context.companyId)
      .eq("id", documentId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Datei konnte nicht archiviert werden.");
  } catch (error) {
    redirect(withStatusMessage(returnTo, "error", safeErrorMessage(error, "Datei konnte nicht archiviert werden.")));
  }

  revalidatePath(returnTo);
  redirect(withStatusMessage(returnTo, "success", "Datei wurde archiviert."));
}

export async function createPlanningAssignmentAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"), "/plantafel");

  try {
    const { resourceType, resourceId } = resourceTargetFromForm(formData);
    const jobsiteId = optionalFormUuid(formData, "jobsite_id", "Baustelle");
    const startDate = requiredDate(formData, "start_date", "Startdatum");
    const endDate = requiredDate(formData, "end_date", "Enddatum");
    assertDateOrder(startDate, endDate);

    await assertTargetInCompany({ supabase, companyId: context.companyId, resourceType, resourceId });
    const jobsite = await loadJobsiteName({ supabase, companyId: context.companyId, jobsiteId });
    const title = optionalFormString(formData, "title") ?? jobsite?.name ?? "Blocker";
    const status = enumValue(optionalFormString(formData, "status"), assignmentStatuses, "geplant") as PlanningAssignmentStatus;

    const { data, error } = await supabase
      .from("planning_assignments")
      .insert({
        company_id: context.companyId,
        jobsite_id: jobsiteId,
        title,
        resource_type: resourceType,
        ...targetColumns(resourceType, resourceId),
        start_date: startDate,
        end_date: endDate,
        status,
        color: safeColor(optionalFormString(formData, "color")),
        notes: optionalFormString(formData, "notes"),
        created_by: context.userId
      })
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Planung konnte nicht gespeichert werden. Ist die Plantafel-Migration eingespielt?");
  } catch (error) {
    redirect(withStatusMessage(returnTo, "error", safeErrorMessage(error, "Planung konnte nicht gespeichert werden.")));
  }

  revalidatePath("/plantafel");
  redirect(withStatusMessage(returnTo, "success", "Planung wurde gespeichert."));
}

export async function archivePlanningAssignmentAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"), "/plantafel");
  const assignmentId = requiredFormUuid(formData, "assignment_id", "Planung");

  try {
    const { data, error } = await supabase
      .from("planning_assignments")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", assignmentId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Planung konnte nicht archiviert werden.");
  } catch (error) {
    redirect(withStatusMessage(returnTo, "error", safeErrorMessage(error, "Planung konnte nicht archiviert werden.")));
  }

  revalidatePath("/plantafel");
  redirect(withStatusMessage(returnTo, "success", "Planung wurde archiviert."));
}

export async function movePlanningAssignmentAction(input: MovePlanningAssignmentInput) {
  try {
    const parsed = moveInputSchema.parse(input);
    const context = await requireManager();
    const supabase = await createSupabaseServerClient();

    await assertTargetInCompany({
      supabase,
      companyId: context.companyId,
      resourceType: parsed.resourceType,
      resourceId: parsed.resourceId
    });

    const { data: assignmentRow, error: loadError } = await supabase
      .from("planning_assignments")
      .select("id, start_date, end_date")
      .eq("id", parsed.assignmentId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();

    if (loadError || !assignmentRow) throw new SafeActionError("Planung wurde nicht gefunden.");
    const assignment = assignmentRow as Pick<PlanningAssignment, "id" | "start_date" | "end_date">;
    const durationMs = parseIsoDate(assignment.end_date).getTime() - parseIsoDate(assignment.start_date).getTime();
    const durationDays = Math.max(0, Math.round(durationMs / 86_400_000));
    const nextEndDate = addDaysIso(parsed.targetDate, durationDays);

    const { data, error } = await supabase
      .from("planning_assignments")
      .update({
        resource_type: parsed.resourceType,
        ...targetColumns(parsed.resourceType, parsed.resourceId),
        start_date: parsed.targetDate,
        end_date: nextEndDate
      })
      .eq("id", parsed.assignmentId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Planung konnte nicht verschoben werden.");

    revalidatePath("/plantafel");
    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, error: safeErrorMessage(error, "Planung konnte nicht verschoben werden.") };
  }
}

export async function setPlanningWeatherWarningAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"), "/plantafel");
  const checkId = requiredFormUuid(formData, "check_id", "Wetterwarnung");
  const action = enumValue(optionalFormString(formData, "action"), ["confirmed", "ignored"] as const, "confirmed");

  try {
    const { data, error } = await supabase
      .from("planning_weather_checks")
      .update({
        acknowledged_action: action,
        acknowledged_by: context.userId,
        acknowledged_at: new Date().toISOString(),
        acknowledgment_note: optionalFormString(formData, "note")
      })
      .eq("id", checkId)
      .eq("company_id", context.companyId)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Wetterwarnung konnte nicht aktualisiert werden.");
  } catch (error) {
    redirect(withStatusMessage(returnTo, "error", safeErrorMessage(error, "Wetterwarnung konnte nicht aktualisiert werden.")));
  }

  revalidatePath("/plantafel");
  redirect(withStatusMessage(returnTo, "success", action === "ignored" ? "Wetterwarnung wurde ignoriert." : "Wetterwarnung wurde bestaetigt."));
}
