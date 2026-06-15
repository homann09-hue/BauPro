import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeEuro, ExternalLink, PackageCheck, Search, Zap } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { runOnlinePriceDiscoveryAction } from "@/lib/actions/online-price-discovery-actions";
import {
  acceptSupplierOfferAsPurchasePriceAction,
  matchSupplierOfferAction
} from "@/lib/actions/supplier-actions";
import { requireManager } from "@/lib/auth";
import { formatQuantity } from "@/lib/inventory";
import { resolveMaterialPriceDecision } from "@/lib/online-price-discovery/pricing-priority";
import { bestDealScore } from "@/lib/suppliers/matcher";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";
import type { InventoryItem, OnlinePriceDiscovery, OnlinePriceOffer, SupplierOffer, SupplierOfferMatch } from "@/types/app";

function bestByPrice(offers: SupplierOffer[]) {
  return [...offers].sort((a, b) => Number(a.total_price_gross ?? 0) - Number(b.total_price_gross ?? 0))[0] ?? null;
}

function fastest(offers: SupplierOffer[]) {
  return [...offers].sort((a, b) => Number(a.delivery_time_days_min ?? 999) - Number(b.delivery_time_days_min ?? 999))[0] ?? null;
}

function bestDeal(offers: SupplierOffer[]) {
  return [...offers].sort((a, b) => bestDealScore(a) - bestDealScore(b))[0] ?? null;
}

