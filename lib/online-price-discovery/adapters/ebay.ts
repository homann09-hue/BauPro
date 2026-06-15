import type { OnlinePriceSource, OnlinePriceSourceResult } from "@/lib/online-price-discovery/types";
import { fetchJson, isSourceResult, noConfig, normalizeCandidate, sourceStatus } from "./shared";

const config = {
  sourceKey: "ebay" as const,
  label: "eBay Browse API",
  noConfigMessage: "eBay: ONLINE_PRICE_EBAY_BROWSE_TOKEN fehlt."
};

export function createEbayAdapter(): OnlinePriceSource {
  return {
    sourceKey: config.sourceKey,
    label: config.label,
    async search(query: string): Promise<OnlinePriceSourceResult> {
      const token = process.env.ONLINE_PRICE_EBAY_BROWSE_TOKEN ?? process.env.ONLINE_PRICE_EBAY_TOKEN;
      if (!token) return noConfig(config);

      try {
        const endpoint =
          process.env.ONLINE_PRICE_EBAY_BROWSE_URL ?? "https://api.ebay.com/buy/browse/v1/item_summary/search";
        const url = new URL(endpoint);
        url.searchParams.set("q", query.slice(0, 100));
        url.searchParams.set("limit", process.env.ONLINE_PRICE_RESULT_LIMIT ?? "12");
        url.searchParams.set("sort", "price");

        const payload = await fetchJson(
          url,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "X-EBAY-C-MARKETPLACE-ID": process.env.ONLINE_PRICE_EBAY_MARKETPLACE_ID ?? "EBAY_DE"
            }
          },
          config
        );

        if (isSourceResult(payload)) return payload;

        const rows = Array.isArray((payload as { itemSummaries?: unknown[] }).itemSummaries)
          ? (payload as { itemSummaries: Record<string, unknown>[] }).itemSummaries
          : [];
        const offers = rows
          .map((row) => {
            const shippingOptions = Array.isArray(row.shippingOptions) ? row.shippingOptions : [];
            const firstShipping = shippingOptions[0] as Record<string, unknown> | undefined;
            const shippingCost = firstShipping?.shippingCost as Record<string, unknown> | undefined;
            const seller = row.seller as Record<string, unknown> | undefined;
            const price = row.price as Record<string, unknown> | undefined;
            const itemLocation = row.itemLocation as Record<string, unknown> | undefined;
            const locationText = [itemLocation?.postalCode, itemLocation?.country]
              .map((part) => String(part ?? "").trim())
              .filter(Boolean)
              .join(", ");

            return normalizeCandidate(config, {
              supplierName: seller?.username ?? "eBay",
              productName: row.title,
              productUrl: row.itemAffiliateWebUrl ?? row.itemWebUrl,
              priceGross: price?.value,
              shippingCost: shippingCost?.value,
              deliveryTimeText: firstShipping?.shippingCostType ?? locationText,
              sourceNote: "eBay Browse API"
            });
          })
          .filter((offer) => offer !== null);

        return {
          offers,
          status: sourceStatus(
            config,
            "ok",
            offers.length > 0 ? `${offers.length} eBay-Angebote gefunden.` : "eBay: keine Angebote gefunden."
          )
        };
      } catch {
        return {
          offers: [],
          status: sourceStatus(config, "unreachable", "eBay: Quelle nicht erreichbar.")
        };
      }
    }
  };
}
