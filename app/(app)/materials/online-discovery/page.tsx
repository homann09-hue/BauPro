import Link from "next/link";
import { AlertTriangle, ExternalLink, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { runOnlinePriceDiscoveryAction } from "@/lib/actions/online-price-discovery-actions";
import { requireManager } from "@/lib/auth";
import { inventoryPriceOptionSelect, onlinePriceDiscoverySelect, onlinePriceOfferSelect } from "@/lib/data/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";
import type { InventoryItem, OnlinePriceDiscovery, OnlinePriceOffer } from "@/types/app";

function param(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return typeof value === "string" ? value.trim() : "";
}

export default async function OnlineDiscoveryPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const query = param(params, "q");

  const [materialsResult, discoveriesResult, offersResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(inventoryPriceOptionSelect)
      .eq("company_id", context.companyId)
      .order("name"),
    supabase
      .from("online_price_discoveries")
      .select(onlinePriceDiscoverySelect)
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("online_price_offers")
      .select(onlinePriceOfferSelect)
      .eq("company_id", context.companyId)
      .order("total_price_gross", { ascending: true })
      .limit(200)
  ]);

  const materials = (materialsResult.data ?? []) as InventoryItem[];
  const discoveries = (discoveriesResult.data ?? []) as OnlinePriceDiscovery[];
  const offers = (offersResult.data ?? []) as OnlinePriceOffer[];
  const offersByDiscovery = new Map<string, OnlinePriceOffer[]>();

  for (const offer of offers) {
    const list = offersByDiscovery.get(offer.discovery_id) ?? [];
    list.push(offer);
    offersByDiscovery.set(offer.discovery_id, list);
  }

  return (
    <>
      <PageHeader
        title="Online Price Discovery"
        description="Optionale Online-Preisrecherche als Chef-Preisindikator. Vor Bestellung immer prüfen."
      />
      <MaterialSubnav active="/materials/online-discovery" />
      <MessageBox error={error} success={success} />

      <div className="surface mb-5 flex items-start gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden="true" />
        <p className="text-sm leading-6 text-slate-700">
          Preisvorschlag aus Online-Recherche – vor Bestellung prüfen. Prioritaet: eigene EK-Preise,
          CSV-Preislisten, eBay, API-Aggregatoren und zuletzt Markt-Richtpreise.
        </p>
      </div>

      <form action={runOnlinePriceDiscoveryAction} className="surface mb-5 grid gap-3 p-4 lg:grid-cols-[1fr_280px_auto]">
        <input type="hidden" name="return_to" value="/materials/online-discovery" />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field-input pl-9"
            name="query"
            defaultValue={query}
            placeholder="z. B. Spenglerschrauben V2A 4,5x35"
            required
          />
        </div>
        <select className="field-input" name="material_id" defaultValue="">
          <option value="">Kein Material zuordnen</option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name}
            </option>
          ))}
        </select>
        <button className="btn-primary" type="submit">
          Online recherchieren
        </button>
      </form>

      {discoveries.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Noch keine Online-Recherche"
          description="Starte eine Recherche für Verbrauchsmaterialien wie Schrauben, Dichtstoffe, Trennscheiben oder Arbeitsschutz."
        />
      ) : (
        <div className="grid gap-4">
          {discoveries.map((discovery) => {
            const discoveryOffers = offersByDiscovery.get(discovery.id) ?? [];
            return (
              <article key={discovery.id} className="surface-strong p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="meta-label">{formatDateTime(discovery.created_at)}</p>
                    <h2 className="mt-1 text-lg font-black text-ink">{discovery.query}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Preisvorschlag aus Online-Recherche – vor Bestellung prüfen.
                    </p>
                  </div>
                  <span className="w-fit rounded-md bg-mint px-2.5 py-1 text-xs font-black text-moss">
                    {discovery.status === "no_results" ? "Keine Angebote" : `${discovery.offer_count} Angebote`}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md bg-fog p-3">
                    <p className="meta-label">Günstigster Preis</p>
                    <p className="mt-1 text-lg font-black text-ink">{formatMoney(discovery.cheapest_price_gross)}</p>
                  </div>
                  <div className="rounded-md bg-fog p-3">
                    <p className="meta-label">Durchschnitt</p>
                    <p className="mt-1 text-lg font-black text-ink">{formatMoney(discovery.average_price_gross)}</p>
                  </div>
                  <div className="rounded-md bg-fog p-3">
                    <p className="meta-label">Gefundene Angebote</p>
                    <p className="mt-1 text-lg font-black text-ink">{discovery.offer_count}</p>
                  </div>
                </div>

                {discoveryOffers.length === 0 ? (
                  <p className="mt-4 rounded-md border border-dashed border-line p-4 text-sm font-semibold text-slate-600">
                    Keine aktuellen Online-Angebote gefunden.
                  </p>
                ) : (
                  <div className="mt-4 grid gap-2">
                    {discoveryOffers.slice(0, 6).map((offer) => (
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

                <details className="mt-4 rounded-lg border border-line bg-white p-3">
                  <summary className="cursor-pointer text-sm font-black text-ink">Quellenstatus</summary>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {discovery.source_statuses.map((status) => (
                      <div key={status.sourceKey} className="rounded-md bg-fog p-3 text-sm">
                        <p className="font-black text-ink">{status.label}</p>
                        <p className="mt-1 text-slate-600">{status.message}</p>
                      </div>
                    ))}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-5">
        <Link href="/materials/live-offers" className="btn-secondary">
          Lieferantenangebote öffnen
        </Link>
      </div>
    </>
  );
}
