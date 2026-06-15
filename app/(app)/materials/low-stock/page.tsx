import Link from "next/link";
import { AlertTriangle, Boxes, Plus, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { adjustInventoryStockAction } from "@/lib/actions/inventory-actions";
import { requireAppContext } from "@/lib/auth";
import { ensureDefaultInventoryLocations, formatQuantity, isLowStock } from "@/lib/inventory";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { InventoryItem } from "@/types/app";

export default async function LowStockPage({
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
        <PageHeader title="Mindestbestand" description="Material mit Nachbestellbedarf." />
        <MaterialSubnav active="/materials/low-stock" />
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
  await ensureDefaultInventoryLocations(supabase, context.companyId);

  const { data } = await supabase
    .from("inventory_items")
    .select("*, inventory_locations(id, name, location_type), material_categories(id, name, slug)")
    .eq("company_id", context.companyId)
    .order("name", { ascending: true });

  const lowStockItems = ((data ?? []) as InventoryItem[]).filter(isLowStock);

  return (
    <>
      <PageHeader
        title="Mindestbestand"
        description="Alle Artikel, deren Bestand am Lagerort auf oder unter dem Mindestbestand liegt."
        actionHref="/materials/catalog"
        actionLabel="Material suchen"
        actionIcon={Boxes}
      />
      <MaterialSubnav active="/materials/low-stock" />
      <MessageBox error={error} success={success} />

      {lowStockItems.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Alles im gruenen Bereich"
          description="Aktuell liegt kein erfasster Artikel unter seinem Mindestbestand."
          actionHref="/materials/inventory"
          actionLabel="Zum Lager"
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {lowStockItems.map((item) => (
            <article key={item.id} className="surface-strong border-red-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-ink">{item.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {item.inventory_locations?.name ?? "Ohne Lagerort"}
                    {item.material_categories?.name ? ` / ${item.material_categories.name}` : ""}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2.5 py-1 text-xs font-black text-red-700 ring-1 ring-red-200">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  knapp
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-md bg-red-50 p-3">
                  <p className="meta-label text-red-700">Ist</p>
                  <p className="mt-1 text-lg font-black text-red-700">
                    {formatQuantity(item.stock)} {item.unit}
                  </p>
                </div>
                <div className="rounded-md bg-fog p-3">
                  <p className="meta-label">Minimum</p>
                  <p className="mt-1 text-lg font-black text-ink">
                    {formatQuantity(item.minimum_stock)} {item.unit}
                  </p>
                </div>
              </div>

              <form action={adjustInventoryStockAction} className="mt-4 grid grid-cols-[1fr_auto] gap-2">
                <input type="hidden" name="return_to" value="/materials/low-stock" />
                <input type="hidden" name="item_id" value={item.id} />
                <input className="field-input" name="amount" inputMode="decimal" placeholder="Gelieferte Menge" required />
                <button className="btn-primary" type="submit" name="mode" value="increase">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Auffuellen
                </button>
              </form>
            </article>
          ))}
        </div>
      )}

      <div className="mt-5 text-center">
        <Link className="btn-secondary" href="/materials/inventory?low=1">
          Im Lager filtern
        </Link>
      </div>
    </>
  );
}
