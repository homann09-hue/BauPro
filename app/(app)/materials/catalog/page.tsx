import Link from "next/link";
import { PackagePlus, Search, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { addCatalogItemToInventoryAction } from "@/lib/actions/inventory-actions";
import { requireAppContext } from "@/lib/auth";
import { ensureDefaultInventoryLocations, formatQuantity } from "@/lib/inventory";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, searchParamMessage } from "@/lib/utils";
import type { InventoryLocation, MaterialCatalogItem, MaterialCategory } from "@/types/app";

function getSearchParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

function matchesSearch(item: MaterialCatalogItem, aliases: string[], search: string) {
  if (!search) return true;
  const haystack = [
    item.name,
    item.manufacturer,
    item.short_description,
    item.typical_use,
    item.package_unit,
    item.unit,
    ...(item.search_terms ?? []),
    ...aliases
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

export default async function MaterialCatalogPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const search = getSearchParam(params, "q");
  const activeCategory = getSearchParam(params, "category");

  if (!context.canManage) {
    return (
      <>
        <PageHeader title="Materialkatalog" description="Praxisnahe Dachdeckerartikel suchen und ins Lager uebernehmen." />
        <MaterialSubnav active="/materials/catalog" />
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

  const [{ data: categoryRows }, { data: aliasRows }] = await Promise.all([
    supabase.from("material_categories").select("*").eq("active", true).order("sort_order", { ascending: true }),
    supabase.from("material_aliases").select("catalog_item_id, alias")
  ]);

  const categories = (categoryRows ?? []) as MaterialCategory[];
  const category = categories.find((item) => item.slug === activeCategory);
  let catalogQuery = supabase
    .from("material_catalog")
    .select("*, material_categories(id, name, slug), material_subcategories(id, name, slug)")
    .eq("active", true)
    .order("popularity", { ascending: false })
    .order("name", { ascending: true })
    .limit(search ? 300 : 80);

  if (category) {
    catalogQuery = catalogQuery.eq("category_id", category.id);
  }

  const { data: catalogRows } = await catalogQuery;
  const aliasesByCatalogId = new Map<string, string[]>();
  for (const row of aliasRows ?? []) {
    const id = String(row.catalog_item_id);
    const list = aliasesByCatalogId.get(id) ?? [];
    list.push(String(row.alias));
    aliasesByCatalogId.set(id, list);
  }

  const catalogItems = ((catalogRows ?? []) as MaterialCatalogItem[]).filter((item) =>
    matchesSearch(item, aliasesByCatalogId.get(item.id) ?? [], search)
  );

  const returnTo = `/materials/catalog?${new URLSearchParams(
    Object.entries({ q: search, category: activeCategory }).filter(([, value]) => value)
  ).toString()}`;

  return (
    <>
      <PageHeader
        title="Materialkatalog"
        description="Typische Lagerartikel fuer deutsche Dachdeckerbetriebe. Suche, waehle Lagerort, setze Startbestand, fertig."
      />
      <MaterialSubnav active="/materials/catalog" />
      <MessageBox error={error} success={success} />

      <form className="surface mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_auto]" action="/materials/catalog">
        <label className="sr-only" htmlFor="catalog-search">
          Material suchen
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="catalog-search"
            className="field-input pl-9"
            name="q"
            defaultValue={search}
            placeholder="Suchen: Dachlatte, Firstrolle, Rinne, Schraube..."
          />
        </div>
        {activeCategory ? <input type="hidden" name="category" value={activeCategory} /> : null}
        <button className="btn-primary w-full sm:w-auto" type="submit">
          <Search className="h-4 w-4" aria-hidden="true" />
          Suchen
        </button>
      </form>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <Link
          href={search ? `/materials/catalog?q=${encodeURIComponent(search)}` : "/materials/catalog"}
          className={cn(
            "whitespace-nowrap rounded-md px-3 py-2 text-sm font-bold shadow-sm",
            !activeCategory ? "bg-ink text-white" : "border border-line bg-white text-ink"
          )}
        >
          Alle
        </Link>
        {categories.map((item) => {
          const href = `/materials/catalog?${new URLSearchParams(
            Object.entries({ q: search, category: item.slug }).filter(([, value]) => value)
          ).toString()}`;
          return (
            <Link
              key={item.id}
              href={href}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-2 text-sm font-bold shadow-sm",
                activeCategory === item.slug ? "bg-ink text-white" : "border border-line bg-white text-ink"
              )}
            >
              {item.name}
            </Link>
          );
        })}
      </div>

      {catalogItems.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Kein Artikel gefunden"
          description="Probiere einen einfacheren Suchbegriff wie Dachlatte, Bitumen, Rinne, Schraube oder Folie."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {catalogItems.map((item) => (
            <article key={item.id} className="surface-strong p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-lg font-black text-ink">{item.name}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {item.material_categories?.name ?? "Dachmaterial"}
                    {item.material_subcategories?.name ? ` / ${item.material_subcategories.name}` : ""}
                  </p>
                </div>
                <span className="inline-flex w-fit rounded-md bg-mint px-2.5 py-1 text-xs font-black text-moss">
                  {item.unit}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                <div className="rounded-md bg-fog p-3">
                  <p className="meta-label">Gebinde</p>
                  <p className="mt-1 font-bold text-ink">{item.package_unit || "Einzel"}</p>
                </div>
                <div className="rounded-md bg-fog p-3">
                  <p className="meta-label">Minimum</p>
                  <p className="mt-1 font-bold text-ink">
                    {formatQuantity(item.default_minimum_stock)} {item.unit}
                  </p>
                </div>
                <div className="rounded-md bg-fog p-3">
                  <p className="meta-label">Hersteller</p>
                  <p className="mt-1 truncate font-bold text-ink">{item.manufacturer || "neutral"}</p>
                </div>
              </div>

              {item.short_description ? (
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.short_description}</p>
              ) : null}
              {item.typical_use ? (
                <p className="mt-2 text-sm font-semibold text-slate-700">Einsatz: {item.typical_use}</p>
              ) : null}

              <form action={addCatalogItemToInventoryAction} className="mt-4 grid gap-2 rounded-lg border border-line bg-white p-3 sm:grid-cols-5">
                <input type="hidden" name="catalog_item_id" value={item.id} />
                <input type="hidden" name="return_to" value={returnTo} />
                <label className="sm:col-span-2">
                  <span className="field-label">Lagerort</span>
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
                  <input className="field-input" name="stock" inputMode="decimal" defaultValue="0" />
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
                <button className="btn-primary self-end" type="submit">
                  <PackagePlus className="h-4 w-4" aria-hidden="true" />
                  Ins Lager
                </button>
              </form>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
