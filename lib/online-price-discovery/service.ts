import { createOnlinePriceSources } from "@/lib/online-price-discovery/sources";
import type { OnlinePriceCandidate, OnlinePriceSourceStatus } from "@/lib/online-price-discovery/types";
import type { OnlinePriceDiscoveryStatus } from "@/types/app";

export type OnlinePriceDiscoveryResult = {
  offers: OnlinePriceCandidate[];
  sourceStatuses: OnlinePriceSourceStatus[];
  cheapestPriceGross: number | null;
  averagePriceGross: number | null;
  status: OnlinePriceDiscoveryStatus;
};

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

async function safeSearch(source: ReturnType<typeof createOnlinePriceSources>[number], query: string) {
  try {
    return await source.search(query);
  } catch {
    return {
      offers: [],
      status: {
        sourceKey: source.sourceKey,
        label: source.label,
        status: "error" as const,
        message: `${source.label}: Quelle konnte nicht abgefragt werden.`
      }
    };
  }
}

export async function discoverOnlinePrices(query: string): Promise<OnlinePriceDiscoveryResult> {
  const sources = createOnlinePriceSources();
  const marketReferenceSource = sources.find((source) => source.sourceKey === "market_reference");
  const primarySources = sources.filter((source) => source.sourceKey !== "market_reference");
  const results = await Promise.all(primarySources.map((source) => safeSearch(source, query)));

  const primaryOffers = results.flatMap((result) => result.offers);
  const marketReferenceResult =
    primaryOffers.length === 0 && marketReferenceSource
      ? await safeSearch(marketReferenceSource, query)
      : marketReferenceSource
        ? {
            offers: [],
            status: {
              sourceKey: marketReferenceSource.sourceKey,
              label: marketReferenceSource.label,
              status: "ok" as const,
              message: "Markt-Richtpreis nicht genutzt, weil bessere Preisquellen vorhanden sind."
            }
          }
        : null;
  const allResults = marketReferenceResult ? [...results, marketReferenceResult] : results;
  const offers = allResults.flatMap((result) => result.offers);
  const sourceStatuses = allResults.map((result) => result.status);
  const totals = offers.map((offer) => offer.priceGross + offer.shippingCost);
  const cheapestPriceGross = totals.length ? roundMoney(Math.min(...totals)) : null;
  const averagePriceGross = totals.length
    ? roundMoney(totals.reduce((sum, value) => sum + value, 0) / totals.length)
    : null;
  const hasErrors = sourceStatuses.some((status) => status.status === "error" || status.status === "unreachable");

  return {
    offers,
    sourceStatuses,
    cheapestPriceGross,
    averagePriceGross,
    status: offers.length === 0 ? "no_results" : hasErrors ? "partial_error" : "completed"
  };
}
