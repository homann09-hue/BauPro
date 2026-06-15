import { MapPin, Plus, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import {
  createInventoryLocationAction,
  deactivateInventoryLocationAction,
  updateInventoryLocationAction
} from "@/lib/actions/inventory-actions";
import { requireAppContext } from "@/lib/auth";
import { ensureDefaultInventoryLocations, inventoryLocationTypes } from "@/lib/inventory";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { InventoryLocation } from "@/types/app";

export default async function InventoryLocationsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);

  if (!context.canManage) {
    return (
      <>
        <PageHeader title="Lagerorte" description="Hauptlager, Fahrzeug, Baustelle, Container und Werkstatt." />
        <MaterialSubnav active="/materials/locations" />
        <MessageBox error={error} success={success} />
        <EmptyState
          icon={TriangleAlert}
          title="Kein Zugriff"
          description="Material und Lager werden von Admin oder Chef verwaltet."
        />
      </>
    );
  }

  const supabase = await createSupabaseServerClient();
  const locations = await ensureDefaultInventoryLocations(supabase, context.companyId);

  return (
    <>
      <PageHeader
        title="Lagerorte"
        description="Lege einfache Orte an, die ein Team sofort versteht: Hauptlager, Fahrzeug, Baustelle, Container oder Werkstatt."
      />
      <MaterialSubnav active="/materials/locations" />
      <MessageBox error={error} success={success} />

      <section className="surface mb-5 p-4">
        <h2 className="section-title">Neuen Lagerort anlegen</h2>
        <form action={createInventoryLocationAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_1fr_auto]">
          <input type="hidden" name="return_to" value="/materials/locations" />
          <label>
            <span className="field-label">Name</span>
            <input className="field-input" name="name" placeholder="z. B. Sprinter B-AP 1234" required />
          </label>
          <label>
            <span className="field-label">Art</span>
            <select className="field-input" name="location_type" defaultValue="Fahrzeuglager">
              {inventoryLocationTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Notiz</span>
            <input className="field-input" name="notes" placeholder="optional" />
          </label>
          <button className="btn-primary self-end" type="submit">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Anlegen
          </button>
        </form>
      </section>

      {locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Keine Lagerorte"
          description="Lege mindestens ein Hauptlager oder Fahrzeuglager an."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {locations.map((location: InventoryLocation) => (
            <article key={location.id} className="surface-strong p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-ink">{location.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{location.location_type}</p>
                </div>
                <span className="rounded-md bg-mint px-2.5 py-1 text-xs font-black text-moss">aktiv</span>
              </div>

              <form action={updateInventoryLocationAction} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="return_to" value="/materials/locations" />
                <input type="hidden" name="location_id" value={location.id} />
                <input type="hidden" name="active" value="true" />
                <label>
                  <span className="field-label">Name</span>
                  <input className="field-input" name="name" defaultValue={location.name} required />
                </label>
                <label>
                  <span className="field-label">Art</span>
                  <select className="field-input" name="location_type" defaultValue={location.location_type}>
                    {inventoryLocationTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="field-label">Notiz</span>
                  <input className="field-input" name="notes" defaultValue={location.notes ?? ""} />
                </label>
                <button className="btn-secondary sm:col-span-2" type="submit">
                  Speichern
                </button>
              </form>

              <form action={deactivateInventoryLocationAction} className="mt-2">
                <input type="hidden" name="return_to" value="/materials/locations" />
                <input type="hidden" name="location_id" value={location.id} />
                <button className="btn-danger w-full" type="submit">
                  Deaktivieren
                </button>
              </form>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
