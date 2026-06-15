"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext, requireManager } from "@/lib/auth";
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
  redirect(`/dashboard?success=${toQuery("Aufgabe wurde angelegt.")}`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Aufgabe");

  const { error } = await supabase
    .from("tasks")
    .update({ status: taskStatus(formData.get("status")) })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/dashboard?error=${toQuery("Aufgabe konnte nicht aktualisiert werden.")}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?success=${toQuery("Aufgabe wurde aktualisiert.")}`);
}

export async function deleteTaskAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Aufgabe");

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/dashboard?error=${toQuery("Aufgabe konnte nicht geloescht werden.")}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?success=${toQuery("Aufgabe wurde geloescht.")}`);
}
