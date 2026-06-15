import Link from "next/link";
import { ArrowLeft, Check, MapPin, PackageCheck, TriangleAlert, Truck } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import {
  reportMissingBringListItemAction,
  reserveBringListMaterialsAction,
  updateBringListItemPackedAction,
  updateBringListStatusAction
} from "@/lib/actions/bring-list-actions";
import { requireAppContext } from "@/lib/auth";
import { formatQuantity } from "@/lib/inventory";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { BringList, BringListItem, InventoryItem, MaterialAlert, MaterialReservation, PublicInventoryItem } from "@/types/app";

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

  const [listResult, itemsResult, reservationsResult, alertsResult] = await Promise.all([
    supabase
      .from("bring_lists")
      .select("*, jobsites(id, name, customer, address), profiles!bring_lists_assigned_to_fkey(id, full_name, email), vehicles(id, name, license_plate)")
      .eq("id", id)
      .single(),
    supabase.from("bring_list_items").select("*").eq("bring_list_id", id).order("created_at"),
    supabase.from("material_reservations").select("*").eq("bring_list_id", id),
    supabase.from("material_alerts").select("*").eq("bring_list_id", id).eq("status", "open")
  ]);

  const list = listResult.data as BringList | null;
  const items = (itemsResult.data ?? []) as BringListItem[];
  const inventoryIds = [...new Set(items.map((item) => item.inventory_item_id).filter(Boolean))] as string[];
  const inventorySource = context.canManage ? "inventory_items" : "inventory_items_public";
  const { data: inventoryData } =
    inventoryIds.length > 0
      ? await supabase.from(inventorySource).select("*").in("id", inventoryIds)
      : { data: [] };

  const inventoryById = new Map((inventoryData ?? []).map((item) => [item.id as string, item as InventoryItem | PublicInventoryItem]));
  const reservations = (reservationsResult.data ?? []) as MaterialReservation[];
  const alerts = (alertsResult.data ?? []) as MaterialAlert[];
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
      <MessageBox error={error || listResult.error?.message || itemsResult.error?.message} success={success} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/bring-lists" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurueck
        </Link>
        {context.canManage ? (
          <form action={reserveBringListMaterialsAction}>
            <input type="hidden" name="bring_list_id" value={list.id} />
            <button className="btn-primary" type="submit">
              <PackageCheck className="h-4 w-4" aria-hidden="true" />
              Bestand reservieren
            </button>
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
        <p className="mt-4 flex items-start gap-2 rounded-md bg-fog p-3 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden="true" />
          {list.jobsites?.address}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <form action={updateBringListStatusAction}>
            <input type="hidden" name="bring_list_id" value={list.id} />
            <input type="hidden" name="status" value="packed" />
            <button className="btn-secondary" type="submit">
              <Truck className="h-4 w-4" aria-hidden="true" />
              Eingepackt markieren
            </button>
          </form>
          <form action={updateBringListStatusAction}>
            <input type="hidden" name="bring_list_id" value={list.id} />
            <input type="hidden" name="status" value="delivered" />
            <button className="btn-secondary" type="submit">
              Zur Baustelle gebracht
            </button>
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

      <section className="grid gap-3">
        {items.map((item) => {
          const inventory = item.inventory_item_id ? inventoryById.get(item.inventory_item_id) : null;
          const stock = Number(inventory?.stock ?? 0);
          const minimum = Number(inventory?.minimum_stock ?? 0);
          const reserved = item.inventory_item_id ? reservedByInventoryId.get(item.inventory_item_id) ?? 0 : 0;
          const check = statusText({ required: Number(item.quantity), stock, reserved, minimum });
          return (
            <article key={item.id} className="surface p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-black text-ink">{item.custom_item_name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-600">
                    {formatQuantity(item.quantity)} {item.unit} · {item.item_type}
                    {item.storage_location ? ` · ${item.storage_location}` : ""}
                  </p>
                </div>
                <span className={`w-fit rounded-md px-2.5 py-1 text-xs font-black ${check.className}`}>{check.label}</span>
              </div>

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
                  <button className={item.packed ? "btn-secondary" : "btn-primary"} type="submit">
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {item.packed ? "Wieder offen" : "Eingepackt"}
                  </button>
                </form>
                <form action={reportMissingBringListItemAction}>
                  <input type="hidden" name="bring_list_id" value={list.id} />
                  <input type="hidden" name="item_id" value={item.id} />
                  <button className="btn-secondary" type="submit">
                    <TriangleAlert className="h-4 w-4" aria-hidden="true" />
                    Fehlt melden
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </section>
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
