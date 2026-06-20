import Link from "next/link";
import { ArrowLeft, Check, FileDown, MapPin, PackageCheck, PlusCircle, Share2, TriangleAlert, Truck } from "lucide-react";
import { ContextualHelpTip } from "@/components/help/ContextualHelpTip";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import {
  addBringListItemAction,
  reportMissingBringListItemAction,
  reserveBringListMaterialsAction,
  updateBringListItemPackedAction,
  updateBringListStatusAction
} from "@/lib/actions/bring-list-actions";
import { requireAppContext } from "@/lib/auth";
import {
  bringListDetailSelect,
  bringListAuditLogSelect,
  bringListItemWithInventorySelect,
  materialAlertSelect,
  materialReservationSelect
} from "@/lib/data/selects";
import { formatQuantity } from "@/lib/inventory";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { BringList, BringListAuditLog, BringListItem, MaterialAlert, MaterialReservation } from "@/types/app";

const statusLabels = {
  draft: "Entwurf",
  ready: "Bereit",
  packed: "Gepackt",
  delivered: "Geliefert"
};

function statusText({
  required,
  stock,
  reserved,
  minimum
}: {
  required: number;
  stock: number;
  reserved: number;
  minimum: number;
}) {
  const available = Math.max(0, stock - reserved);
  const missing = Math.max(0, required - available);
  if (stock <= 0) return { label: "Fehlt", className: "bg-red-50 text-red-700", available, missing };
  if (missing > 0) return { label: "Knapp", className: "bg-amber-50 text-amber-800", available, missing };
  if (minimum > 0 && available - required < minimum) {
    return { label: "Unter Mindestbestand", className: "bg-amber-50 text-amber-800", available, missing: 0 };
  }
  return { label: "OK", className: "bg-emerald-50 text-emerald-800", available, missing: 0 };
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    auto_synced: "Automatisch aktualisiert",
    created_manual: "Manuell erstellt",
    item_added_manual: "Position ergänzt",
    item_packed: "Position eingepackt",
    item_reopened: "Position wieder offen",
    missing_reported: "Fehlmaterial gemeldet",
    status_changed: "Status geändert"
  };
  return labels[action] ?? action;
}

