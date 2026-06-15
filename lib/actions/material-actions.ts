"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { numberOrZero, optionalNumber, optionalString, requiredString } from "@/lib/utils";
import type { MaterialLocation } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function locationValue(value: FormDataEntryValue | null): MaterialLocation {
  const location = String(value ?? "Lager");
  return location === "Fahrzeug" || location === "Baustelle" ? location : "Lager";
}

export async function createMaterialAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("materials").insert({
    company_id: context.companyId,
    name: requiredString(formData, "name"),
    category: optionalString(formData, "category"),
    unit: requiredString(formData, "unit"),
    stock: numberOrZero(formData, "stock"),
    minimum_stock: numberOrZero(formData, "minimum_stock"),
    location: locationValue(formData.get("location")),
    purchase_price: optionalNumber(formData, "purchase_price"),
    sales_price: optionalNumber(formData, "sales_price"),
    created_by: context.userId
  });

  if (error) {
    redirect(`/material/neu?error=${toQuery(error.message)}`);
  }

  revalidatePath("/material");
  redirect(`/material?success=${toQuery("Material wurde angelegt.")}`);
}

export async function updateMaterialAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");

  const { error } = await supabase
    .from("materials")
    .update({
      name: requiredString(formData, "name"),
      category: optionalString(formData, "category"),
      unit: requiredString(formData, "unit"),
      stock: numberOrZero(formData, "stock"),
      minimum_stock: numberOrZero(formData, "minimum_stock"),
      location: locationValue(formData.get("location")),
      purchase_price: optionalNumber(formData, "purchase_price"),
      sales_price: optionalNumber(formData, "sales_price")
    })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/material/${id}/bearbeiten?error=${toQuery(error.message)}`);
  }

  revalidatePath("/material");
  redirect(`/material?success=${toQuery("Material wurde aktualisiert.")}`);
}

export async function deleteMaterialAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");

  const { error } = await supabase
    .from("materials")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/material?error=${toQuery(error.message)}`);
  }

  revalidatePath("/material");
  redirect(`/material?success=${toQuery("Material wurde geloescht.")}`);
}
