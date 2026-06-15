import type { OnlinePriceSource, OnlinePriceSourceResult } from "@/lib/online-price-discovery/types";
import { fetchJson, findRows, isSourceResult, noConfig, normalizeGenericRows, sourceStatus } from "./shared";

const config = {
  sourceKey: "priceapi" as const,
  label: "PriceAPI",
  noConfigMessage: "PriceAPI: ONLINE_PRICE_PRICEAPI_URL und ONLINE_PRICE_PRICEAPI_TOKEN fehlen."
};

export function createPriceApiAdapter(): OnlinePriceSource {
  return {
    sourceKey: config.sourceKey,
    label: config.label,
    async search(query: string): Promise<OnlinePriceSourceResult> {
      const endpoint = process.env.ONLINE_PRICE_PRICEAPI_URL;
      const token = process.env.ONLINE_PRICE_PRICEAPI_TOKEN;
      if (!endpoint || !token) return noConfig(config);

      try {
        const url = new URL(endpoint);
        url.searchParams.set("q", query);
        url.searchParams.set("country", process.env.ONLINE_PRICE_COUNTRY ?? "de");
        url.searchParams.set("currency", "EUR");

        const payload = await fetchJson(
          url,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/json"
            }
          },
          config
        );

        if (isSourceResult(payload)) return payload;

        const offers = normalizeGenericRows(config, findRows(payload), "PriceAPI");
        return {
          offers,
          status: sourceStatus(
            config,
            "ok",
            offers.length > 0 ? `${offers.length} PriceAPI-Angebote gefunden.` : "PriceAPI: keine Angebote gefunden."
          )
        };
      } catch {
        return {
          offers: [],
          status: sourceStatus(config, "unreachable", "PriceAPI: Quelle nicht erreichbar.")
        };
      }
    }
  };
}
