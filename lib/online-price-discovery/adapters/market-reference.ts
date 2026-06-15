import type { OnlinePriceSource, OnlinePriceSourceResult } from "@/lib/online-price-discovery/types";
import { normalizeCandidate, queryMatchesRow, sourceStatus } from "./shared";

const builtInMarketReferenceRows: Array<Record<string, string | number | null>> = [
  {
    product_name: "Spenglerschrauben V2A 4,5 x 35 mm, 100 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 14.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "spenglerschrauben edelstahl v2a schrauben dach blech befestigung 4,5x35"
  },
  {
    product_name: "Spenglerschrauben V2A 4,5 x 45 mm, 100 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 17.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "spenglerschrauben edelstahl v2a schrauben dach blech befestigung 4,5x45"
  },
  {
    product_name: "Holzbauschrauben TX 6 x 80 mm, 100 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 21.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "holzschrauben holzbauschrauben schrauben latten befestigung 6x80"
  },
  {
    product_name: "Holzbauschrauben TX 8 x 120 mm, 50 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 26.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "holzschrauben holzbauschrauben schrauben dachstuhl befestigung 8x120"
  },
  {
    product_name: "Fischer UX Universalduebel 8 x 50 mm, 100 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 12.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "fischer duebel ux universalduebel befestigung 8x50"
  },
  {
    product_name: "Fischer SX Plus Duebel 8 x 40 mm, 100 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 11.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "fischer duebel sx befestigung 8x40"
  },
  {
    product_name: "Wuerth ASSY Holzschrauben 5 x 80 mm, 200 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 34.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "wuerth assy holzschrauben schrauben 5x80"
  },
  {
    product_name: "Trennscheiben Metall 125 x 1,0 mm, 25 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 18.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "trennscheiben flexscheiben metall 125 1,0 winkelschleifer"
  },
  {
    product_name: "Diamant-Trennscheibe 125 mm Universal",
    supplier_name: "Markt-Richtpreis",
    price_gross: 19.9,
    shipping_cost: 0,
    unit: "Stueck",
    keywords: "diamant trennscheibe trennscheiben dachziegel beton stein 125"
  },
  {
    product_name: "Saebelsaegeblaetter Metall, 5 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 16.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "saegeblaetter saebelsaege metall blech schneiden"
  },
  {
    product_name: "Kreissaegeblatt Holz 160 mm, 48 Zaehne",
    supplier_name: "Markt-Richtpreis",
    price_gross: 24.9,
    shipping_cost: 0,
    unit: "Stueck",
    keywords: "saegeblatt kreissaege holz 160"
  },
  {
    product_name: "PU-Dichtstoff grau 310 ml",
    supplier_name: "Markt-Richtpreis",
    price_gross: 8.9,
    shipping_cost: 0,
    unit: "Kartusche",
    keywords: "dichtstoff pu dichtmasse kartusche grau abdichtung dach"
  },
  {
    product_name: "MS-Polymer Dicht- und Klebstoff 290 ml",
    supplier_name: "Markt-Richtpreis",
    price_gross: 11.9,
    shipping_cost: 0,
    unit: "Kartusche",
    keywords: "dichtstoff klebstoff ms polymer dichtmasse kartusche"
  },
  {
    product_name: "Butyl-Klebeband 50 mm x 10 m",
    supplier_name: "Markt-Richtpreis",
    price_gross: 14.9,
    shipping_cost: 0,
    unit: "Rolle",
    keywords: "klebeband butyl band dichtband anschluss abdichtung"
  },
  {
    product_name: "Unterspannbahn-Klebeband 60 mm x 25 m",
    supplier_name: "Markt-Richtpreis",
    price_gross: 19.9,
    shipping_cost: 0,
    unit: "Rolle",
    keywords: "klebeband unterspannbahn folienband dachbahn winddicht"
  },
  {
    product_name: "Nitril-Arbeitshandschuhe, 12 Paar",
    supplier_name: "Markt-Richtpreis",
    price_gross: 22.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "arbeitsschutz handschuhe arbeitshandschuhe nitril dachdecker"
  },
  {
    product_name: "Schutzbrille klar",
    supplier_name: "Markt-Richtpreis",
    price_gross: 6.9,
    shipping_cost: 0,
    unit: "Stueck",
    keywords: "arbeitsschutz schutzbrille brille augenschutz"
  },
  {
    product_name: "FFP2 Staubmasken, 20 Stueck",
    supplier_name: "Markt-Richtpreis",
    price_gross: 16.9,
    shipping_cost: 0,
    unit: "Packung",
    keywords: "arbeitsschutz staubmaske ffp2 maske atemschutz"
  },
  {
    product_name: "Gasbrenner Schlauch 5 m",
    supplier_name: "Markt-Richtpreis",
    price_gross: 29.9,
    shipping_cost: 0,
    unit: "Stueck",
    keywords: "gasbrenner zubehoer schlauch propan brenner"
  },
  {
    product_name: "Propan-Druckregler 2,5 bar",
    supplier_name: "Markt-Richtpreis",
    price_gross: 24.9,
    shipping_cost: 0,
    unit: "Stueck",
    keywords: "gasbrenner zubehoer druckregler propan brenner"
  }
];

