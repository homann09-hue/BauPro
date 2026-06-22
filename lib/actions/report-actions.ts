"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppContext } from "@/lib/auth";
import { requireAppContext } from "@/lib/auth";
import { contentHash } from "@/lib/customer-portal/tokens";
import { reportFormSelect } from "@/lib/data/selects";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { hasAppPermission } from "@/lib/permissions";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { formUuidList, optionalFormString, optionalFormUuid, requiredFormString, requiredFormUuid } from "@/lib/security/form-data";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertJobsiteInCompany, assertProfilesInCompany } from "@/lib/security/tenant-guards";
import { sanitizeUploadFileName, validateReportPhoto } from "@/lib/security/uploads";
import { signerRole, validateSignatureDataUrl } from "@/lib/signatures/signature";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalDate, optionalString, requiredString } from "@/lib/utils";
import { weatherPayloadFromFormData } from "@/lib/weather/form";
import type { DigitalSignatureStatus, Report, ReportStatus, TimeEntry } from "@/types/app";

async function reportEmployees({
  formData,
  context,
  supabase
}: {
  formData: FormData;
  context: AppContext;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  if (!context.canOperate) return [context.userId];

  const employees = formUuidList(formData, "employee_ids", "Mitarbeiter");
  if (employees.length === 0) {
    return [context.userId];
  }

  return assertProfilesInCompany({
    supabase,
    companyId: context.companyId,
    profileIds: employees,
    allowedRoles: ["vorarbeiter", "mitarbeiter"]
  });
}

function reportStatusFromForm(formData: FormData): ReportStatus {
  const value = optionalFormString(formData, "report_status");
  if (value === "submitted") return "submitted";
  return "draft";
}

async function reportVehicleIds({
  formData,
  supabase,
  companyId
}: {
  formData: FormData;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
}) {
  const ids = formUuidList(formData, "vehicle_ids", "Fahrzeuge");
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("vehicles")
    .select("id")
    .eq("company_id", companyId)
    .is("archived_at", null)
    .in("id", ids);
  if (error) throw new SafeActionError("Fahrzeuge konnten nicht geprueft werden.");
  const rows = (data ?? []) as Array<{ id: string }>;
  if (rows.length !== ids.length) throw new SafeActionError("Mindestens ein Fahrzeug gehoert nicht zu deiner Firma.");
  return rows.map((row) => row.id);
}

async function linkedTimeEntries({
  formData,
  supabase,
  context,
  jobsiteId,
  reportDate
}: {
  formData: FormData;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  context: AppContext;
  jobsiteId: string | null;
  reportDate: string;
}) {
  const ids = formUuidList(formData, "linked_time_entry_ids", "Arbeitszeiten");
  if (ids.length === 0) return [] as TimeEntry[];

  let query = supabase
    .from("time_entries")
    .select("id, company_id, employee_id, job_id, customer_id, date, work_location, work_address, start_time, end_time, break_minutes, gross_minutes, net_minutes, activity, weather, weather_summary, weather_temperature_c, weather_precipitation_mm, weather_wind_kmh, weather_source, weather_fetched_at, weather_lat, weather_lng, kilometers, notes, status, approved_by, approved_at, created_by, created_at, updated_at")
    .eq("company_id", context.companyId)
    .eq("date", reportDate)
    .in("id", ids);
  if (jobsiteId) query = query.eq("job_id", jobsiteId);
  if (!context.canOperate) query = query.eq("employee_id", context.userId);

  const { data, error } = await query;
  if (error) throw new SafeActionError("Arbeitszeiten konnten nicht uebernommen werden.");
  const rows = (data ?? []) as unknown as TimeEntry[];
  if (rows.length !== ids.length) {
    throw new SafeActionError("Mindestens eine ausgewaehlte Arbeitszeit passt nicht zu Baustelle, Datum oder Berechtigung.");
  }
  return rows;
}

function timeRangeFromEntries(entries: TimeEntry[]) {
  const start = entries
    .map((entry) => entry.start_time?.slice(0, 5))
    .filter(Boolean)
    .sort()[0] ?? null;
  const end = entries
    .map((entry) => entry.end_time?.slice(0, 5))
    .filter(Boolean)
    .sort()
    .at(-1) ?? null;
  return { start, end };
}

async function uploadReportPhotos({
  formData,
  reportId,
  jobsiteId,
  companyId,
  userId
}: {
  formData: FormData;
  reportId: string;
  jobsiteId: string | null;
  companyId: string;
  userId: string;
}) {
  const supabase = await createSupabaseServerClient();
  const files = formData
    .getAll("photos")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (files.length > 12) {
    throw new SafeActionError("Bitte maximal 12 Fotos pro Bericht hochladen.");
  }

  assertRateLimit(`report-upload:${companyId}:${userId}`, 25, 60_000);

  for (const [index, file] of files.entries()) {
    await validateReportPhoto(file);
    const safeName = sanitizeUploadFileName(file.name);
    const path = `${companyId}/reports/${reportId}/${Date.now()}-${index}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("report-photos")
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false
    });

    if (uploadError) {
      throw new SafeActionError("Foto konnte nicht hochgeladen werden.");
    }

    const { error: insertError } = await supabase.from("report_photos").insert({
      company_id: companyId,
      report_id: reportId,
      jobsite_id: jobsiteId,
      storage_path: path,
      file_name: safeName,
      content_type: file.type || null,
      created_by: userId
    });

    if (insertError) {
      throw new SafeActionError("Foto-Metadaten konnten nicht gespeichert werden.");
    }
  }
}

function reportSignatureDecision(value: string | null): DigitalSignatureStatus {
  if (value === "sign") return "signed";
  if (value === "reject") return "rejected";
  throw new SafeActionError("Ungueltige Signatur-Aktion.");
}

function canAccessReportSignature(context: AppContext, report: Pick<Report, "created_by" | "employee_ids">) {
  return context.canManage || report.created_by === context.userId || report.employee_ids.includes(context.userId);
}

function signedReportSnapshot(
  report: Report,
  updates: {
    signature_status: DigitalSignatureStatus;
    signature_name: string;
    signature_role: string;
    signature_signed_at: string | null;
    rejection_reason: string | null;
    signature_data_url: string | null;
  }
) {
  return {
    id: report.id,
    jobsite_id: report.jobsite_id,
    report_date: report.report_date,
    weather: report.weather,
    weather_summary: report.weather_summary ?? null,
    weather_temperature_c: report.weather_temperature_c ?? null,
    weather_precipitation_mm: report.weather_precipitation_mm ?? null,
    weather_wind_kmh: report.weather_wind_kmh ?? null,
    weather_source: report.weather_source ?? null,
    weather_fetched_at: report.weather_fetched_at ?? null,
    weather_lat: report.weather_lat ?? null,
    weather_lng: report.weather_lng ?? null,
    work_start: report.work_start,
    work_end: report.work_end,
    employee_ids: report.employee_ids,
    activities: report.activities,
    material_usage: report.material_usage,
    machine_usage: report.machine_usage ?? null,
    vehicle_ids: report.vehicle_ids ?? [],
    linked_time_entry_ids: report.linked_time_entry_ids ?? [],
    issues: report.issues,
    report_status: report.report_status ?? "draft",
    created_by: report.created_by,
    source_report_id: report.source_report_id ?? null,
    document_version: report.document_version ?? 1,
    signature_status: updates.signature_status,
    signature_name: updates.signature_name,
    signature_role: updates.signature_role,
    signature_signed_at: updates.signature_signed_at,
    rejection_reason: updates.rejection_reason,
    signature_data_hash: contentHash(updates.signature_data_url ?? "")
  };
}

export async function createReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const jobsiteId = optionalFormUuid(formData, "jobsite_id", "Baustelle");
  let createdReportId: string | null = null;

  try {
    await assertJobsiteInCompany({ supabase, context, jobsiteId });

    const reportDate = optionalDate(formData, "report_date") ?? new Date().toISOString().slice(0, 10);
    const status = reportStatusFromForm(formData);
    const timeEntries = await linkedTimeEntries({ formData, supabase, context, jobsiteId, reportDate });
    const employeeIds = Array.from(
      new Set([...(await reportEmployees({ formData, context, supabase })), ...timeEntries.map((entry) => entry.employee_id)])
    );
    const vehicles = await reportVehicleIds({ formData, supabase, companyId: context.companyId });
    const timeRange = timeRangeFromEntries(timeEntries);

    const { data, error } = await supabase
      .from("reports")
      .insert({
        company_id: context.companyId,
        jobsite_id: jobsiteId,
        report_date: reportDate,
        ...weatherPayloadFromFormData(formData),
        work_start: optionalString(formData, "work_start") ?? timeRange.start,
        work_end: optionalString(formData, "work_end") ?? timeRange.end,
        employee_ids: employeeIds,
        activities: requiredString(formData, "activities"),
        material_usage: optionalString(formData, "material_usage"),
        machine_usage: optionalString(formData, "machine_usage"),
        vehicle_ids: vehicles,
        linked_time_entry_ids: timeEntries.map((entry) => entry.id),
        issues: optionalString(formData, "issues"),
        report_status: status,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
        signature_name: optionalString(formData, "signature_name"),
        created_by: context.userId
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new SafeActionError("Bericht konnte nicht angelegt werden.");
    }

    createdReportId = data.id;
    await uploadReportPhotos({
      formData,
      reportId: data.id,
      jobsiteId,
      companyId: context.companyId,
      userId: context.userId
    });
  } catch (uploadError) {
    redirect(`/berichte/neu?error=${toQuery(safeErrorMessage(uploadError, "Bericht konnte nicht angelegt werden."))}`);
  }

  revalidatePath("/berichte");
  revalidateDashboardCache(context.companyId);
  redirect(`/${createdReportId ? `berichte/${createdReportId}` : "berichte"}?success=${toQuery("Tagesbericht wurde angelegt.")}`);
}

export async function updateReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Bericht");
  const jobsiteId = optionalFormUuid(formData, "jobsite_id", "Baustelle");

  try {
    const { data: existingReport, error: existingError } = await supabase
      .from("reports")
      .select("id, created_by, signature_status, report_status")
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();

    if (existingError || !existingReport) throw new SafeActionError("Bericht wurde nicht gefunden.");
    const currentReport = existingReport as Pick<Report, "id" | "created_by" | "signature_status" | "report_status">;
    if (!context.canManage && currentReport.created_by !== context.userId) {
      throw new SafeActionError("Keine Berechtigung fuer diesen Bericht.");
    }
    if (currentReport.signature_status === "signed" || currentReport.signature_status === "rejected") {
      throw new SafeActionError("Signierte Tagesberichte koennen nicht geaendert werden. Bitte neue Version erzeugen.");
    }
    if (currentReport.report_status === "approved") {
      throw new SafeActionError("Freigegebene Bautagesberichte koennen nicht geaendert werden. Bitte neue Version erzeugen.");
    }

    await assertJobsiteInCompany({ supabase, context, jobsiteId });
    const reportDate = optionalDate(formData, "report_date") ?? new Date().toISOString().slice(0, 10);
    const status = reportStatusFromForm(formData);
    const timeEntries = await linkedTimeEntries({ formData, supabase, context, jobsiteId, reportDate });
    const employeeIds = Array.from(
      new Set([...(await reportEmployees({ formData, context, supabase })), ...timeEntries.map((entry) => entry.employee_id)])
    );
    const vehicles = await reportVehicleIds({ formData, supabase, companyId: context.companyId });
    const timeRange = timeRangeFromEntries(timeEntries);

    let updateQuery = supabase
      .from("reports")
      .update({
        jobsite_id: jobsiteId,
        report_date: reportDate,
        ...weatherPayloadFromFormData(formData),
        work_start: optionalString(formData, "work_start") ?? timeRange.start,
        work_end: optionalString(formData, "work_end") ?? timeRange.end,
        employee_ids: employeeIds,
        activities: requiredString(formData, "activities"),
        material_usage: optionalString(formData, "material_usage"),
        machine_usage: optionalString(formData, "machine_usage"),
        vehicle_ids: vehicles,
        linked_time_entry_ids: timeEntries.map((entry) => entry.id),
        issues: optionalString(formData, "issues"),
        report_status: status,
        submitted_at: status === "submitted" ? new Date().toISOString() : null,
        reviewed_by: null,
        reviewed_at: null,
        approved_by: null,
        approved_at: null,
        signature_name: optionalString(formData, "signature_name")
      })
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null);
    if (!context.canManage) updateQuery = updateQuery.eq("created_by", context.userId);
    const { data, error } = await updateQuery.select("id").maybeSingle();

    if (error || !data) throw new SafeActionError("Bericht konnte nicht aktualisiert werden.");

    await uploadReportPhotos({
      formData,
      reportId: id,
      jobsiteId,
      companyId: context.companyId,
      userId: context.userId
    });
  } catch (uploadError) {
    redirect(`/berichte/${id}/bearbeiten?error=${toQuery(safeErrorMessage(uploadError, "Bericht konnte nicht aktualisiert werden."))}`);
  }

  revalidatePath("/berichte");
  revalidatePath(`/berichte/${id}`);
  revalidateDashboardCache(context.companyId);
  redirect(`/berichte/${id}?success=${toQuery("Tagesbericht wurde aktualisiert.")}`);
}

export async function signReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "report_id", "Bericht");
  let result: { success?: string; error?: string } = {};

  try {
    assertRateLimit(`report-sign:${context.companyId}:${context.userId}`, 20, 60_000);
    const status = reportSignatureDecision(requiredFormString(formData, "decision", "Entscheidung"));
    const signerName = requiredFormString(formData, "signer_name", "Name");
    if (signerName.length > 120) throw new SafeActionError("Name ist zu lang.");
    const rejectionReason = optionalFormString(formData, "rejection_reason");
    if (status === "rejected" && !rejectionReason) {
      throw new SafeActionError("Bitte bei Ablehnung kurz angeben, was korrigiert werden soll.");
    }
    const signatureDataUrl = validateSignatureDataUrl(optionalFormString(formData, "signature_data_url"), {
      required: status === "signed"
    });

    const { data: reportRow, error: reportError } = await supabase
      .from("reports")
      .select(`${reportFormSelect}, archived_at`)
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();

    if (reportError || !reportRow) throw new SafeActionError("Bericht wurde nicht gefunden.");
    const report = reportRow as unknown as Report;
    if (!canAccessReportSignature(context, report)) throw new SafeActionError("Keine Berechtigung fuer diesen Bericht.");
    if (report.signature_status === "signed" || report.signature_status === "rejected") {
      throw new SafeActionError("Dieser Tagesbericht ist bereits finalisiert.");
    }
    if (report.report_status === "approved") {
      throw new SafeActionError("Freigegebene Bautagesberichte koennen nicht mehr unterschrieben werden. Bitte neue Version erzeugen.");
    }

    const headerStore = await headers();
    const now = new Date().toISOString();
    const role = signerRole(context.profile.role);
    const signerIp = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const signerUserAgent = headerStore.get("user-agent") ?? null;
    const signatureSignedAt = status === "signed" ? now : null;
    const documentVersion = Number(report.document_version ?? 1);
    const snapshot = signedReportSnapshot(report, {
      signature_status: status,
      signature_name: signerName,
      signature_role: role,
      signature_signed_at: signatureSignedAt,
      rejection_reason: rejectionReason,
      signature_data_url: signatureDataUrl
    });
    const hash = contentHash(snapshot);

    const { data: updatedReport, error: updateError } = await supabase
      .from("reports")
      .update({
        signature_status: status,
        signature_name: signerName,
        signature_data_url: signatureDataUrl,
        signature_signed_at: signatureSignedAt,
        signature_role: role,
        signature_content_hash: hash
      })
      .eq("id", id)
      .eq("company_id", context.companyId)
      .eq("signature_status", "draft")
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (updateError || !updatedReport) throw new SafeActionError("Tagesbericht konnte nicht finalisiert werden.");

    const { error: versionError } = await supabase.from("digital_document_versions").insert({
      company_id: context.companyId,
      document_type: "report",
      document_id: id,
      version: documentVersion,
      snapshot,
      content_hash: hash,
      created_by: context.userId
    });
    if (versionError) throw new SafeActionError("Signatur-Version konnte nicht gespeichert werden.");

    const { error: signatureError } = await supabase.from("digital_signatures").insert({
      company_id: context.companyId,
      document_type: "report",
      document_id: id,
      document_version: documentVersion,
      jobsite_id: report.jobsite_id,
      status,
      signer_name: signerName,
      signer_role: role,
      signer_user_id: context.userId,
      signer_ip: signerIp,
      signer_user_agent: signerUserAgent,
      signature_data_url: signatureDataUrl,
      signed_at: status === "signed" ? now : null,
      rejected_at: status === "rejected" ? now : null,
      rejection_reason: status === "rejected" ? rejectionReason : null,
      content_hash: hash,
      metadata: {
        report_date: report.report_date
      }
    });
    if (signatureError) throw new SafeActionError("Signatur-Nachweis konnte nicht gespeichert werden.");

    revalidatePath("/berichte");
    revalidatePath(`/berichte/${id}`);
    revalidateDashboardCache(context.companyId);
    result = { success: status === "signed" ? "Tagesbericht wurde unterschrieben." : "Tagesbericht wurde abgelehnt." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Tagesbericht konnte nicht finalisiert werden.") };
  }

  const key = result.error ? "error" : "success";
  redirect(`/berichte/${id}?${key}=${toQuery(result.error ?? result.success ?? "")}`);
}

export async function createReportRevisionAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "report_id", "Bericht");
  let targetPath = `/berichte/${id}`;
  let result: { success?: string; error?: string } = {};

  try {
    const { data: reportRow, error: reportError } = await supabase
      .from("reports")
      .select(`${reportFormSelect}, archived_at`)
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();

    if (reportError || !reportRow) throw new SafeActionError("Bericht wurde nicht gefunden.");
    const report = reportRow as unknown as Report;
    if (!canAccessReportSignature(context, report)) throw new SafeActionError("Keine Berechtigung fuer diesen Bericht.");
    if (report.signature_status !== "signed" && report.signature_status !== "rejected" && report.report_status !== "approved") {
      throw new SafeActionError("Nur finalisierte oder freigegebene Berichte brauchen eine neue Version.");
    }

    const sourceReportId = report.source_report_id ?? report.id;
    const { data: versionRows } = await supabase
      .from("reports")
      .select("document_version")
      .eq("company_id", context.companyId)
      .or(`id.eq.${sourceReportId},source_report_id.eq.${sourceReportId}`);
    const nextVersion =
      Math.max(1, ...((versionRows ?? []) as Array<{ document_version?: number | null }>).map((row) => Number(row.document_version ?? 1))) + 1;

    const { data: created, error: createError } = await supabase
      .from("reports")
      .insert({
        company_id: context.companyId,
        jobsite_id: report.jobsite_id,
        report_date: report.report_date,
        weather: report.weather,
        weather_summary: report.weather_summary ?? null,
        weather_temperature_c: report.weather_temperature_c ?? null,
        weather_precipitation_mm: report.weather_precipitation_mm ?? null,
        weather_wind_kmh: report.weather_wind_kmh ?? null,
        weather_source: report.weather_source ?? null,
        weather_fetched_at: report.weather_fetched_at ?? null,
        weather_lat: report.weather_lat ?? null,
        weather_lng: report.weather_lng ?? null,
        work_start: report.work_start,
        work_end: report.work_end,
        employee_ids: report.employee_ids,
        activities: report.activities,
        material_usage: report.material_usage,
        machine_usage: report.machine_usage ?? null,
        vehicle_ids: report.vehicle_ids ?? [],
        linked_time_entry_ids: report.linked_time_entry_ids ?? [],
        issues: report.issues,
        report_status: "draft",
        submitted_at: null,
        reviewed_by: null,
        reviewed_at: null,
        approved_by: null,
        approved_at: null,
        signature_name: null,
        signature_status: "draft",
        signature_data_url: null,
        signature_signed_at: null,
        signature_role: null,
        signature_content_hash: null,
        source_report_id: sourceReportId,
        document_version: nextVersion,
        created_by: context.userId
      })
      .select("id")
      .single();

    if (createError || !created) throw new SafeActionError("Neue Berichtsversion konnte nicht angelegt werden.");
    targetPath = `/berichte/${created.id}/bearbeiten`;
    result = { success: `Neue Version ${nextVersion} wurde angelegt.` };
    revalidatePath("/berichte");
    revalidateDashboardCache(context.companyId);
  } catch (error) {
    result = { error: safeErrorMessage(error, "Neue Berichtsversion konnte nicht angelegt werden.") };
  }

  const key = result.error ? "error" : "success";
  redirect(`${targetPath}?${key}=${toQuery(result.error ?? result.success ?? "")}`);
}

export async function updateReportWorkflowAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "report_id", "Bericht");
  const nextStatus = requiredFormString(formData, "next_status", "Status");
  let result: { success?: string; error?: string } = {};

  try {
    if (!hasAppPermission(context.profile.role, context.permissions, "reports.approve")) {
      throw new SafeActionError("Keine Berechtigung zum Pruefen oder Freigeben von Bautagesberichten.");
    }
    if (nextStatus !== "reviewed" && nextStatus !== "approved") throw new SafeActionError("Ungueltiger Berichtstatus.");

    const { data: reportRow, error: reportError } = await supabase
      .from("reports")
      .select("id, report_status, signature_status")
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();

    if (reportError || !reportRow) throw new SafeActionError("Bericht wurde nicht gefunden.");
    const report = reportRow as Pick<Report, "id" | "report_status" | "signature_status">;
    if (report.report_status === "draft") throw new SafeActionError("Der Bericht muss zuerst eingereicht werden.");
    if (report.report_status === "approved") throw new SafeActionError("Dieser Bericht ist bereits freigegeben.");

    const now = new Date().toISOString();
    const update =
      nextStatus === "reviewed"
        ? { report_status: "reviewed" as ReportStatus, reviewed_by: context.userId, reviewed_at: now }
        : report.report_status === "reviewed"
          ? {
              report_status: "approved" as ReportStatus,
              approved_by: context.userId,
              approved_at: now
            }
          : {
              report_status: "approved" as ReportStatus,
              reviewed_by: context.userId,
              reviewed_at: now,
              approved_by: context.userId,
              approved_at: now
            };

    const { data, error } = await supabase
      .from("reports")
      .update(update)
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Berichtstatus konnte nicht gespeichert werden.");
    revalidatePath("/berichte");
    revalidatePath(`/berichte/${id}`);
    revalidateDashboardCache(context.companyId);
    result = { success: nextStatus === "approved" ? "Bautagesbericht wurde freigegeben." : "Bautagesbericht wurde geprueft." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Berichtstatus konnte nicht gespeichert werden.") };
  }

  const key = result.error ? "error" : "success";
  redirect(`/berichte/${id}?${key}=${toQuery(result.error ?? result.success ?? "")}`);
}

export async function deleteReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Bericht");

  const { data: report } = await supabase
    .from("reports")
    .select("id, created_by")
    .eq("id", id)
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .maybeSingle();

  if (!report || (!context.canManage && (report as { created_by?: string | null }).created_by !== context.userId)) {
    redirect(`/berichte/${id}?error=${toQuery("Keine Berechtigung fuer diesen Bericht.")}`);
  }

  const { data, error } = await supabase
    .from("reports")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/berichte/${id}?error=${toQuery("Bericht konnte nicht archiviert werden.")}`);
  }

  revalidatePath("/berichte");
  revalidateDashboardCache(context.companyId);
  redirect(`/berichte?success=${toQuery("Tagesbericht wurde archiviert.")}`);
}

export async function deleteReportPhotoAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Foto");
  const reportId = requiredFormUuid(formData, "report_id", "Bericht");

  const { data: photo } = await supabase
    .from("report_photos")
    .select("storage_path, created_by")
    .eq("id", id)
    .eq("report_id", reportId)
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .maybeSingle();

  if (!photo || (!context.canManage && (photo as { created_by?: string | null }).created_by !== context.userId)) {
    redirect(`/berichte/${reportId}/bearbeiten?error=${toQuery("Keine Berechtigung fuer dieses Foto.")}`);
  }

  const { data, error } = await supabase.rpc("archive_report_photo", {
    p_photo_id: id,
    p_report_id: reportId
  });

  if (error || !data) {
    redirect(`/berichte/${reportId}/bearbeiten?error=${toQuery("Foto konnte nicht archiviert werden.")}`);
  }

  revalidatePath(`/berichte/${reportId}`);
  revalidateDashboardCache(context.companyId);
  redirect(`/berichte/${reportId}/bearbeiten?success=${toQuery("Foto wurde archiviert.")}`);
}
