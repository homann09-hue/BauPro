"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext, requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalDate, optionalString, requiredString } from "@/lib/utils";
import type { TaskStatus } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function taskStatus(value: FormDataEntryValue | null): TaskStatus {
  const status = String(value ?? "offen");
  return status === "in_arbeit" || status === "erledigt" ? status : "offen";
}

export async function createTaskAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("tasks").insert({
    company_id: context.companyId,
    jobsite_id: optionalString(formData, "jobsite_id"),
    title: requiredString(formData, "title"),
    description: optionalString(formData, "description"),
    assigned_to: optionalString(formData, "assigned_to"),
    due_date: optionalDate(formData, "due_date"),
    status: taskStatus(formData.get("status")),
    created_by: context.userId
  });

  if (error) {
    redirect(`/dashboard?error=${toQuery(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?success=${toQuery("Aufgabe wurde angelegt.")}`);
}

export async function updateTaskStatusAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");

  const { error } = await supabase
    .from("tasks")
    .update({ status: taskStatus(formData.get("status")) })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/dashboard?error=${toQuery(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?success=${toQuery("Aufgabe wurde aktualisiert.")}`);
}

export async function deleteTaskAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/dashboard?error=${toQuery(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard?success=${toQuery("Aufgabe wurde geloescht.")}`);
}