const config = {
  sourceKey: "market_reference" as const,
  label: "Markt-Richtpreis",
  noConfigMessage: "Markt-Richtpreis: interner Richtpreiskatalog wird genutzt."
};

async function loadReferenceRows() {
  const inlineJson = process.env.ONLINE_PRICE_MARKET_REFERENCE_JSON;
  if (inlineJson) {
    try {
      const parsed = JSON.parse(inlineJson) as unknown;
      return Array.isArray(parsed) ? parsed : builtInMarketReferenceRows;
    } catch {
      return builtInMarketReferenceRows;
    }
  }

  const url = process.env.ONLINE_PRICE_MARKET_REFERENCE_URL;
  if (!url) return builtInMarketReferenceRows;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return builtInMarketReferenceRows;
  const parsed = (await response.json()) as unknown;
  return Array.isArray(parsed) ? parsed : builtInMarketReferenceRows;
}

export function createMarketReferenceAdapter(): OnlinePriceSource {
  return {
    sourceKey: config.sourceKey,
    label: config.label,
    async search(query: string): Promise<OnlinePriceSourceResult> {
      try {
        const rows = await loadReferenceRows();

        const offers = rows
          .filter((row): row is Record<string, string | number | null> => Boolean(row) && typeof row === "object")
          .map((row) => {
            const stringRow = Object.entries(row).reduce<Record<string, string>>((result, [key, value]) => {
              result[key] = String(value ?? "");
              return result;
            }, {});
            return { row, stringRow };
          })
          .filter(({ stringRow }) => queryMatchesRow(query, stringRow))
          .slice(0, Number(process.env.ONLINE_PRICE_RESULT_LIMIT ?? 12))
          .map(({ row }) =>
            normalizeCandidate(config, {
              supplierName: "Markt-Richtpreis",
              productName: row.product_name ?? row.name ?? row.title,
              productUrl: row.product_url ?? row.url,
              priceGross: row.price_gross ?? row.price ?? row.market_price,
              shippingCost: row.shipping_cost ?? 0,
              deliveryTimeText: row.delivery_time_text ?? null,
              sourceNote: "Markt-Richtpreis, kein Live-Angebot. Vor Bestellung pruefen."
            })
          )
          .filter((offer) => offer !== null);

        return {
          offers,
          status: sourceStatus(
            config,
            "ok",
            offers.length > 0
              ? `${offers.length} Markt-Richtpreise gefunden.`
              : "Markt-Richtpreis: kein passender Richtpreis."
          )
        };
      } catch {
        return {
          offers: [],
          status: sourceStatus(config, "error", "Markt-Richtpreis: Konfiguration konnte nicht gelesen werden.")
        };
      }
    }
  };
}
