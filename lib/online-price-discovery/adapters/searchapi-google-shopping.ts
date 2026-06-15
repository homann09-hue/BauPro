import type { OnlinePriceSource, OnlinePriceSourceResult } from "@/lib/online-price-discovery/types";
import { fetchJson, findRows, isSourceResult, normalizeGenericRows, sourceStatus } from "./shared";

const config = {
  sourceKey: "searchapi_google_shopping" as const,
  label: "SearchApi Google Shopping",
  noConfigMessage: "SearchApi: ONLINE_PRICE_SEARCHAPI_KEY fehlt."
};

export function createSearchApiGoogleShoppingAdapter(): OnlinePriceSource {
  return {
    sourceKey: config.sourceKey,
    label: config.label,
    async search(query: string): Promise<OnlinePriceSourceResult> {
      const apiKey = process.env.ONLINE_PRICE_SEARCHAPI_KEY;
      if (!apiKey) {
        return {
          offers: [],
          status: sourceStatus(config, "no_config", config.noConfigMessage)
        };
      }

      try {
        const endpoint = process.env.ONLINE_PRICE_SEARCHAPI_URL ?? "https://www.searchapi.io/api/v1/search";
        const url = new URL(endpoint);
        url.searchParams.set("engine", "google_shopping");
        url.searchParams.set("q", query);
        url.searchParams.set("api_key", apiKey);
        url.searchParams.set("gl", process.env.ONLINE_PRICE_COUNTRY ?? "de");
        url.searchParams.set("hl", process.env.ONLINE_PRICE_LANGUAGE_CODE ?? "de");
        url.searchParams.set("location", process.env.ONLINE_PRICE_LOCATION_NAME ?? "Germany");
        url.searchParams.set("sort_by", "price_low_to_high");

        const payload = await fetchJson(url, { headers: { Accept: "application/json" } }, config);
        if (isSourceResult(payload)) return payload;

        const offers = normalizeGenericRows(config, findRows(payload), "SearchApi Google Shopping");
        return {
          offers,
          status: sourceStatus(
            config,
            "ok",
            offers.length > 0 ? `${offers.length} SearchApi-Angebote gefunden.` : "SearchApi: keine Angebote gefunden."
          )
        };
      } catch {
        return {
          offers: [],
          status: sourceStatus(config, "unreachable", "SearchApi: Quelle nicht erreichbar.")
        };
      }
    }
  };
}
