import Link from "next/link";
import { BadgeEuro, ExternalLink, Plus, Search, Upload } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import {
  acceptSupplierOfferAsPurchasePriceAction,
  matchSupplierOfferAction
} from "@/lib/actions/supplier-actions";
import { requireManager } from "@/lib/auth";
import { formatQuantity } from "@/lib/inventory";
import { supplierProviders } from "@/lib/suppliers/provider-config";
import { bestDealScore } from "@/lib/suppliers/matcher";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";
import type { InventoryItem, SupplierOffer, SupplierOfferMatch } from "@/types/app";

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

function matchesSearch(offer: SupplierOffer, search: string) {
  if (!search) return true;
  return [offer.product_name, offer.manufacturer, offer.category, offer.supplier_name, offer.stock_status]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(search.toLowerCase());
}

function sortOffers(offers: SupplierOffer[], sort: string) {
  const list = [...offers];
  if (sort === "delivery") {
    return list.sort((a, b) => Number(a.delivery_time_days_min ?? 999) - Number(b.delivery_time_days_min ?? 999));
  }
  if (sort === "deal") {
    return list.sort((a, b) => bestDealScore(a) - bestDealScore(b));
  }
  return list.sort((a, b) => Number(a.total_price_gross ?? 0) - Number(b.total_price_gross ?? 0));
}

