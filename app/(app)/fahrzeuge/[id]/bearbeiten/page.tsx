import { notFound } from "next/navigation";
import Link from "next/link";
import { Download, FileText, Trash2, Upload } from "lucide-react";
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
import { archiveResourceDocumentAction, uploadResourceDocumentAction } from "@/lib/actions/planning-actions";
import { requireManager } from "@/lib/auth";
import { legacyMaterialVehicleSelect, profileOptionSelect, resourceDocumentSelect, vehicleMaterialSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Material, Profile, ResourceDocument, Vehicle, VehicleMaterial } from "@/types/app";

export default async function EditVehiclePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);

  const [vehicleResult, materialsResult, vehicleMaterialsResult, employeesResult, documentsResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select(vehicleOptionSelect)
      .eq("company_id", context.companyId)
      .eq("id", id)
      .is("archived_at", null)
      .single(),
    supabase
      .from("materials")
      .select(legacyMaterialVehicleSelect)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .order("name", { ascending: true }),
    supabase
      .from("vehicle_materials")
      .select(vehicleMaterialSelect)
      .eq("vehicle_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select(profileOptionSelect)
      .eq("company_id", context.companyId)
      .eq("active", true)
      .in("role", ["vorarbeiter", "mitarbeiter"])
      .order("full_name", { ascending: true }),
    supabase
      .from("resource_documents")
      .select(resourceDocumentSelect)
      .eq("company_id", context.companyId)
      .eq("vehicle_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
  ]);

  if (!vehicleResult.data) {
    notFound();
  }

  const vehicle = vehicleResult.data as Vehicle;
  const materials = (materialsResult.data ?? []) as Material[];
  const vehicleMaterials = (vehicleMaterialsResult.data ?? []) as unknown as VehicleMaterial[];
  const employees = (employeesResult.data ?? []) as Profile[];
  const documents = (documentsResult.data ?? []) as ResourceDocument[];
  const returnTo = `/fahrzeuge/${vehicle.id}/bearbeiten`;

  return (
    <>
      <PageHeader title="Fahrzeug bearbeiten" description={vehicle.name} />
      <MessageBox error={error} success={success} />
      <VehicleForm action={updateVehicleAction} vehicle={vehicle} employees={employees} submitLabel="Änderungen speichern" />

      <section className="surface mt-5 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-ink">Fotos & Dokumente</h2>
            <p className="text-sm text-slate-500">Prüfberichte, Wartungsnachweise oder Fahrzeugfotos sicher am Fahrzeug speichern.</p>
          </div>
        </div>
        <form action={uploadResourceDocumentAction} className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto]">
          <input type="hidden" name="target_type" value="vehicle" />
          <input type="hidden" name="target_id" value={vehicle.id} />
          <input type="hidden" name="return_to" value={returnTo} />
          <div>
            <label className="field-label" htmlFor="document_type">
              Typ
            </label>
            <select className="field-input" id="document_type" name="document_type" defaultValue="dokument">
              <option value="foto">Foto</option>
              <option value="dokument">Dokument</option>
              <option value="pruefung">Prüfung</option>
              <option value="wartung">Wartung</option>
              <option value="sonstiges">Sonstiges</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="title">
              Titel
            </label>
            <input className="field-input" id="title" name="title" placeholder="z. B. UVV Prüfung 2026" />
          </div>
          <div>
            <label className="field-label" htmlFor="document">
              Datei
            </label>
            <input className="field-input" id="document" name="document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
          </div>
          <div className="flex items-end">
            <SubmitButton>
              <Upload className="h-4 w-4" aria-hidden="true" />
              Hochladen
            </SubmitButton>
          </div>
        </form>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {documents.map((document) => (
            <article key={document.id} className="rounded-lg border border-line bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-ink">{document.title}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {document.document_type} · {formatDate(document.created_at.slice(0, 10))}
                  </p>
                </div>
                <FileText className="h-5 w-5 text-moss" aria-hidden="true" />
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Link href={`/fahrzeuge/documents/${document.id}`} className="btn-secondary flex-1">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Öffnen
                </Link>
                <form action={archiveResourceDocumentAction} className="flex-1">
                  <input type="hidden" name="document_id" value={document.id} />
                  <input type="hidden" name="return_to" value={returnTo} />
                  <SubmitButton variant="secondary" className="w-full">
                    Archivieren
                  </SubmitButton>
                </form>
              </div>
            </article>
          ))}
          {documents.length === 0 ? (
            <p className="rounded-md border border-dashed border-line bg-fog p-4 text-sm font-semibold text-slate-500">
              Noch keine Dateien am Fahrzeug gespeichert.
            </p>
          ) : null}
        </div>
      </section>

      <section className="surface mt-5 p-4 sm:p-5">
        <h2 className="mb-4 text-lg font-semibold text-ink">Fahrzeuglager</h2>
        <form action={addVehicleMaterialAction} className="grid gap-3 md:grid-cols-[1fr_140px_1fr_auto]">
          <input type="hidden" name="vehicle_id" value={vehicle.id} />
          <div>
            <label className="field-label" htmlFor="material_id">
              Material
            </label>
            <select className="field-input" id="material_id" name="material_id" required>
              <option value="">Auswählen</option>
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
                <SubmitButton variant="danger">Archivieren</SubmitButton>
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
          Fahrzeug archivieren
        </SubmitButton>
      </form>
    </>
  );
}
