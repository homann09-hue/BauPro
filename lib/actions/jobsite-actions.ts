"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formIds, optionalDate, optionalString, requiredString } from "@/lib/utils";
import type { JobsiteStatus } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function statusValue(value: FormDataEntryValue | null): JobsiteStatus {
  const status = String(value ?? "geplant");
  return status === "aktiv" || status === "abgeschlossen" ? status : "geplant";
}

async function getAssignableEmployeeIds(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  formData: FormData,
  companyId: string
) {
  const requestedIds = [...new Set(formIds(formData, "assigned_employee_ids"))];

  if (requestedIds.length === 0) {
    return { ids: [] as string[], error: null as string | null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("company_id", companyId)
    .eq("active", true)
    .in("role", ["mitarbeiter", "vorarbeiter"])
    .in("id", requestedIds);

  if (error) {
    return { ids: [] as string[], error: error.message };
  }

  return { ids: (data ?? []).map((profile) => profile.id as string), error: null as string | null };
}

export async function createJobsiteAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const assignedEmployees = await getAssignableEmployeeIds(supabase, formData, context.companyId);

  if (assignedEmployees.error) {
    redirect(`/baustellen/neu?error=${toQuery(assignedEmployees.error)}`);
  }

  const { error } = await supabase.from("jobsites").insert({
    company_id: context.companyId,
    name: requiredString(formData, "name"),
    customer: requiredString(formData, "customer"),
    address: requiredString(formData, "address"),
    start_date: optionalDate(formData, "start_date"),
    status: statusValue(formData.get("status")),
    notes: optionalString(formData, "notes"),
    assigned_employee_ids: assignedEmployees.ids,
    created_by: context.userId
  });

  if (error) {
    redirect(`/baustellen/neu?error=${toQuery(error.message)}`);
  }

  revalidatePath("/baustellen");
  redirect(`/baustellen?success=${toQuery("Baustelle wurde angelegt.")}`);
}

export async function updateJobsiteAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");
  const assignedEmployees = await getAssignableEmployeeIds(supabase, formData, context.companyId);

  if (assignedEmployees.error) {
    redirect(`/baustellen/${id}/bearbeiten?error=${toQuery(assignedEmployees.error)}`);
  }

  const { error } = await supabase
    .from("jobsites")
    .update({
      name: requiredString(formData, "name"),
      customer: requiredString(formData, "customer"),
      address: requiredString(formData, "address"),
      start_date: optionalDate(formData, "start_date"),
      status: statusValue(formData.get("status")),
      notes: optionalString(formData, "notes"),
      assigned_employee_ids: assignedEmployees.ids
    })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/baustellen/${id}/bearbeiten?error=${toQuery(error.message)}`);
  }

  revalidatePath("/baustellen");
  redirect(`/baustellen?success=${toQuery("Baustelle wurde aktualisiert.")}`);
}

export async function deleteJobsiteAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");

  const { error } = await supabase
    .from("jobsites")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/baustellen?error=${toQuery(error.message)}`);
  }

  revalidatePath("/baustellen");
  redirect(`/baustellen?success=${toQuery("Baustelle wurde geloescht.")}`);
}
