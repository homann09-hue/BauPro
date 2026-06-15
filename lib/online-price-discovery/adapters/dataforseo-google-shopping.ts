import type { OnlinePriceSource, OnlinePriceSourceResult } from "@/lib/online-price-discovery/types";
import { fetchJson, isSourceResult, normalizeCandidate, numberValue, sourceStatus, text } from "./shared";

const config = {
  sourceKey: "dataforseo_google_shopping" as const,
  label: "DataForSEO Google Shopping",
  noConfigMessage: "DataForSEO: ONLINE_PRICE_DATAFORSEO_LOGIN/PASSWORD fehlen."
};

function authHeader(login: string, password: string) {
  return `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`;
}

function extractItems(payload: unknown) {
  const tasks = (payload as { tasks?: Array<{ result?: Array<{ items?: unknown[] }> }> }).tasks ?? [];
  const items = tasks.flatMap((task) => task.result?.flatMap((result) => result.items ?? []) ?? []);
  return items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

export function createDataForSeoGoogleShoppingAdapter(): OnlinePriceSource {
  return {
    sourceKey: config.sourceKey,
    label: config.label,
    async search(query: string): Promise<OnlinePriceSourceResult> {
      const login = process.env.ONLINE_PRICE_DATAFORSEO_LOGIN;
      const password = process.env.ONLINE_PRICE_DATAFORSEO_PASSWORD;
      if (!login || !password) {
        return {
          offers: [],
          status: sourceStatus(config, "no_config", config.noConfigMessage)
        };
      }

      try {
        const endpoint =
          process.env.ONLINE_PRICE_DATAFORSEO_URL ??
          "https://api.dataforseo.com/v3/serp/google/shopping/live/advanced";
        const payload = await fetchJson(
          new URL(endpoint),
          {
            method: "POST",
            headers: {
              Authorization: authHeader(login, password),
              "Content-Type": "application/json"
            },
            body: JSON.stringify([
              {
                keyword: query,
                location_name: process.env.ONLINE_PRICE_LOCATION_NAME ?? "Germany",
                language_code: process.env.ONLINE_PRICE_LANGUAGE_CODE ?? "de",
                depth: Number(process.env.ONLINE_PRICE_RESULT_LIMIT ?? 12)
              }
            ])
          },
          config
        );

        if (isSourceResult(payload)) return payload;

        const offers = extractItems(payload)
          .map((item) => {
            const price = item.price as Record<string, unknown> | undefined;
            return normalizeCandidate(config, {
              supplierName: item.seller ?? item.domain ?? item.shop,
              productName: item.title,
              productUrl: item.url ?? item.link,
              priceGross: price?.current ?? item.price,
              shippingCost: numberValue(item.delivery_price),
              deliveryTimeText: text(item.delivery_info ?? item.delivery_message),
              sourceNote: "DataForSEO Google Shopping"
            });
          })
          .filter((offer) => offer !== null);

        return {
          offers,
          status: sourceStatus(
            config,
            "ok",
            offers.length > 0 ? `${offers.length} Google-Shopping-Angebote gefunden.` : "DataForSEO: keine Angebote gefunden."
          )
        };
      } catch {
        return {
          offers: [],
          status: sourceStatus(config, "unreachable", "DataForSEO: Quelle nicht erreichbar.")
        };
      }
    }
  };
}
