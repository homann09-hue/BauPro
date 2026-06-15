"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth";
import { sanitizeUploadFileName, validateReportPhoto } from "@/lib/security/uploads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formIds, optionalDate, optionalString, requiredString } from "@/lib/utils";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function reportEmployees(formData: FormData, userId: string, canManage: boolean) {
  const employees = formIds(formData, "employee_ids");
  if (canManage) {
    return employees.length > 0 ? employees : [userId];
  }

  return employees.includes(userId) ? employees : [userId];
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

  for (const [index, file] of files.entries()) {
    validateReportPhoto(file);
    const safeName = sanitizeUploadFileName(file.name);
    const path = `${companyId}/reports/${reportId}/${Date.now()}-${index}-${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("report-photos")
      .upload(path, file, {
        contentType: file.type || undefined,
        upsert: false
    });

    if (uploadError) {
      throw new Error("Foto konnte nicht hochgeladen werden.");
    }

    const { error: insertError } = await supabase.from("report_photos").insert({
      company_id: companyId,
      report_id: reportId,
      jobsite_id: jobsiteId,
      storage_path: path,
      file_name: file.name,
      content_type: file.type || null,
      created_by: userId
    });

    if (insertError) {
      throw new Error("Foto-Metadaten konnten nicht gespeichert werden.");
    }
  }
}

export async function createReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const jobsiteId = optionalString(formData, "jobsite_id");

  const { data, error } = await supabase
    .from("reports")
    .insert({
      company_id: context.companyId,
      jobsite_id: jobsiteId,
      report_date: optionalDate(formData, "report_date") ?? new Date().toISOString().slice(0, 10),
      weather: optionalString(formData, "weather"),
      work_start: optionalString(formData, "work_start"),
      work_end: optionalString(formData, "work_end"),
      employee_ids: reportEmployees(formData, context.userId, context.canManage),
      activities: requiredString(formData, "activities"),
      material_usage: optionalString(formData, "material_usage"),
      issues: optionalString(formData, "issues"),
      signature_name: optionalString(formData, "signature_name"),
      created_by: context.userId
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/berichte/neu?error=${toQuery(error?.message ?? "Bericht konnte nicht angelegt werden.")}`);
  }

  try {
    await uploadReportPhotos({
      formData,
      reportId: data.id,
      jobsiteId,
      companyId: context.companyId,
      userId: context.userId
    });
  } catch (uploadError) {
    redirect(`/berichte/${data.id}?error=${toQuery((uploadError as Error).message)}`);
  }

  revalidatePath("/berichte");
  redirect(`/berichte/${data.id}?success=${toQuery("Tagesbericht wurde angelegt.")}`);
}

export async function updateReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");
  const jobsiteId = optionalString(formData, "jobsite_id");

  const { error } = await supabase
    .from("reports")
    .update({
      jobsite_id: jobsiteId,
      report_date: optionalDate(formData, "report_date") ?? new Date().toISOString().slice(0, 10),
      weather: optionalString(formData, "weather"),
      work_start: optionalString(formData, "work_start"),
      work_end: optionalString(formData, "work_end"),
      employee_ids: reportEmployees(formData, context.userId, context.canManage),
      activities: requiredString(formData, "activities"),
      material_usage: optionalString(formData, "material_usage"),
      issues: optionalString(formData, "issues"),
      signature_name: optionalString(formData, "signature_name")
    })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/berichte/${id}/bearbeiten?error=${toQuery(error.message)}`);
  }

  try {
    await uploadReportPhotos({
      formData,
      reportId: id,
      jobsiteId,
      companyId: context.companyId,
      userId: context.userId
    });
  } catch (uploadError) {
    redirect(`/berichte/${id}/bearbeiten?error=${toQuery((uploadError as Error).message)}`);
  }

  revalidatePath("/berichte");
  revalidatePath(`/berichte/${id}`);
  redirect(`/berichte/${id}?success=${toQuery("Tagesbericht wurde aktualisiert.")}`);
}

export async function deleteReportAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");

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
    redirect(`/berichte/${id}?error=${toQuery(error.message)}`);
  }

  revalidatePath("/berichte");
  redirect(`/berichte?success=${toQuery("Tagesbericht wurde geloescht.")}`);
}

export async function deleteReportPhotoAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");
  const reportId = requiredString(formData, "report_id");
  const storagePath = requiredString(formData, "storage_path");

  await supabase.storage.from("report-photos").remove([storagePath]);

  const { error } = await supabase
    .from("report_photos")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/berichte/${reportId}/bearbeiten?error=${toQuery(error.message)}`);
  }

  revalidatePath(`/berichte/${reportId}`);
  redirect(`/berichte/${reportId}/bearbeiten?success=${toQuery("Foto wurde geloescht.")}`);
}
