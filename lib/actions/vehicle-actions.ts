"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { numberOrZero, optionalDate, optionalString, requiredString } from "@/lib/utils";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

export async function createVehicleAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.from("vehicles").insert({
    company_id: context.companyId,
    name: requiredString(formData, "name"),
    license_plate: requiredString(formData, "license_plate"),
    tuv_date: optionalDate(formData, "tuv_date"),
    notes: optionalString(formData, "notes"),
    created_by: context.userId
  });

  if (error) {
    redirect(`/fahrzeuge/neu?error=${toQuery(error.message)}`);
  }

  revalidatePath("/fahrzeuge");
  redirect(`/fahrzeuge?success=${toQuery("Fahrzeug wurde angelegt.")}`);
}

export async function updateVehicleAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");

  const { error } = await supabase
    .from("vehicles")
    .update({
      name: requiredString(formData, "name"),
      license_plate: requiredString(formData, "license_plate"),
      tuv_date: optionalDate(formData, "tuv_date"),
      notes: optionalString(formData, "notes")
    })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/fahrzeuge/${id}/bearbeiten?error=${toQuery(error.message)}`);
  }

  revalidatePath("/fahrzeuge");
  redirect(`/fahrzeuge?success=${toQuery("Fahrzeug wurde aktualisiert.")}`);
}

export async function deleteVehicleAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");

  const { error } = await supabase
    .from("vehicles")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/fahrzeuge?error=${toQuery(error.message)}`);
  }

  revalidatePath("/fahrzeuge");
  redirect(`/fahrzeuge?success=${toQuery("Fahrzeug wurde geloescht.")}`);
}

export async function addVehicleMaterialAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const vehicleId = requiredString(formData, "vehicle_id");
  const materialId = requiredString(formData, "material_id");

  const { error } = await supabase.from("vehicle_materials").upsert(
    {
      company_id: context.companyId,
      vehicle_id: vehicleId,
      material_id: materialId,
      quantity: numberOrZero(formData, "quantity"),
      notes: optionalString(formData, "notes")
    },
    { onConflict: "vehicle_id,material_id" }
  );

  if (error) {
    redirect(`/fahrzeuge/${vehicleId}/bearbeiten?error=${toQuery(error.message)}`);
  }

  revalidatePath(`/fahrzeuge/${vehicleId}/bearbeiten`);
  redirect(`/fahrzeuge/${vehicleId}/bearbeiten?success=${toQuery("Fahrzeuglager wurde aktualisiert.")}`);
}

export async function deleteVehicleMaterialAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredString(formData, "id");
  const vehicleId = requiredString(formData, "vehicle_id");

  const { error } = await supabase
    .from("vehicle_materials")
    .delete()
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/fahrzeuge/${vehicleId}/bearbeiten?error=${toQuery(error.message)}`);
  }

  revalidatePath(`/fahrzeuge/${vehicleId}/bearbeiten`);
  redirect(`/fahrzeuge/${vehicleId}/bearbeiten?success=${toQuery("Material wurde entfernt.")}`);
}
