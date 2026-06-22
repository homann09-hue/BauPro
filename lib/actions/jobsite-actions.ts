"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { requiredFormUuid } from "@/lib/security/form-data";
import { safeReturnPath } from "@/lib/security/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formIds, optionalDate, optionalString, requiredString } from "@/lib/utils";
import type { JobsiteStatus } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function redirectWithMessage(path: string, key: "error" | "success", message: string): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}${key}=${toQuery(message)}`);
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
    return { ids: [] as string[], error: "Mitarbeiter konnten nicht geprueft werden." };
  }

  const ids = (data ?? []).map((profile) => profile.id as string);
  if (ids.length !== requestedIds.length) {
    return { ids: [] as string[], error: "Nur aktive Mitarbeiter oder Vorarbeiter dieser Firma duerfen zugeordnet werden." };
  }

  return { ids, error: null as string | null };
}

export async function createJobsiteAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"), "/baustellen");
  const assignedEmployees = await getAssignableEmployeeIds(supabase, formData, context.companyId);

  if (assignedEmployees.error) {
    redirectWithMessage(returnTo === "/baustellen" ? "/baustellen/neu" : returnTo, "error", assignedEmployees.error);
  }

  const { data, error } = await supabase
    .from("jobsites")
    .insert({
      company_id: context.companyId,
      name: requiredString(formData, "name"),
      customer: requiredString(formData, "customer"),
      address: requiredString(formData, "address"),
      start_date: optionalDate(formData, "start_date"),
      status: statusValue(formData.get("status")),
      notes: optionalString(formData, "notes"),
      assigned_employee_ids: assignedEmployees.ids,
      created_by: context.userId
    })
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirectWithMessage(returnTo === "/baustellen" ? "/baustellen/neu" : returnTo, "error", "Baustelle konnte nicht angelegt werden.");
  }

  revalidatePath("/baustellen");
  revalidatePath("/onboarding");
  redirectWithMessage(returnTo, "success", "Baustelle wurde angelegt.");
}

export async function updateJobsiteAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Baustelle");
  const assignedEmployees = await getAssignableEmployeeIds(supabase, formData, context.companyId);

  if (assignedEmployees.error) {
    redirect(`/baustellen/${id}/bearbeiten?error=${toQuery(assignedEmployees.error)}`);
  }

  const { data, error } = await supabase
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
    .eq("company_id", context.companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/baustellen/${id}/bearbeiten?error=${toQuery("Baustelle konnte nicht aktualisiert werden.")}`);
  }

  revalidatePath("/baustellen");
  redirect(`/baustellen?success=${toQuery("Baustelle wurde aktualisiert.")}`);
}

export async function deleteJobsiteAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Baustelle");

  const { data, error } = await supabase
    .from("jobsites")
    .update({ archived_at: new Date().toISOString(), status: "abgeschlossen" })
    .eq("id", id)
    .eq("company_id", context.companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/baustellen?error=${toQuery("Baustelle konnte nicht archiviert werden.")}`);
  }

  revalidatePath("/baustellen");
  redirect(`/baustellen?success=${toQuery("Baustelle wurde archiviert.")}`);
}
