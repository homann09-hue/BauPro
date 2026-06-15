import Link from "next/link";
import { PackagePlus, Search, Upload, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { addCatalogItemToInventoryAction } from "@/lib/actions/inventory-actions";
import { requireAppContext } from "@/lib/auth";
import { ensureDefaultInventoryLocations, formatQuantity } from "@/lib/inventory";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { InventoryLocation, MaterialCatalogItem } from "@/types/app";

function getSearchParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

function matchesSearch(item: MaterialCatalogItem, search: string) {
  if (!search) return true;
  return [item.name, item.manufacturer, item.short_description, item.typical_use, ...(item.search_terms ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(search.toLowerCase());
}

export default async function MaterialImportPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const search = getSearchParam(params, "q");

  if (!context.canManage) {
    return (
      <>
        <PageHeader title="Schnellerfassung" description="Startbestand aus dem Katalog aufnehmen." />
        <MaterialSubnav active="/materials/import" />
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

  const { data } = await supabase
    .from("material_catalog")
    .select("*, material_categories(id, name, slug), material_subcategories(id, name, slug)")
    .eq("active", true)
    .order("popularity", { ascending: false })
    .order("name", { ascending: true })
    .limit(search ? 180 : 36);

  const catalogItems = ((data ?? []) as MaterialCatalogItem[]).filter((item) => matchesSearch(item, search));
  const returnTo = search ? `/materials/import?q=${encodeURIComponent(search)}` : "/materials/import";

  return (
    <>
      <PageHeader
        title="Schnellerfassung"
        description="Die haeufigsten Dachdeckerartikel mit Lagerort, Mindestbestand und Startmenge aufnehmen."
        actionHref="/materials/catalog"
        actionLabel="Ganzer Katalog"
        actionIcon={Search}
      />
      <MaterialSubnav active="/materials/import" />
      <MessageBox error={error} success={success} />

      <form className="surface mb-5 grid gap-3 p-3 sm:grid-cols-[1fr_auto]" action="/materials/import">
        <label className="sr-only" htmlFor="import-search">
          Material suchen
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="import-search"
            className="field-input pl-9"
            name="q"
            defaultValue={search}
            placeholder="Startbestand suchen..."
          />
        </div>
        <button className="btn-primary" type="submit">
          <Search className="h-4 w-4" aria-hidden="true" />
          Suchen
        </button>
      </form>

      {catalogItems.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="Kein Material gefunden"
          description="Nutze den Katalog fuer eine breitere Suche."
          actionHref="/materials/catalog"
          actionLabel="Katalog oeffnen"
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {catalogItems.map((item) => (
            <article key={item.id} className="surface-strong p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-ink">{item.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {item.material_categories?.name ?? "Dachmaterial"}
                    {item.package_unit ? ` / ${item.package_unit}` : ""}
                  </p>
                </div>
                <span className="rounded-md bg-mint px-2.5 py-1 text-xs font-black text-moss">{item.unit}</span>
              </div>

              <form action={addCatalogItemToInventoryAction} className="mt-4 grid gap-2 sm:grid-cols-6">
                <input type="hidden" name="catalog_item_id" value={item.id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <label className="sm:col-span-2">
                  <span className="field-label">Ort</span>
                  <select className="field-input" name="location_id" required>
                    {locations.map((location: InventoryLocation) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">Bestand</span>
                  <input className="field-input" name="stock" inputMode="decimal" placeholder="0" />
                </label>
                <label>
                  <span className="field-label">Minimum</span>
                  <input
                    className="field-input"
                    name="minimum_stock"
                    inputMode="decimal"
                    defaultValue={String(item.default_minimum_stock ?? 0)}
                  />
                </label>
                <label>
                  <span className="field-label">EK</span>
                  <input className="field-input" name="purchase_price" inputMode="decimal" placeholder="optional" />
                </label>
                <label>
                  <span className="field-label">Lieferant</span>
                  <input className="field-input" name="supplier_name" placeholder="optional" />
                </label>
                <button className="btn-primary sm:col-span-6" type="submit">
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  Aufnehmen
                </button>
              </form>

              <p className="mt-3 text-xs font-semibold text-slate-500">
                Standard-Minimum: {formatQuantity(item.default_minimum_stock)} {item.unit}
              </p>
            </article>
          ))}
        </div>
      )}

      <div className="mt-5 text-center">
        <Link className="btn-secondary" href="/materials/inventory">
          Zum Lagerbestand
        </Link>
      </div>
    </>
  );
}
