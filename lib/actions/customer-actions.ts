"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { requiredFormUuid } from "@/lib/security/form-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString } from "@/lib/utils";
import type { CustomerStatus, CustomerType } from "@/types/app";

function customerTypeValue(value: FormDataEntryValue | null): CustomerType {
  const type = String(value ?? "privatkunde");
  if (type === "gewerbekunde" || type === "hausverwaltung" || type === "architekt" || type === "versicherung") {
    return type;
  }

  return "privatkunde";
}

function customerStatusValue(value: FormDataEntryValue | null): CustomerStatus {
  return String(value ?? "aktiv") === "inaktiv" ? "inaktiv" : "aktiv";
}

function customerPayload(formData: FormData) {
  const company = optionalString(formData, "company");
  const firstName = optionalString(formData, "first_name");
  const lastName = optionalString(formData, "last_name");

  if (!company && !firstName && !lastName) {
    throw new SafeActionError("Bitte Firmenname oder Name des Kunden eintragen.");
  }

  return {
    customer_type: customerTypeValue(formData.get("customer_type")),
    company,
    first_name: firstName,
    last_name: lastName,
    contact_person: optionalString(formData, "contact_person"),
    phone: optionalString(formData, "phone"),
    email: optionalString(formData, "email"),
    billing_address: optionalString(formData, "billing_address"),
    jobsite_address: optionalString(formData, "jobsite_address"),
    notes: optionalString(formData, "notes"),
    tax_id: optionalString(formData, "tax_id"),
    payment_terms: optionalString(formData, "payment_terms"),
    status: customerStatusValue(formData.get("status"))
  };
}

export async function createCustomerAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();

  let payload: ReturnType<typeof customerPayload>;
  try {
    payload = customerPayload(formData);
  } catch (error) {
    redirect(`/customers/new?error=${toQuery(safeErrorMessage(error, "Kunde konnte nicht gespeichert werden."))}`);
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      ...payload,
      company_id: context.companyId,
      created_by: context.userId
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect(`/customers/new?error=${toQuery("Kunde konnte nicht gespeichert werden.")}`);
  }

  revalidatePath("/customers");
  redirect(`/customers/${data.id}?success=${toQuery("Kunde wurde angelegt.")}`);
}

export async function updateCustomerAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Kunde");

  let payload: ReturnType<typeof customerPayload>;
  try {
    payload = customerPayload(formData);
  } catch (error) {
    redirect(`/customers/${id}/edit?error=${toQuery(safeErrorMessage(error, "Kunde konnte nicht gespeichert werden."))}`);
  }

  const { data, error } = await supabase
    .from("customers")
    .update(payload)
    .eq("id", id)
    .eq("company_id", context.companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/customers/${id}/edit?error=${toQuery("Kunde konnte nicht gespeichert werden.")}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?success=${toQuery("Kunde wurde aktualisiert.")}`);
}

export async function updateCustomerStatusAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Kunde");
  const status = customerStatusValue(formData.get("status"));

  const { data, error } = await supabase
    .from("customers")
    .update({ status })
    .eq("id", id)
    .eq("company_id", context.companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/customers/${id}?error=${toQuery("Kundenstatus konnte nicht gespeichert werden.")}`);
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}?success=${toQuery(status === "aktiv" ? "Kunde ist aktiv." : "Kunde wurde inaktiv gesetzt.")}`);
}
