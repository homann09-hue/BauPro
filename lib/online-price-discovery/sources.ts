import { createCsvCatalogAdapter } from "@/lib/online-price-discovery/adapters/csv-catalog";
import { createDataForSeoGoogleShoppingAdapter } from "@/lib/online-price-discovery/adapters/dataforseo-google-shopping";
import { createEbayAdapter } from "@/lib/online-price-discovery/adapters/ebay";
import { createMarketReferenceAdapter } from "@/lib/online-price-discovery/adapters/market-reference";
import { createPriceApiAdapter } from "@/lib/online-price-discovery/adapters/priceapi";
import { createSearchApiGoogleShoppingAdapter } from "@/lib/online-price-discovery/adapters/searchapi-google-shopping";
import type { OnlinePriceSource } from "@/lib/online-price-discovery/types";

export function createOnlinePriceSources(): OnlinePriceSource[] {
  return [
    createCsvCatalogAdapter({
      sourceKey: "wuerth_catalog_csv",
      label: "Wuerth Katalog CSV",
      urlEnvKey: "ONLINE_PRICE_WUERTH_CATALOG_CSV_URL",
      tokenEnvKey: "ONLINE_PRICE_WUERTH_CATALOG_CSV_TOKEN",
      defaultSupplierName: "Wuerth",
      noConfigMessage: "Wuerth CSV: ONLINE_PRICE_WUERTH_CATALOG_CSV_URL fehlt."
    }),
    createCsvCatalogAdapter({
      sourceKey: "manual_csv",
      label: "Manuelle CSV-Preisliste",
      urlEnvKey: "ONLINE_PRICE_MANUAL_CSV_URL",
      tokenEnvKey: "ONLINE_PRICE_MANUAL_CSV_TOKEN",
      defaultSupplierName: "CSV-Preisliste",
      noConfigMessage: "Manuelle CSV: ONLINE_PRICE_MANUAL_CSV_URL fehlt."
    }),
    createEbayAdapter(),
    createPriceApiAdapter(),
    createDataForSeoGoogleShoppingAdapter(),
    createSearchApiGoogleShoppingAdapter(),
    createMarketReferenceAdapter()
  ];
}
