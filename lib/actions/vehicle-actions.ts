"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { resourceStatuses } from "@/lib/resources";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { optionalFormUuid, requiredFormUuid } from "@/lib/security/form-data";
import { assertProfilesInCompany, assertVehicleInCompany } from "@/lib/security/tenant-guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { numberOrZero, optionalDate, optionalNumber, optionalString, requiredString } from "@/lib/utils";
import type { PlanningResourceStatus } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function enumValue<T extends readonly [string, ...string[]]>(value: string | null, values: T, fallback: T[number]) {
  if (value && (values as readonly string[]).includes(value)) return value as T[number];
  return fallback;
}

function optionalPositiveInteger(formData: FormData, key: string) {
  const value = optionalNumber(formData, key);
  if (value === null) return null;
  if (!Number.isInteger(value) || value <= 0 || value > 3650) {
    throw new SafeActionError("Wartungsintervall muss eine ganze Zahl zwischen 1 und 3650 Tagen sein.");
  }
  return value;
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function nextMaintenanceDate(formData: FormData) {
  const explicit = optionalDate(formData, "next_maintenance_at");
  if (explicit) return explicit;

  const lastMaintenance = optionalDate(formData, "last_maintenance_at");
  const intervalDays = optionalPositiveInteger(formData, "maintenance_interval_days");
  if (!lastMaintenance || !intervalDays) return null;
  return addDays(lastMaintenance, intervalDays);
}

async function vehicleMetaFromForm({
  formData,
  supabase,
  companyId
}: {
  formData: FormData;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
}) {
  const responsibleEmployeeId = optionalFormUuid(formData, "responsible_employee_id", "verantwortlicher Mitarbeiter");
  if (responsibleEmployeeId) {
    await assertProfilesInCompany({
      supabase,
      companyId,
      profileIds: [responsibleEmployeeId],
      allowedRoles: ["vorarbeiter", "mitarbeiter"]
    });
  }

  return {
    status: enumValue(optionalString(formData, "status"), resourceStatuses, "verfuegbar") as PlanningResourceStatus,
    inspection_due_date: optionalDate(formData, "inspection_due_date"),
    maintenance_interval_days: optionalPositiveInteger(formData, "maintenance_interval_days"),
    last_maintenance_at: optionalDate(formData, "last_maintenance_at"),
    next_maintenance_at: nextMaintenanceDate(formData),
    location_text: optionalString(formData, "location_text"),
    responsible_employee_id: responsibleEmployeeId,
    qr_code: optionalString(formData, "qr_code"),
    nfc_tag_id: optionalString(formData, "nfc_tag_id")
  };
}

export async function createVehicleAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();

  let data: { id: string } | null = null;
  let error: { message?: string } | null = null;

  try {
    const meta = await vehicleMetaFromForm({ formData, supabase, companyId: context.companyId });
    const result = await supabase
      .from("vehicles")
      .insert({
        company_id: context.companyId,
        name: requiredString(formData, "name"),
        license_plate: requiredString(formData, "license_plate"),
        tuv_date: optionalDate(formData, "tuv_date"),
        ...meta,
        notes: optionalString(formData, "notes"),
        created_by: context.userId
      })
      .select("id")
      .maybeSingle();
    data = result.data;
    error = result.error;
  } catch (caught) {
    redirect(`/fahrzeuge/neu?error=${toQuery(safeErrorMessage(caught, "Fahrzeug konnte nicht angelegt werden."))}`);
  }

  if (error || !data) {
    redirect(`/fahrzeuge/neu?error=${toQuery(safeErrorMessage(error, "Fahrzeug konnte nicht angelegt werden."))}`);
  }

  revalidatePath("/fahrzeuge");
  redirect(`/fahrzeuge?success=${toQuery("Fahrzeug wurde angelegt.")}`);
}