export default async function BringListDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);

  const [listResult, itemsResult, reservationsResult, alertsResult, auditResult] = await Promise.all([
    supabase
      .from("bring_lists")
      .select(bringListDetailSelect)
      .eq("company_id", context.companyId)
      .eq("id", id)
      .single(),
    supabase.from("bring_list_items").select(bringListItemWithInventorySelect).eq("bring_list_id", id).order("created_at"),
    supabase
      .from("material_reservations")
      .select(materialReservationSelect)
      .eq("company_id", context.companyId)
      .eq("bring_list_id", id),
    supabase
      .from("material_alerts")
      .select(materialAlertSelect)
      .eq("company_id", context.companyId)
      .eq("bring_list_id", id)
      .eq("status", "open"),
    supabase
      .from("bring_list_audit_log")
      .select(bringListAuditLogSelect)
      .eq("company_id", context.companyId)
      .eq("bring_list_id", id)
      .order("created_at", { ascending: false })
      .limit(8)
  ]);

  const list = listResult.data as BringList | null;
  const items = (itemsResult.data ?? []) as unknown as BringListItem[];
  const reservations = (reservationsResult.data ?? []) as unknown as MaterialReservation[];
  const alerts = (alertsResult.data ?? []) as unknown as MaterialAlert[];
  const auditLog = (auditResult.data ?? []) as unknown as BringListAuditLog[];
  const reservedByInventoryId = new Map<string, number>();
  for (const reservation of reservations) {
    if (!reservation.inventory_item_id || !["open", "reserved", "partially_reserved"].includes(reservation.status)) continue;
    reservedByInventoryId.set(
      reservation.inventory_item_id,
      (reservedByInventoryId.get(reservation.inventory_item_id) ?? 0) + Number(reservation.quantity_reserved)
    );
  }

  if (!list) {
    return (
      <>
        <PageHeader title="Mitbringliste" />
        <MessageBox error="Mitbringliste wurde nicht gefunden." />
      </>
    );
  }

  const packedCount = items.filter((item) => item.packed).length;

  return (
    <>
      <PageHeader title={list.title} description={`${formatDate(list.date)} · ${list.jobsites?.name ?? "Baustelle"}`} />
      <MessageBox
        error={error || safeQueryErrorMessage(listResult.error) || safeQueryErrorMessage(itemsResult.error)}
        success={success}
      />
      <ContextualHelpTip featureKey="inventory_availability" returnTo={`/bring-lists/${list.id}`} />
      {context.canManage ? <ContextualHelpTip featureKey="material_reservation" returnTo={`/bring-lists/${list.id}`} /> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/bring-lists" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
        <Link href={`/bring-lists/${list.id}/pdf`} className="btn-secondary" target="_blank">
          <FileDown className="h-4 w-4" aria-hidden="true" />
          PDF
        </Link>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`${list.title} für ${formatDate(list.date)}: ${items.length} Positionen prüfen und mitnehmen.`)}`}
          className="btn-secondary"
          target="_blank"
          rel="noreferrer"
        >
          <Share2 className="h-4 w-4" aria-hidden="true" />
          Teilen
        </a>
        {context.canManage ? (
          <form action={reserveBringListMaterialsAction}>
            <input type="hidden" name="bring_list_id" value={list.id} />
            <SubmitButton pendingLabel="Reserviere...">
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              Bestand reservieren
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <section className="surface mb-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <p className="meta-label">Status</p>
            <div className="mt-1">
              <StatusBadge value={list.status} label={statusLabels[list.status]} />
            </div>
          </div>
          <div>
            <p className="meta-label">Gepackt</p>
            <p className="mt-1 font-black text-ink">
              {packedCount} / {items.length}
            </p>
          </div>
          <div>
            <p className="meta-label">Mitarbeiter</p>
            <p className="mt-1 font-black text-ink">{list.profiles?.full_name || list.profiles?.email || "Nicht zugewiesen"}</p>
          </div>
          <div>
            <p className="meta-label">Fahrzeug</p>
            <p className="mt-1 font-black text-ink">{list.vehicles?.name || "Kein Fahrzeug"}</p>
          </div>
        </div>
        {list.auto_generated ? (
          <p className="mt-4 rounded-md bg-mint p-3 text-sm font-semibold text-moss">
            Automatisch vorbereitet aus Auftrag, Materialplanung, Lager und Plantafel.
            {list.last_auto_synced_at ? ` Zuletzt synchronisiert: ${formatDate(list.last_auto_synced_at)}.` : ""}
          </p>
        ) : null}
        <p className="mt-4 flex items-start gap-2 rounded-md bg-fog p-3 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden="true" />
          {list.jobsites?.address}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={updateBringListStatusAction}>
            <input type="hidden" name="bring_list_id" value={list.id} />
            <input type="hidden" name="status" value="packed" />
            <SubmitButton variant="secondary" pendingLabel="Wird markiert...">
              <Truck className="h-4 w-4" aria-hidden="true" />
              Eingepackt markieren
            </SubmitButton>
          </form>
          <form action={updateBringListStatusAction}>
            <input type="hidden" name="bring_list_id" value={list.id} />
            <input type="hidden" name="status" value="delivered" />
            <SubmitButton variant="secondary" pendingLabel="Wird gespeichert...">
              Zur Baustelle gebracht
            </SubmitButton>
          </form>
        </div>
      </section>

      {alerts.length > 0 ? (
        <section className="mb-5 grid gap-2">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{alert.message}</span>
            </div>
          ))}
        </section>
      ) : null}

      <section className="surface mb-5 p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-moss" aria-hidden="true" />
          <h2 className="text-lg font-black text-ink">Manuell ergaenzen</h2>
        </div>
        <form action={addBringListItemAction} className="grid gap-3 lg:grid-cols-[1.4fr_0.5fr_0.6fr_0.8fr_auto] lg:items-end">
          <input type="hidden" name="bring_list_id" value={list.id} />
          <input type="hidden" name="return_to" value={`/bring-lists/${list.id}`} />
          <label className="block">
            <span className="field-label">Material/Werkzeug</span>
            <input className="field-input min-h-14 text-base" name="item_name" placeholder="z. B. 2 Kartuschen Dichtstoff" required />
          </label>
          <label className="block">
            <span className="field-label">Menge</span>
            <input className="field-input min-h-14 text-base" name="item_quantity" type="number" min="0.01" step="0.01" defaultValue="1" required />
          </label>
          <label className="block">
            <span className="field-label">Einheit</span>
            <input className="field-input min-h-14 text-base" name="item_unit" defaultValue="Stück" required />
          </label>
          <label className="block">
            <span className="field-label">Art</span>
            <select className="field-input min-h-14 text-base" name="item_type" defaultValue="material">
              <option value="material">Material</option>
              <option value="tool">Werkzeug</option>
              <option value="safety">PSA</option>
              <option value="document">Dokument</option>
              <option value="other">Sonstiges</option>
            </select>
          </label>
          <SubmitButton className="min-h-14" pendingLabel="Wird ergänzt...">
            Ergaenzen
          </SubmitButton>
        </form>
      </section>

      <section className="grid gap-3">
        {items.map((item) => {
          const inventory = item.inventory_items ?? null;
          const stock = Number(inventory?.stock ?? 0);
          const minimum = Number(inventory?.minimum_stock ?? 0);
          const reserved = item.inventory_item_id ? reservedByInventoryId.get(item.inventory_item_id) ?? 0 : 0;
          const check = statusText({ required: Number(item.quantity), stock, reserved, minimum });
          const locationVehicleId = inventory?.inventory_locations?.vehicle_id ?? null;
          const wrongVehicle = Boolean(list.vehicle_id && locationVehicleId && locationVehicleId !== list.vehicle_id);
          const requiredVehicleMismatch = Boolean(item.required_vehicle_id && list.vehicle_id && item.required_vehicle_id !== list.vehicle_id);
          const defectHint = /defekt|werkstatt/i.test(item.notes ?? "");
          return (
            <article key={item.id} className="surface p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-black text-ink">{item.custom_item_name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {formatQuantity(item.quantity)} {item.unit} · {item.item_type}
                    {item.storage_location ? ` · ${item.storage_location}` : ""}
                  </p>
                  <p className="mt-2 inline-flex rounded-md bg-fog px-2 py-1 text-xs font-black text-slate-600">
                    {item.auto_generated ? "Automatisch" : "Manuell"}
                  </p>
                </div>
                <span className={`w-fit rounded-md px-2.5 py-1 text-xs font-black ${check.className}`}>{check.label}</span>
              </div>

              {wrongVehicle || requiredVehicleMismatch || defectHint ? (
                <div className="mt-4 grid gap-2">
                  {wrongVehicle ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                      Hinweis: liegt laut Lager im Fahrzeug/Lager „{inventory?.inventory_locations?.name ?? "anderer Ort"}“.
                    </p>
                  ) : null}
                  {requiredVehicleMismatch ? (
                    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                      Hinweis: Plantafel erwartet ein anderes Fahrzeug für diese Position.
                    </p>
                  ) : null}
                  {defectHint ? (
                    <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{item.notes}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <Metric label="Benoetigt" value={`${formatQuantity(item.quantity)} ${item.unit}`} />
                <Metric label="Verfuegbar" value={inventory ? `${formatQuantity(check.available)} ${item.unit}` : "-"} />
                <Metric label="Reserviert" value={`${formatQuantity(reserved)} ${item.unit}`} />
                <Metric label="Fehlt" value={`${formatQuantity(check.missing)} ${item.unit}`} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <form action={updateBringListItemPackedAction}>
                  <input type="hidden" name="bring_list_id" value={list.id} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <input type="hidden" name="packed" value={item.packed ? "false" : "true"} />
                  <SubmitButton variant={item.packed ? "secondary" : "primary"} pendingLabel={item.packed ? "Wird geöffnet..." : "Wird eingepackt..."}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {item.packed ? "Wieder offen" : "Eingepackt"}
                  </SubmitButton>
                </form>
                <form action={reportMissingBringListItemAction}>
                  <input type="hidden" name="bring_list_id" value={list.id} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <SubmitButton variant="secondary" pendingLabel="Wird gemeldet...">
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                    Fehlt melden
                  </SubmitButton>
                </form>
              </div>
            </article>
          );
        })}
      </section>

      {auditLog.length > 0 ? (
        <section className="surface mt-5 p-4 sm:p-5">
          <h2 className="text-lg font-black text-ink">Aenderungsverlauf</h2>
          <div className="mt-4 grid gap-2">
            {auditLog.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1 rounded-md bg-fog p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                <span className="font-black text-ink">{auditLabel(entry.action)}</span>
                <span className="font-semibold text-slate-600">
                  {entry.profiles?.full_name || entry.profiles?.email || "System"} · {formatDate(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-fog p-3">
      <p className="meta-label">{label}</p>
      <p className="mt-1 font-black text-ink">{value}</p>
    </div>
  );
}
