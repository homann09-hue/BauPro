import { parseSupplierCsv } from "@/lib/suppliers/csv-adapter";
import type { OnlinePriceSource, OnlinePriceSourceResult } from "@/lib/online-price-discovery/types";
import {
  normalizeCandidate,
  numberValue,
  queryMatchesRow,
  sourceStatus,
  text,
  type OnlinePriceAdapterConfig
} from "./shared";

type CsvAdapterOptions = OnlinePriceAdapterConfig & {
  urlEnvKey: string;
  tokenEnvKey?: string;
  defaultSupplierName: string;
};

function rowValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = text(row[key]);
    if (value) return value;
  }
  return null;
}

function csvGrossPrice(row: Record<string, string>) {
  const gross = rowValue(row, ["price_gross", "preis_brutto", "brutto"]);
  if (gross) return gross;

  const net = rowValue(row, ["price_net", "ek_netto", "netto"]);
  return net ? Math.round(numberValue(net) * 119) / 100 : null;
}

export function createCsvCatalogAdapter(options: CsvAdapterOptions): OnlinePriceSource {
  return {
    sourceKey: options.sourceKey,
    label: options.label,
    async search(query: string): Promise<OnlinePriceSourceResult> {
      const csvUrl = process.env[options.urlEnvKey];
      const token = options.tokenEnvKey ? process.env[options.tokenEnvKey] : null;
      if (!csvUrl) {
        return {
          offers: [],
          status: sourceStatus(options, "no_config", options.noConfigMessage)
        };
      }

      try {
        const response = await fetch(csvUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          cache: "no-store"
        });

        if (!response.ok) {
          return {
            offers: [],
            status: sourceStatus(options, "unreachable", `${options.label}: CSV nicht erreichbar (${response.status}).`)
          };
        }

        const rows = parseSupplierCsv(await response.text())
          .map((row) =>
            Object.entries(row).reduce<Record<string, string>>((result, [key, value]) => {
              result[key] = String(value ?? "");
              return result;
            }, {})
          )
          .filter((row) => queryMatchesRow(query, row));

        const offers = rows
          .slice(0, Number(process.env.ONLINE_PRICE_RESULT_LIMIT ?? 12))
          .map((row) =>
            normalizeCandidate(options, {
              supplierName: rowValue(row, ["supplier_name", "supplier", "lieferant"]) ?? options.defaultSupplierName,
              productName: rowValue(row, ["product_name", "name", "produkt", "produktname"]),
              productUrl: rowValue(row, ["product_url", "url"]),
              priceGross: csvGrossPrice(row),
              shippingCost: rowValue(row, ["shipping_cost", "versand"]),
              deliveryTimeText: rowValue(row, ["delivery_time_text", "lieferzeit"]),
              sourceNote: `${options.label} CSV`
            })
          )
          .filter((offer) => offer !== null);

        return {
          offers,
          status: sourceStatus(
            options,
            "ok",
            offers.length > 0 ? `${offers.length} CSV-Angebote gefunden.` : `${options.label}: keine passenden CSV-Angebote gefunden.`
          )
        };
      } catch {
        return {
          offers: [],
          status: sourceStatus(options, "unreachable", `${options.label}: CSV konnte nicht gelesen werden.`)
        };
      }
    }
  };
}
