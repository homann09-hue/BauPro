import Link from "next/link";
import {
  AlertTriangle,
  ArrowRightLeft,
  Boxes,
  ClipboardList,
  Minus,
  PackagePlus,
  Plus,
  Search,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { InventoryActivityPanels } from "@/components/materials/inventory-activity-panels";
import { InventoryLowStockLink } from "@/components/materials/inventory-low-stock-link";
import { JobsiteSelectField } from "@/components/materials/jobsite-select-field";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { SupplierSelectField } from "@/components/materials/supplier-select-field";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import {
  adjustInventoryStockAction,
  createCustomInventoryItemAction,
  reportMaterialUsageAction,
  reserveMaterialForJobsiteAction,
  transferInventoryAction,
  updateInventoryPricingAction
} from "@/lib/actions/inventory-actions";
import { requireAppContext } from "@/lib/auth";
import { searchOrFilter } from "@/lib/data/shared";
import { ensureDefaultInventoryLocations, formatQuantity, isLowStock } from "@/lib/inventory";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, formatMoney, searchParamMessage } from "@/lib/utils";
import type {
  InventoryItem,
  InventoryLocation,
  PublicInventoryItem,
} from "@/types/app";

type InventoryListItem = InventoryItem | PublicInventoryItem;
const pageSize = 24;
const lowStockScanLimit = 300;

function getSearchParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