function OfferCard({
  title,
  offer,
  materialId,
  returnTo
}: {
  title: string;
  offer: SupplierOffer | null;
  materialId: string;
  returnTo: string;
}) {
  if (!offer) {
    return (
      <div className="rounded-lg border border-dashed border-line p-4">
        <p className="font-black text-ink">{title}</p>
        <p className="mt-1 text-sm text-slate-500">Noch kein passendes Angebot.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="meta-label">{title}</p>
      <h3 className="mt-1 font-black text-ink">{offer.product_name}</h3>
      <p className="mt-1 text-sm font-semibold text-slate-500">{offer.supplier_name}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-fog p-2">
          <p className="meta-label">Gesamt</p>
          <p className="font-black text-ink">{formatMoney(offer.total_price_gross)}</p>
        </div>
        <div className="rounded-md bg-fog p-2">
          <p className="meta-label">Lieferzeit</p>
          <p className="font-black text-ink">{offer.delivery_time_text || `${offer.delivery_time_days_min ?? "-"} Tage`}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <form action={acceptSupplierOfferAsPurchasePriceAction}>
          <input type="hidden" name="return_to" value={returnTo} />
          <input type="hidden" name="material_id" value={materialId} />
          <input type="hidden" name="offer_id" value={offer.id} />
          <button className="btn-primary w-full" type="submit">
            Als EK übernehmen
          </button>
        </form>
        {offer.product_url ? (
          <a className="btn-secondary w-full" href={offer.product_url} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Angebot öffnen
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default async function InventoryItemDetailPage({
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

  const [itemResult, matchesResult, offersResult, discoveriesResult, onlineOffersResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select("*, inventory_locations(id, name, location_type), material_categories(id, name, slug), material_subcategories(id, name, slug), suppliers(id, name)")
      .eq("id", id)
      .single(),
    supabase
      .from("supplier_offer_matches")
      .select("*, supplier_offers(*)")
      .eq("material_id", id)
      .order("match_score", { ascending: false }),
    supabase.from("supplier_offers").select("*").order("total_price_gross", { ascending: true }).limit(100),
    supabase
      .from("online_price_discoveries")
      .select("*")
      .eq("material_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("online_price_offers")
      .select("*")
      .eq("material_id", id)
      .order("total_price_gross", { ascending: true })
      .limit(8)
  ]);

  if (!itemResult.data) notFound();

  const item = itemResult.data as InventoryItem;
  const matches = (matchesResult.data ?? []) as SupplierOfferMatch[];
  const matchedOffers = matches.map((match) => match.supplier_offers).filter(Boolean) as SupplierOffer[];
  const allOffers = (offersResult.data ?? []) as SupplierOffer[];
  const latestDiscovery = (discoveriesResult.data ?? null) as OnlinePriceDiscovery | null;
  const onlineOffers = (onlineOffersResult.data ?? []) as OnlinePriceOffer[];
  const returnTo = `/materials/inventory/${item.id}`;
  const cheapest = bestByPrice(matchedOffers);
  const fastestOffer = fastest(matchedOffers);
  const deal = bestDeal(matchedOffers);
  const priceDecision = resolveMaterialPriceDecision({
    material: item,
    supplierOffers: matchedOffers,
    latestDiscovery
  });

  return (
    <>
      <PageHeader
        title={item.name}
        description={`${item.inventory_locations?.name ?? "Ohne Lagerort"} · Bestand ${formatQuantity(item.stock)} ${item.unit}`}
        actionHref="/materials/live-offers"
        actionLabel="Angebote"
        actionIcon={BadgeEuro}
      />
      <MaterialSubnav active="/materials/inventory" />
      <MessageBox error={error} success={success} />

      <section className="surface mb-5 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="meta-label">Aktueller EK</p>
          <p className="mt-1 text-xl font-black text-ink">{formatMoney(item.purchase_price)}</p>
        </div>
        <div>
          <p className="meta-label">VK</p>
          <p className="mt-1 text-xl font-black text-ink">{formatMoney(item.sales_price)}</p>
        </div>
        <div>
          <p className="meta-label">Bestand</p>
          <p className="mt-1 text-xl font-black text-ink">
            {formatQuantity(item.stock)} {item.unit}
          </p>
        </div>
        <div>
          <p className="meta-label">Letzte Preisänderung</p>
          <p className="mt-1 text-sm font-black text-ink">{formatDateTime(item.last_price_changed_at)}</p>
        </div>
      </section>

      <section className="surface mb-5 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">Preispriorität</h2>
            <p className="mt-1 text-sm text-slate-500">
              Kalkulation nutzt zuerst eigenen EK, dann Lieferantenpreis, dann Online-Durchschnitt, zuletzt Markt-Richtpreis.
            </p>
          </div>
          <div className="rounded-md bg-mint p-3 text-right">
            <p className="meta-label text-moss">{priceDecision.label}</p>
            <p className="mt-1 text-xl font-black text-ink">{formatMoney(priceDecision.value)}</p>
          </div>
        </div>
      </section>

      <section className="surface mb-5 p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="section-title">Online Price Discovery</h2>
            <p className="mt-1 text-sm text-slate-500">
              Preisvorschlag aus Online-Recherche – vor Bestellung prüfen.
            </p>
          </div>
          <form action={runOnlinePriceDiscoveryAction} className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="return_to" value={returnTo} />
            <input type="hidden" name="material_id" value={item.id} />
            <input type="hidden" name="query" value={item.name} />
            <button className="btn-primary" type="submit">
              <Search className="h-4 w-4" aria-hidden="true" />
              Online recherchieren
            </button>
          </form>
        </div>

        {latestDiscovery ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-md bg-fog p-3">
                <p className="meta-label">Günstigster Onlinepreis</p>
                <p className="mt-1 text-lg font-black text-ink">{formatMoney(latestDiscovery.cheapest_price_gross)}</p>
              </div>
              <div className="rounded-md bg-fog p-3">
                <p className="meta-label">Online-Durchschnitt</p>
                <p className="mt-1 text-lg font-black text-ink">{formatMoney(latestDiscovery.average_price_gross)}</p>
              </div>
              <div className="rounded-md bg-fog p-3">
                <p className="meta-label">Anzahl Angebote</p>
                <p className="mt-1 text-lg font-black text-ink">{latestDiscovery.offer_count}</p>
              </div>
            </div>

            {onlineOffers.length === 0 ? (
              <p className="mt-4 rounded-md border border-dashed border-line p-4 text-sm font-semibold text-slate-600">
                Keine aktuellen Online-Angebote gefunden.
              </p>
            ) : (
              <div className="mt-4 grid gap-2">
                {onlineOffers.map((offer) => (
                  <div key={offer.id} className="rounded-lg border border-line bg-white p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-black text-ink">{offer.product_name}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {offer.supplier_name} · {offer.source_key} · {offer.delivery_time_text || "Lieferzeit unbekannt"}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 sm:items-end">
                        <p className="font-black text-ink">{formatMoney(offer.total_price_gross)}</p>
                        {offer.product_url ? (
                          <a className="inline-flex items-center gap-1 text-sm font-bold text-moss" href={offer.product_url} target="_blank" rel="noreferrer">
                            Öffnen
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="rounded-md border border-dashed border-line p-4 text-sm font-semibold text-slate-600">
            Noch keine Online-Recherche für dieses Material.
          </p>
        )}
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-3">
        <OfferCard title="Günstigstes Angebot" offer={cheapest} materialId={item.id} returnTo={returnTo} />
        <OfferCard title="Schnellste Lieferung" offer={fastestOffer} materialId={item.id} returnTo={returnTo} />
        <OfferCard title="Bester Deal" offer={deal} materialId={item.id} returnTo={returnTo} />
      </section>

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">Zugeordnete Angebote</h2>
            <p className="mt-1 text-sm text-slate-500">Chef-Preisvergleich für diesen Lagerartikel.</p>
          </div>
          <Link href="/materials/live-offers/new" className="btn-primary">
            Angebot erfassen
          </Link>
        </div>

        {matchedOffers.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Keine Angebote zugeordnet"
            description="Ordne ein vorhandenes Angebot zu oder erfasse ein neues Lieferantenangebot."
            actionHref="/materials/live-offers"
            actionLabel="Angebote öffnen"
          />
        ) : (
          <div className="grid gap-3">
            {matches.map((match) => {
              const offer = match.supplier_offers;
              if (!offer) return null;
              const net = offer.price_net ?? offer.price_gross / (1 + Number(offer.vat_rate ?? 19) / 100);
              const diff = item.purchase_price === null ? null : net - Number(item.purchase_price);

              return (
                <article key={match.id} className="rounded-lg border border-line bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-black text-ink">{offer.product_name}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {offer.supplier_name} · Score {match.match_score}/100 · {offer.stock_status || "Bestand unbekannt"}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-4 lg:min-w-[560px]">
                      <div className="rounded-md bg-fog p-2">
                        <p className="meta-label">Netto</p>
                        <p className="font-black text-ink">{formatMoney(net)}</p>
                      </div>
                      <div className="rounded-md bg-fog p-2">
                        <p className="meta-label">Gesamt</p>
                        <p className="font-black text-ink">{formatMoney(offer.total_price_gross)}</p>
                      </div>
                      <div className="rounded-md bg-fog p-2">
                        <p className="meta-label">Differenz</p>
                        <p className="font-black text-ink">{diff === null ? "-" : formatMoney(diff)}</p>
                      </div>
                      <div className="rounded-md bg-fog p-2">
                        <p className="meta-label">Lieferung</p>
                        <p className="font-black text-ink">{offer.delivery_time_text || `${offer.delivery_time_days_min ?? "-"} Tage`}</p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    {offer.product_url ? (
                      <a className="btn-secondary" href={offer.product_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                        Angebot öffnen
                      </a>
                    ) : null}
                    <form action={acceptSupplierOfferAsPurchasePriceAction}>
                      <input type="hidden" name="return_to" value={returnTo} />
                      <input type="hidden" name="material_id" value={item.id} />
                      <input type="hidden" name="offer_id" value={offer.id} />
                      <button className="btn-primary" type="submit">
                        Als EK übernehmen
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="surface mt-5 p-4 sm:p-5">
        <div className="mb-3 flex items-center gap-2">
          <Zap className="h-5 w-5 text-moss" aria-hidden="true" />
          <h2 className="section-title">Angebot manuell zuordnen</h2>
        </div>
        <form action={matchSupplierOfferAction} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input type="hidden" name="return_to" value={returnTo} />
          <input type="hidden" name="material_id" value={item.id} />
          <select className="field-input" name="offer_id" defaultValue="" required>
            <option value="">Angebot wählen</option>
            {allOffers.map((offer) => (
              <option key={offer.id} value={offer.id}>
                {offer.supplier_name} · {offer.product_name} · {formatMoney(offer.total_price_gross)}
              </option>
            ))}
          </select>
          <button className="btn-secondary" type="submit">
            Angebot Material zuordnen
          </button>
        </form>
      </section>
    </>
  );
}
