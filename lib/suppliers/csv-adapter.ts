import type { SupplierProviderKey } from "@/types/app";
import { ManualSupplierAdapter } from "@/lib/suppliers/manual-adapter";
import type { SupplierAdapter, SupplierAdapterContext, SupplierOfferInput } from "@/lib/suppliers/types";

function splitCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function detectDelimiter(headerLine: string) {
  const semicolonCount = headerLine.split(";").length;
  const commaCount = headerLine.split(",").length;
  return semicolonCount >= commaCount ? ";" : ",";
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const headerAliases: Record<string, string> = {
  lieferant: "supplier_name",
  supplier: "supplier_name",
  supplier_name: "supplier_name",
  produkt: "product_name",
  produktname: "product_name",
  product_name: "product_name",
  name: "product_name",
  hersteller: "manufacturer",
  manufacturer: "manufacturer",
  kategorie: "category",
  category: "category",
  einheit: "unit",
  unit: "unit",
  packung: "package_size",
  package_size: "package_size",
  preis_netto: "price_net",
  ek_netto: "price_net",
  price_net: "price_net",
  netto: "price_net",
  preis_brutto: "price_gross",
  price_gross: "price_gross",
  brutto: "price_gross",
  waehrung: "currency",
  currency: "currency",
  mwst: "vat_rate",
  vat_rate: "vat_rate",
  versand: "shipping_cost",
  shipping: "shipping_cost",
  shipping_cost: "shipping_cost",
  lieferzeit: "delivery_time_text",
  delivery_time: "delivery_time_text",
  lieferzeit_min: "delivery_time_days_min",
  lieferzeit_max: "delivery_time_days_max",
  bestand: "stock_status",
  verfuegbarkeit: "stock_status",
  stock_status: "stock_status",
  url: "product_url",
  produkt_url: "product_url",
  product_url: "product_url",
  bild: "image_url",
  image_url: "image_url",
  sku: "external_product_id",
  artikelnummer: "external_product_id",
  external_product_id: "external_product_id"
};

export function parseSupplierCsv(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitCsvLine(lines[0], delimiter).map((header) => {
    const normalized = normalizeHeader(header);
    return headerAliases[normalized] ?? normalized;
  });

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = cells[index] ?? "";
      return row;
    }, {});
  });
}

export class CsvSupplierAdapter implements SupplierAdapter {
  providerKey: SupplierProviderKey = "csv";
  private manual: ManualSupplierAdapter;

  constructor(private context: SupplierAdapterContext = { providerKey: "csv" }) {
    this.providerKey = context.providerKey;
    this.manual = new ManualSupplierAdapter({
      ...context,
      providerKey: context.providerKey
    });
  }

  async fetchOffers() {
    return [] as SupplierOfferInput[];
  }

  normalizeOffer(raw: unknown): SupplierOfferInput {
    return {
      ...this.manual.normalizeOffer(raw),
      provider_key: this.providerKey,
      source_type: "csv"
    };
  }

  parse(csvText: string) {
    return parseSupplierCsv(csvText).map((row) => this.normalizeOffer(row));
  }
}
