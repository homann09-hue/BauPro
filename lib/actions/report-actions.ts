"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppContext } from "@/lib/auth";
import { requireAppContext } from "@/lib/auth";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { optionalFormUuid, requiredFormUuid, formUuidList } from "@/lib/security/form-data";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertJobsiteInCompany, assertProfilesInCompany } from "@/lib/security/tenant-guards";
import { sanitizeUploadFileName, validateReportPhoto } from "@/lib/security/uploads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalDate, optionalString, requiredString } from "@/lib/utils";

async function reportEmployees({
  formData,
  context,
  supabase
}: {
  formData: FormData;
  context: AppContext;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}) {
  if (!context.canManage) return [context.userId];

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

export async function createReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const jobsiteId = optionalFormUuid(formData, "jobsite_id", "Baustelle");
  let createdReportId: string | null = null;

  try {
    await assertJobsiteInCompany({ supabase, context, jobsiteId });

    const employeeIds = await reportEmployees({ formData, context, supabase });

    const { data, error } = await supabase
      .from("reports")
      .insert({
        company_id: context.companyId,
        jobsite_id: jobsiteId,
        report_date: optionalDate(formData, "report_date") ?? new Date().toISOString().slice(0, 10),
        weather: optionalString(formData, "weather"),
        work_start: optionalString(formData, "work_start"),
        work_end: optionalString(formData, "work_end"),
        employee_ids: employeeIds,
        activities: requiredString(formData, "activities"),
        material_usage: optionalString(formData, "material_usage"),
        issues: optionalString(formData, "issues"),
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
  redirect(`/${createdReportId ? `berichte/${createdReportId}` : "berichte"}?success=${toQuery("Tagesbericht wurde angelegt.")}`);
}

export async function updateReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Bericht");
  const jobsiteId = optionalFormUuid(formData, "jobsite_id", "Baustelle");

  try {
    await assertJobsiteInCompany({ supabase, context, jobsiteId });
    const employeeIds = await reportEmployees({ formData, context, supabase });

    const { error } = await supabase
      .from("reports")
      .update({
        jobsite_id: jobsiteId,
        report_date: optionalDate(formData, "report_date") ?? new Date().toISOString().slice(0, 10),
        weather: optionalString(formData, "weather"),
        work_start: optionalString(formData, "work_start"),
        work_end: optionalString(formData, "work_end"),
        employee_ids: employeeIds,
        activities: requiredString(formData, "activities"),
        material_usage: optionalString(formData, "material_usage"),
        issues: optionalString(formData, "issues"),
        signature_name: optionalString(formData, "signature_name")
      })
      .eq("id", id)
      .eq("company_id", context.companyId);

    if (error) throw new SafeActionError("Bericht konnte nicht aktualisiert werden.");

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
  redirect(`/berichte/${id}?success=${toQuery("Tagesbericht wurde aktualisiert.")}`);
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
    .maybeSingle();

  if (!report || (!context.canManage && (report as { created_by?: string | null }).created_by !== context.userId)) {
    redirect(`/berichte/${id}?error=${toQuery("Keine Berechtigung fuer diesen Bericht.")}`);
  }

  const { data: photos } = await supabase
    .from("report_photos")
    .select("storage_path")
    .eq("report_id", id)
    .eq("company_id", context.companyId);

  if (photos?.length) {
    await supabase.storage
      .from("report-photos")
      .remove(photos.map((photo) => photo.storage_path as string));
  }

  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/berichte/${id}?error=${toQuery("Bericht konnte nicht geloescht werden.")}`);
  }

  revalidatePath("/berichte");
  redirect(`/berichte?success=${toQuery("Tagesbericht wurde geloescht.")}`);
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
    .maybeSingle();

  if (!photo || (!context.canManage && (photo as { created_by?: string | null }).created_by !== context.userId)) {
    redirect(`/berichte/${reportId}/bearbeiten?error=${toQuery("Keine Berechtigung fuer dieses Foto.")}`);
  }

  await supabase.storage.from("report-photos").remove([(photo as { storage_path: string }).storage_path]);

  const { error } = await supabase
    .from("report_photos")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/berichte/${reportId}/bearbeiten?error=${toQuery("Foto konnte nicht geloescht werden.")}`);
  }

  revalidatePath(`/berichte/${reportId}`);
  redirect(`/berichte/${reportId}/bearbeiten?success=${toQuery("Foto wurde geloescht.")}`);
}