export async function updateVehicleAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Fahrzeug");

  let data: { id: string } | null = null;
  let error: { message?: string } | null = null;

  try {
    const meta = await vehicleMetaFromForm({ formData, supabase, companyId: context.companyId });
    const result = await supabase
      .from("vehicles")
      .update({
        name: requiredString(formData, "name"),
        license_plate: requiredString(formData, "license_plate"),
        tuv_date: optionalDate(formData, "tuv_date"),
        ...meta,
        notes: optionalString(formData, "notes")
      })
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    data = result.data;
    error = result.error;
  } catch (caught) {
    redirect(`/fahrzeuge/${id}/bearbeiten?error=${toQuery(safeErrorMessage(caught, "Fahrzeug konnte nicht aktualisiert werden."))}`);
  }

  if (error || !data) {
    redirect(`/fahrzeuge/${id}/bearbeiten?error=${toQuery(safeErrorMessage(error, "Fahrzeug konnte nicht aktualisiert werden."))}`);
  }

  revalidatePath("/fahrzeuge");
  redirect(`/fahrzeuge?success=${toQuery("Fahrzeug wurde aktualisiert.")}`);
}

export async function deleteVehicleAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Fahrzeug");

  const { data, error } = await supabase
    .from("vehicles")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/fahrzeuge?error=${toQuery("Fahrzeug konnte nicht archiviert werden.")}`);
  }

  revalidatePath("/fahrzeuge");
  redirect(`/fahrzeuge?success=${toQuery("Fahrzeug wurde archiviert.")}`);
}

export async function addVehicleMaterialAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const vehicleId = requiredFormUuid(formData, "vehicle_id", "Fahrzeug");
  const materialId = requiredFormUuid(formData, "material_id", "Material");

  try {
    await assertVehicleInCompany({ supabase, companyId: context.companyId, vehicleId });
    const { data: material } = await supabase
      .from("materials")
      .select("id")
      .eq("id", materialId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();
    if (!material) throw new SafeActionError("Material wurde nicht gefunden.");

    const { error } = await supabase.from("vehicle_materials").upsert(
      {
        company_id: context.companyId,
        vehicle_id: vehicleId,
        material_id: materialId,
        quantity: numberOrZero(formData, "quantity"),
        notes: optionalString(formData, "notes"),
        archived_at: null
      },
      { onConflict: "vehicle_id,material_id" }
    );

    if (error) throw new SafeActionError("Fahrzeuglager konnte nicht aktualisiert werden.");
  } catch (error) {
    redirect(`/fahrzeuge/${vehicleId}/bearbeiten?error=${toQuery(safeErrorMessage(error, "Fahrzeuglager konnte nicht aktualisiert werden."))}`);
  }

  revalidatePath(`/fahrzeuge/${vehicleId}/bearbeiten`);
  redirect(`/fahrzeuge/${vehicleId}/bearbeiten?success=${toQuery("Fahrzeuglager wurde aktualisiert.")}`);
}

export async function deleteVehicleMaterialAction(formData: FormData) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Fahrzeugmaterial");
  let vehicleId = requiredFormUuid(formData, "vehicle_id", "Fahrzeug");

  try {
    const { data: vehicleMaterial, error: lookupError } = await supabase
      .from("vehicle_materials")
      .select("id, vehicle_id")
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();

    if (lookupError || !vehicleMaterial) {
      throw new SafeActionError("Material wurde im Fahrzeuglager nicht gefunden.");
    }

    vehicleId = vehicleMaterial.vehicle_id as string;
    const { data, error } = await supabase
      .from("vehicle_materials")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", id)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      throw new SafeActionError("Material konnte nicht archiviert werden.");
    }
  } catch (error) {
    redirect(`/fahrzeuge/${vehicleId}/bearbeiten?error=${toQuery(safeErrorMessage(error, "Material konnte nicht archiviert werden."))}`);
  }

  revalidatePath(`/fahrzeuge/${vehicleId}/bearbeiten`);
  redirect(`/fahrzeuge/${vehicleId}/bearbeiten?success=${toQuery("Material wurde archiviert.")}`);
}