function getPageParam(params: Record<string, string | string[] | undefined>) {
  const parsed = Number(getSearchParam(params, "page"));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

function inventoryHref({
  q,
  location,
  low,
  page
}: {
  q?: string;
  location?: string;
  low?: boolean;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (location) params.set("location", location);
  if (low) params.set("low", "1");
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/materials/inventory?${query}` : "/materials/inventory";
}

function isPublicInventoryItem(item: InventoryListItem): item is PublicInventoryItem {
  return "location_name" in item;
}

function itemCategoryName(item: InventoryListItem) {
  return isPublicInventoryItem(item) ? item.category_name : item.material_categories?.name ?? null;
}

function itemLocationName(item: InventoryListItem) {
  return isPublicInventoryItem(item) ? item.location_name : item.inventory_locations?.name ?? null;
}

export default async function InventoryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const search = getSearchParam(params, "q");
  const activeLocation = getSearchParam(params, "location");
  const onlyLowStock = getSearchParam(params, "low") === "1";
  const page = onlyLowStock ? 1 : getPageParam(params);
  const from = (page - 1) * pageSize;

  const supabase = await createSupabaseServerClient();
  const locationsPromise = context.canManage ? ensureDefaultInventoryLocations(supabase, context.companyId) : Promise.resolve([]);
  const managerSelect =
    "id, company_id, catalog_item_id, category_id, subcategory_id, location_id, supplier_id, name, unit, stock, minimum_stock, package_unit, manufacturer, article_number, purchase_price, sales_price, markup_percent, sales_unit, price_per_unit, notes, created_by, inventory_locations(id, name, location_type), material_categories(id, name, slug), material_subcategories(id, name, slug)";
  const publicSelect =
    "id, company_id, catalog_item_id, category_id, subcategory_id, location_id, name, unit, stock, minimum_stock, package_unit, manufacturer, article_number, notes, location_name, location_type, category_name, subcategory_name";
  let inventoryQuery = context.canManage
    ? supabase.from("inventory_items").select(managerSelect).eq("company_id", context.companyId)
    : supabase.from("inventory_items_public").select(publicSelect).eq("company_id", context.companyId);

  if (activeLocation) inventoryQuery = inventoryQuery.eq("location_id", activeLocation);
  if (search) {
    inventoryQuery = inventoryQuery.or(searchOrFilter(["name", "manufacturer", "article_number", "package_unit"], search));
  }

  const [
    locations,
    inventoryResult
  ] = await Promise.all([
    locationsPromise,
    inventoryQuery.order("name", { ascending: true }).range(onlyLowStock ? 0 : from, onlyLowStock ? 199 : from + pageSize)
  ]);

  const data = (inventoryResult.data ?? []) as InventoryListItem[];
  const hasNextPage = !onlyLowStock && data.length > pageSize;
  const allItems = onlyLowStock ? data : data.slice(0, pageSize);
  const inventoryItems = allItems.filter((item) => {
    if (onlyLowStock && !isLowStock(item)) return false;
    return true;
  });

  const visibleFrom = inventoryItems.length > 0 ? from + 1 : 0;
  const visibleTo = from + inventoryItems.length;
  const queryError = safeQueryErrorMessage(inventoryResult.error);
  const visibleLocations = context.canManage
    ? locations.map((location) => ({ id: location.id, name: location.name }))
    : [
        ...new Map(
          allItems
            .filter((item) => item.location_id && itemLocationName(item))
            .map((item) => [item.location_id as string, { id: item.location_id as string, name: itemLocationName(item) as string }])
        ).values()
      ];
  const returnTo = inventoryHref({ q: search, location: activeLocation, low: onlyLowStock, page });

  return (
    <>
      <PageHeader
        title="Materiallager"
        description={
          context.canManage
            ? "Bestand schnell buchen, Verbrauch abziehen und Material vom Fahrzeug auf die Baustelle umlagern."
            : "Bestand, Mindestbestand und Lagerorte ohne Preis- und Einkaufsdaten."
        }
        actionHref={context.canManage ? "/materials/catalog" : undefined}
        actionLabel={context.canManage ? "Katalog öffnen" : undefined}
        actionIcon={context.canManage ? Search : undefined}
      />
      <MaterialSubnav active="/materials/inventory" canManage={context.canManage} canOperate={context.canOperate} />
      <MessageBox error={error || queryError} success={success} />

      <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <form className="filter-bar grid gap-3 sm:grid-cols-[1fr_220px_auto]" action="/materials/inventory">
          <label className="sr-only" htmlFor="inventory-search">
            Lager suchen
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="inventory-search"
              className="field-input pl-9"
              name="q"
              defaultValue={search}
              placeholder="Suchen: Schraube, Rinne, Auto, Folie..."
            />
          </div>
          <select className="field-input" name="location" defaultValue={activeLocation}>
            <option value="">Alle Lagerorte</option>
            {visibleLocations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          {onlyLowStock ? <input type="hidden" name="low" value="1" /> : null}
          <button className="btn-primary" type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Filtern
          </button>
        </form>

        <InventoryLowStockLink onlyLowStock={onlyLowStock} scanLimit={lowStockScanLimit} />
      </div>

      <section className="mb-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="rounded-md bg-mint p-2 text-moss">
              <ClipboardList className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="section-title">Baustellenbuchung melden</h2>
              <p className="mt-1 text-sm text-slate-500">
                Mitarbeiter melden Verbrauch, Rückgabe, Verlust oder Bruch. Vorarbeiter/Chef bestätigen und buchen den Bestand.
              </p>
            </div>
          </div>

          {inventoryItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-fog p-4 text-sm font-semibold text-slate-600">
              Für eine Materialbuchung brauchst du sichtbares Material. Aktive Baustellen werden beim Auswählen geladen.
            </div>
          ) : (
            <form action={reportMaterialUsageAction} className="grid gap-3 lg:grid-cols-6" data-testid="material-usage-form">
              <input type="hidden" name="return_to" value={returnTo} />
              <label className="lg:col-span-2">
                <span className="field-label">Material</span>
                <select className="field-input" name="item_id" required>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {formatQuantity(item.stock)} {item.unit}
                      {itemLocationName(item) ? ` · ${itemLocationName(item)}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="lg:col-span-2">
                <span className="field-label">Baustelle</span>
                <JobsiteSelectField name="jobsite_id" required />
              </label>
              <label>
                <span className="field-label">Buchung</span>
                <select className="field-input" name="booking_type" defaultValue="consume">
                  <option value="consume">Verbrauch</option>
                  <option value="return">Rückgabe</option>
                  <option value="loss">Verlust</option>
                  <option value="break">Bruch</option>
                </select>
              </label>
              <label>
                <span className="field-label">Menge</span>
                <input className="field-input" name="quantity" inputMode="decimal" placeholder="z. B. 3" required />
              </label>
              <label className="lg:col-span-6">
                <span className="field-label">Notiz</span>
                <input className="field-input" name="notes" placeholder="z. B. auf Nordseite verbraucht, 2 Platten gebrochen..." />
              </label>
              <button className="btn-primary min-h-12 lg:col-span-6" type="submit">
                Materialbuchung melden
              </button>
            </form>
          )}
        </div>

        {context.canManage ? (
          <div className="surface p-4 sm:p-5">
            <div className="mb-4 flex items-start gap-3">
              <span className="rounded-md bg-amber-50 p-2 text-amber-700">
                <PackagePlus className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="section-title">Material reservieren</h2>
                <p className="mt-1 text-sm text-slate-500">Reserviert Bestand für kommende Baustellen, ohne ihn direkt abzubuchen.</p>
              </div>
            </div>
            {inventoryItems.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-fog p-4 text-sm font-semibold text-slate-600">
                Sobald Material vorhanden ist, kannst du hier reservieren. Aktive Baustellen werden beim Auswählen geladen.
              </p>
            ) : (
              <form action={reserveMaterialForJobsiteAction} className="grid gap-3" data-testid="material-reservation-form">
                <input type="hidden" name="return_to" value={returnTo} />
                <label>
                  <span className="field-label">Material</span>
                  <select className="field-input" name="item_id" required>
                    {inventoryItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} · {formatQuantity(item.stock)} {item.unit}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="field-label">Baustelle</span>
                  <JobsiteSelectField name="jobsite_id" required />
                </label>
                <label>
                  <span className="field-label">Menge</span>
                  <input className="field-input" name="quantity" inputMode="decimal" required />
                </label>
                <label>
                  <span className="field-label">Notiz</span>
                  <input className="field-input" name="notes" placeholder="z. B. für Montag bereitstellen" />
                </label>
                <button className="btn-secondary min-h-12" type="submit">
                  Reservieren
                </button>
              </form>
            )}
          </div>
        ) : null}
      </section>

      <InventoryActivityPanels canOperate={context.canOperate} returnTo={returnTo} />

      {context.canManage ? (
        <details className="surface mb-5 p-4">
          <summary className="cursor-pointer text-sm font-black text-ink">Eigenes Material erfassen</summary>
          <form action={createCustomInventoryItemAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6" data-testid="custom-inventory-form">
            <input type="hidden" name="return_to" value={returnTo} />
            <label className="lg:col-span-2">
              <span className="field-label">Materialname</span>
              <input className="field-input" name="name" placeholder="z. B. Restposten Biberschwanz naturrot" required />
            </label>
            <label>
              <span className="field-label">Einheit</span>
              <input className="field-input" name="unit" defaultValue="Stück" required />
            </label>
            <label>
              <span className="field-label">Bestand</span>
              <input className="field-input" name="stock" inputMode="decimal" defaultValue="0" />
            </label>
            <label>
              <span className="field-label">Minimum</span>
              <input className="field-input" name="minimum_stock" inputMode="decimal" defaultValue="0" />
            </label>
            <label>
              <span className="field-label">Lagerort</span>
              <select className="field-input" name="location_id" required>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-secondary self-end lg:col-span-6" type="submit">
              <PackagePlus className="h-4 w-4" aria-hidden="true" />
              Eigenes Material speichern
            </button>
          </form>
        </details>
      ) : null}

      {inventoryItems.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="Noch kein Lagerbestand"
          description={
            context.canManage
              ? "Öffne den Katalog und übernimm typische Dachdeckerartikel in dein Lager."
              : "Es sind noch keine preisbereinigten Lagerartikel sichtbar. Melde fehlendes Material direkt an Chef."
          }
          actionHref={context.canManage ? "/materials/catalog" : "/material-melden"}
          actionLabel={context.canManage ? "Katalog öffnen" : "Material melden"}
        />
      ) : (
        <>
          <div className="grid gap-3 xl:grid-cols-2">
          {inventoryItems.map((item) => {
            const lowStock = isLowStock(item);
            return (
              <article key={item.id} className="surface-strong p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-lg font-black text-ink">{item.name}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {itemLocationName(item) ?? "Ohne Lagerort"}
                      {itemCategoryName(item) ? ` / ${itemCategoryName(item)}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex w-fit items-center gap-1 rounded-md px-2.5 py-1 text-xs font-black",
                      lowStock ? "bg-red-50 text-red-700 ring-1 ring-red-200" : "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                    )}
                  >
                    {lowStock ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                    {lowStock ? "Nachbestellen" : "OK"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 lg:grid-cols-4">
                  <div className="rounded-md bg-fog p-3">
                    <p className="meta-label">Bestand</p>
                    <p className={cn("mt-1 text-lg font-black", lowStock ? "text-red-700" : "text-ink")}>
                      {formatQuantity(item.stock)} {item.unit}
                    </p>
                  </div>
                  <div className="rounded-md bg-fog p-3">
                    <p className="meta-label">Minimum</p>
                    <p className="mt-1 font-bold text-ink">
                      {formatQuantity(item.minimum_stock)} {item.unit}
                    </p>
                  </div>
                  {context.canManage && "purchase_price" in item ? (
                    <>
                      <div className="rounded-md bg-fog p-3">
                        <p className="meta-label">EK</p>
                        <p className="mt-1 truncate font-bold text-ink">{formatMoney(item.purchase_price)}</p>
                      </div>
                      <div className="rounded-md bg-fog p-3">
                        <p className="meta-label">VK</p>
                        <p className="mt-1 truncate font-bold text-ink">{formatMoney(item.sales_price)}</p>
                      </div>
                    </>
                  ) : null}
                </div>

                {context.canManage && "purchase_price" in item ? (
                  <details className="mt-4 rounded-lg border border-line bg-white p-3">
                    <summary className="cursor-pointer text-sm font-black text-ink">Chef-Preise</summary>
                    <form action={updateInventoryPricingAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                      <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <label>
                        <span className="field-label">EK netto</span>
                        <input
                          className="field-input"
                          name="purchase_price"
                          inputMode="decimal"
                          defaultValue={item.purchase_price ?? ""}
                          placeholder="0,00"
                        />
                      </label>
                      <label>
                        <span className="field-label">Aufschlag %</span>
                        <input
                          className="field-input"
                          name="markup_percent"
                          inputMode="decimal"
                          defaultValue={item.markup_percent ?? 0}
                        />
                      </label>
                      <label>
                        <span className="field-label">VK netto</span>
                        <input
                          className="field-input"
                          name="sales_price"
                          inputMode="decimal"
                          defaultValue={item.sales_price ?? ""}
                          placeholder="manuell"
                        />
                      </label>
                      <label>
                        <span className="field-label">Verkaufseinheit</span>
                        <input className="field-input" name="sales_unit" defaultValue={item.sales_unit ?? item.unit} />
                      </label>
                      <label>
                        <span className="field-label">Preis/Einheit</span>
                        <input
                          className="field-input"
                          name="price_per_unit"
                          inputMode="decimal"
                          defaultValue={item.price_per_unit ?? ""}
                        />
                      </label>
                      <label>
                        <span className="field-label">Lieferant</span>
                        <SupplierSelectField name="supplier_id" defaultValue={item.supplier_id ?? ""} />
                      </label>
                      <label className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink lg:col-span-3">
                        <input
                          type="checkbox"
                          name="auto_calculate_sales_price"
                          defaultChecked={!item.sales_price && Boolean(item.purchase_price)}
                          className="h-4 w-4 rounded border-line text-moss"
                        />
                        VK aus EK + Aufschlag berechnen
                      </label>
                      <div className="rounded-md bg-fog p-3 text-sm lg:col-span-2">
                        <p className="meta-label">Marge pro Einheit</p>
                        <p className="mt-1 font-black text-ink">
                          {item.purchase_price !== null && item.sales_price !== null
                            ? formatMoney(Number(item.sales_price) - Number(item.purchase_price))
                            : "-"}
                        </p>
                      </div>
                      <button className="btn-primary lg:col-span-1" type="submit">
                        Speichern
                      </button>
                    </form>
                  </details>
                ) : null}

                {context.canManage ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Link href={`/materials/inventory/${item.id}`} className="btn-primary sm:col-span-2">
                      Preisvergleich und Details
                    </Link>

                    <form action={adjustInventoryStockAction} className="grid grid-cols-[1fr_auto_auto] gap-2">
                      <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="item_id" value={item.id} />
                      <input className="field-input" name="amount" inputMode="decimal" placeholder="Menge" required />
                      <button className="btn-secondary px-3" type="submit" name="mode" value="increase" aria-label="Bestand erhoehen">
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button className="btn-secondary px-3" type="submit" name="mode" value="decrease" aria-label="Bestand verringern">
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </form>

                    <form action={transferInventoryAction} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                      <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="source_item_id" value={item.id} />
                      <input className="field-input" name="amount" inputMode="decimal" placeholder="Menge" required />
                      <select className="field-input" name="target_location_id" required defaultValue="">
                        <option value="" disabled>
                          Ziel
                        </option>
                        {locations
                          .filter((location: InventoryLocation) => location.id !== item.location_id)
                          .map((location: InventoryLocation) => (
                            <option key={location.id} value={location.id}>
                              {location.name}
                            </option>
                          ))}
                      </select>
                      <button className="btn-secondary px-3" type="submit" aria-label="Umlagern">
                        <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="mt-4 rounded-md border border-line bg-fog p-3 text-sm font-semibold text-slate-600">
                    Preise und Buchungsaktionen sind nur für Chef sichtbar. Fehlmaterial bitte über Material melden erfassen.
                  </div>
                )}
              </article>
            );
          })}
          </div>
          {page > 1 || hasNextPage ? (
            <nav className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={inventoryHref({ q: search, location: activeLocation, low: onlyLowStock, page: Math.max(1, page - 1) })}
                className={cn("btn-secondary", page <= 1 && "pointer-events-none opacity-50")}
              >
                Zurück
              </Link>
              <span className="text-center text-sm font-bold text-slate-500">
                {visibleFrom}-{visibleTo} · Seite {page}
              </span>
              <Link
                href={inventoryHref({ q: search, location: activeLocation, low: onlyLowStock, page: page + 1 })}
                className={cn("btn-secondary", !hasNextPage && "pointer-events-none opacity-50")}
              >
                Weiter
              </Link>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
