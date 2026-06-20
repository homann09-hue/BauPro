"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext, requireManager } from "@/lib/auth";
import { revalidateDashboardCache } from "@/lib/data/dashboard";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { optionalFormUuid, requiredFormUuid } from "@/lib/security/form-data";
import { assertJobsiteInCompany, assertProfilesInCompany } from "@/lib/security/tenant-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalDate, optionalString, requiredString } from "@/lib/utils";
import type { TaskStatus } from "@/types/app";

function taskStatus(value: FormDataEntryValue | null): TaskStatus {
  const status = String(value ?? "offen");
  return status === "in_arbeit" || status === "erledigt" ? status : "offen";
}

export async function createTaskAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();

  try {
    const jobsiteId = optionalFormUuid(formData, "jobsite_id", "Baustelle");
    const assignedTo = optionalFormUuid(formData, "assigned_to", "Mitarbeiter");
    await assertJobsiteInCompany({ supabase, context, jobsiteId });
    if (assignedTo) {
      await assertProfilesInCompany({
        supabase,
        companyId: context.companyId,
        profileIds: [assignedTo],
        allowedRoles: ["vorarbeiter", "mitarbeiter"]
      });
    }

    const { error } = await supabase.from("tasks").insert({
      company_id: context.companyId,
      jobsite_id: jobsiteId,
      title: requiredString(formData, "title"),
      description: optionalString(formData, "description"),
      assigned_to: assignedTo,
      due_date: optionalDate(formData, "due_date"),
      status: taskStatus(formData.get("status")),
      created_by: context.userId
    });

    if (error) throw new SafeActionError("Aufgabe konnte nicht angelegt werden.");
  } catch (error) {
    redirect(`/dashboard?error=${toQuery(safeErrorMessage(error, "Aufgabe konnte nicht angelegt werden."))}`);
  }

  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(`/dashboard?success=${toQuery("Aufgabe wurde angelegt.")}`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Aufgabe");

  try {
    let taskQuery = supabase
      .from("tasks")
      .select("id")
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null);

    if (!context.canManage) taskQuery = taskQuery.eq("assigned_to", context.userId);

    const { data: task } = await taskQuery.maybeSingle();
    if (!task) throw new SafeActionError("Aufgabe wurde nicht gefunden oder ist dir nicht zugewiesen.");

    let updateQuery = supabase
      .from("tasks")
      .update({ status: taskStatus(formData.get("status")) })
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null);

    if (!context.canManage) updateQuery = updateQuery.eq("assigned_to", context.userId);

    const { data, error } = await updateQuery.select("id").maybeSingle();
    if (error || !data) throw new Error("task_status_update_failed");
  } catch (error) {
    redirect(`/dashboard?error=${toQuery(safeErrorMessage(error, "Aufgabe konnte nicht aktualisiert werden."))}`);
  }

  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(`/dashboard?success=${toQuery("Aufgabe wurde aktualisiert.")}`);
}

export async function deleteTaskAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Aufgabe");

  try {
    const { data, error } = await supabase
      .from("tasks")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new Error("task_archive_failed");
  } catch (error) {
    redirect(`/dashboard?error=${toQuery(safeErrorMessage(error, "Aufgabe konnte nicht archiviert werden."))}`);
  }

  revalidatePath("/dashboard");
  revalidateDashboardCache(context.companyId);
  redirect(`/dashboard?success=${toQuery("Aufgabe wurde archiviert.")}`);
}
