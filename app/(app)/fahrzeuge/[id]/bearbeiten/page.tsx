import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { VehicleForm } from "@/components/forms/vehicle-form";
import {
  addVehicleMaterialAction,
  deleteVehicleAction,
  deleteVehicleMaterialAction,
  updateVehicleAction
} from "@/lib/actions/vehicle-actions";
import { requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Material, Vehicle, VehicleMaterial } from "@/types/app";

export default async function EditVehiclePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);

  const [vehicleResult, materialsResult, vehicleMaterialsResult] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).single(),
    supabase.from("materials").select("*").order("name", { ascending: true }),
    supabase
      .from("vehicle_materials")
      .select("*, materials(id, name, unit)")
      .eq("vehicle_id", id)
      .order("created_at", { ascending: false })
  ]);

  if (!vehicleResult.data) {
    notFound();
  }

  const vehicle = vehicleResult.data as Vehicle;
  const materials = (materialsResult.data ?? []) as Material[];
  const vehicleMaterials = (vehicleMaterialsResult.data ?? []) as VehicleMaterial[];

  return (
    <>
      <PageHeader title="Fahrzeug bearbeiten" description={vehicle.name} />
      <MessageBox error={error} success={success} />
      <VehicleForm action={updateVehicleAction} vehicle={vehicle} submitLabel="Aenderungen speichern" />

      <section className="surface mt-5 p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Fahrzeuglager</h2>
        <form action={addVehicleMaterialAction} className="grid gap-3 md:grid-cols-[1fr_140px_1fr_auto]">
          <input type="hidden" name="vehicle_id" value={vehicle.id} />
          <div>
            <label className="field-label" htmlFor="material_id">
              Material
            </label>
            <select className="field-input" id="material_id" name="material_id" required>
              <option value="">Auswaehlen</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="quantity">
              Menge
            </label>
            <input className="field-input" id="quantity" name="quantity" type="number" step="0.01" defaultValue={1} />
          </div>
          <div>
            <label className="field-label" htmlFor="notes">
              Notiz
            </label>
            <input className="field-input" id="notes" name="notes" />
          </div>
          <div className="flex items-end">
            <SubmitButton>Hinzufügen</SubmitButton>
          </div>
        </form>

        <div className="mt-5 divide-y divide-line rounded-md border border-line">
          {vehicleMaterials.map((entry) => (
            <div key={entry.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-ink">{entry.materials?.name ?? "Material"}</p>
                <p className="text-sm text-slate-600">
                  {entry.quantity} {entry.materials?.unit ?? ""} {entry.notes ? `· ${entry.notes}` : ""}
                </p>
              </div>
              <form action={deleteVehicleMaterialAction}>
                <input type="hidden" name="id" value={entry.id} />
                <input type="hidden" name="vehicle_id" value={vehicle.id} />
                <SubmitButton variant="danger">Entfernen</SubmitButton>
              </form>
            </div>
          ))}
          {vehicleMaterials.length === 0 ? (
            <p className="p-3 text-sm text-slate-600">Noch kein Material im Fahrzeuglager.</p>
          ) : null}
        </div>
      </section>

      <form action={deleteVehicleAction} className="mt-4 flex justify-end">
        <input type="hidden" name="id" value={vehicle.id} />
        <SubmitButton variant="danger">
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Fahrzeug löschen
        </SubmitButton>
      </form>
    </>
  );
}