export default async function LiveOffersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const search = param(params, "q");
  const provider = param(params, "provider");
  const category = param(params, "category");
  const delivery = param(params, "delivery");
  const available = param(params, "available") === "1";
  const sort = param(params, "sort") || "price";

  const [offersResult, materialsResult, matchesResult] = await Promise.all([
    supabase
      .from("supplier_offers")
      .select("*, supplier_integrations(id, name, provider_key, type)")
      .order("last_checked_at", { ascending: false })
      .limit(300),
    supabase
      .from("inventory_items")
      .select("id, name, unit, purchase_price, manufacturer")
      .order("name", { ascending: true }),
    supabase
      .from("supplier_offer_matches")
      .select("*, supplier_offers(*), inventory_items(id, name, unit, purchase_price, manufacturer)")
      .order("match_score", { ascending: false })
  ]);

  const allOffers = (offersResult.data ?? []) as SupplierOffer[];
  const materials = (materialsResult.data ?? []) as InventoryItem[];
  const matches = (matchesResult.data ?? []) as SupplierOfferMatch[];
  const matchesByOfferId = new Map<string, SupplierOfferMatch[]>();

  for (const match of matches) {
    const list = matchesByOfferId.get(match.supplier_offer_id) ?? [];
    list.push(match);
    matchesByOfferId.set(match.supplier_offer_id, list);
  }

  const categories = [...new Set(allOffers.map((offer) => offer.category).filter(Boolean) as string[])].sort();
  const offers = sortOffers(
    allOffers.filter((offer) => {
      if (!matchesSearch(offer, search)) return false;
      if (provider && offer.provider_key !== provider) return false;
      if (category && offer.category !== category) return false;
      if (delivery && Number(offer.delivery_time_days_min ?? 999) > Number(delivery)) return false;
      if (available && !String(offer.stock_status ?? "").toLowerCase().includes("lager")) return false;
      return true;
    }),
    sort
  );

  const queryString = new URLSearchParams(
    Object.entries({ q: search, provider, category, delivery, available: available ? "1" : "", sort }).filter(([, value]) => value)
  ).toString();
  const returnTo = `/materials/live-offers${queryString ? `?${queryString}` : ""}`;

  return (
    <>
      <PageHeader
        title="Live-Angebote"
        description="Preisvergleich aus manuellen Angeboten, CSV-Feeds und vorbereiteten offiziellen Anbieter-Integrationen."
        actionHref="/materials/live-offers/new"
        actionLabel="Manuelles Angebot"
        actionIcon={Plus}
      />
      <MaterialSubnav active="/materials/live-offers" />
      <MessageBox error={error} success={success} />

      <div className="surface mb-5 flex flex-col gap-2 p-4 sm:flex-row">
        <Link href="/materials/live-offers/import" className="btn-secondary">
          <Upload className="h-4 w-4" aria-hidden="true" />
          CSV importieren
        </Link>
        <Link href="/suppliers" className="btn-secondary">
          Lieferanten verwalten
        </Link>
      </div>

      <form className="surface mb-5 grid gap-3 p-3 lg:grid-cols-[1fr_170px_170px_150px_150px_auto]" action="/materials/live-offers">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="field-input pl-9" name="q" defaultValue={search} placeholder="Suchen: Spax, Fischer, Dichtstoff..." />
        </div>
        <select className="field-input" name="provider" defaultValue={provider}>
          <option value="">Alle Anbieter</option>
          {supplierProviders.map((item) => (
            <option key={item.providerKey} value={item.providerKey}>
              {item.name}
            </option>
          ))}
        </select>
        <select className="field-input" name="category" defaultValue={category}>
          <option value="">Alle Kategorien</option>
          {categories.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select className="field-input" name="delivery" defaultValue={delivery}>
          <option value="">Lieferzeit</option>
          <option value="1">bis 1 Tag</option>
          <option value="3">bis 3 Tage</option>
          <option value="7">bis 7 Tage</option>
        </select>
        <select className="field-input" name="sort" defaultValue={sort}>
          <option value="price">Preis</option>
          <option value="delivery">Lieferzeit</option>
          <option value="deal">Bester Deal</option>
        </select>
        {available ? <input type="hidden" name="available" value="1" /> : null}
        <button className="btn-primary" type="submit">
          Filtern
        </button>
      </form>

      {offers.length === 0 ? (
        <EmptyState
          icon={BadgeEuro}
          title="Noch keine Angebote"
          description="Lege manuelle Angebote an oder importiere eine CSV aus einem erlaubten Lieferantenfeed."
          actionHref="/materials/live-offers/new"
          actionLabel="Angebot anlegen"
        />
      ) : (
        <div className="grid gap-4">
          {offers.map((offer) => {
            const matched = matchesByOfferId.get(offer.id) ?? [];
            const primaryMatch = matched[0];
            const currentEk = primaryMatch?.inventory_items?.purchase_price ?? null;
            const priceNet = offer.price_net ?? offer.price_gross / (1 + Number(offer.vat_rate ?? 19) / 100);
            const diff = currentEk === null ? null : priceNet - Number(currentEk);

            return (
              <article key={offer.id} className="surface-strong p-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                  <div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="meta-label">{supplierProviders.find((item) => item.providerKey === offer.provider_key)?.name ?? offer.provider_key}</p>
                        <h2 className="mt-1 text-lg font-black text-ink">{offer.product_name}</h2>
                        <p className="mt-1 text-sm font-semibold text-slate-500">
                          {offer.supplier_name}
                          {offer.manufacturer ? ` · ${offer.manufacturer}` : ""}
                          {offer.category ? ` · ${offer.category}` : ""}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "w-fit rounded-md px-2.5 py-1 text-xs font-black",
                          offer.stock_status?.toLowerCase().includes("lager")
                            ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
                            : "bg-slate-100 text-slate-700"
                        )}
                      >
                        {offer.stock_status || "Verfügbarkeit unbekannt"}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-4">
                      <div className="rounded-md bg-fog p-3">
                        <p className="meta-label">Preis brutto</p>
                        <p className="mt-1 font-black text-ink">{formatMoney(offer.price_gross)}</p>
                      </div>
                      <div className="rounded-md bg-fog p-3">
                        <p className="meta-label">Versand</p>
                        <p className="mt-1 font-black text-ink">{formatMoney(offer.shipping_cost)}</p>
                      </div>
                      <div className="rounded-md bg-mint p-3">
                        <p className="meta-label text-moss">Gesamt</p>
                        <p className="mt-1 font-black text-ink">{formatMoney(offer.total_price_gross)}</p>
                      </div>
                      <div className="rounded-md bg-fog p-3">
                        <p className="meta-label">Lieferzeit</p>
                        <p className="mt-1 font-black text-ink">{offer.delivery_time_text || `${offer.delivery_time_days_min ?? "-"} Tage`}</p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs font-semibold text-slate-500">
                      Einheit: {offer.unit}
                      {offer.package_size ? ` · Packung: ${formatQuantity(offer.package_size)}` : ""} · geprüft:{" "}
                      {formatDateTime(offer.last_checked_at)}
                    </div>
                  </div>

                  <aside className="rounded-lg border border-line bg-white p-3">
                    <p className="font-black text-ink">Zuordnung</p>
                    {primaryMatch?.inventory_items ? (
                      <div className="mt-2 rounded-md bg-fog p-3 text-sm">
                        <p className="font-black text-ink">{primaryMatch.inventory_items.name}</p>
                        <p className="mt-1 text-slate-600">Score {primaryMatch.match_score}/100</p>
                        <p className="mt-1 text-slate-600">
                          EK aktuell {formatMoney(currentEk)} · Differenz {diff === null ? "-" : formatMoney(diff)}
                        </p>
                      </div>
                    ) : null}

                    <form action={matchSupplierOfferAction} className="mt-3 grid gap-2">
                      <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="offer_id" value={offer.id} />
                      <select className="field-input" name="material_id" defaultValue={primaryMatch?.material_id ?? ""} required>
                        <option value="">Material wählen</option>
                        {materials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name}
                          </option>
                        ))}
                      </select>
                      <button className="btn-secondary" type="submit">
                        Angebot Material zuordnen
                      </button>
                    </form>

                    {primaryMatch?.material_id ? (
                      <form action={acceptSupplierOfferAsPurchasePriceAction} className="mt-2">
                        <input type="hidden" name="return_to" value={returnTo} />
                        <input type="hidden" name="material_id" value={primaryMatch.material_id} />
                        <input type="hidden" name="offer_id" value={offer.id} />
                        <button className="btn-primary w-full" type="submit">
                          Als EK übernehmen
                        </button>
                      </form>
                    ) : null}

                    {offer.product_url ? (
                      <a className="btn-secondary mt-2 w-full" href={offer.product_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Angebot öffnen
                      </a>
                    ) : null}
                  </aside>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
