import type { OnlinePriceSourceKey } from "@/types/app";
import type { OnlinePriceCandidate, OnlinePriceSourceResult } from "@/lib/online-price-discovery/types";

type CandidateInput = {
  supplierName?: unknown;
  productName?: unknown;
  productUrl?: unknown;
  priceGross?: unknown;
  shippingCost?: unknown;
  deliveryTimeText?: unknown;
  sourceNote?: unknown;
};

export type OnlinePriceAdapterConfig = {
  sourceKey: OnlinePriceSourceKey;
  label: string;
  noConfigMessage: string;
};

export function text(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

export function numberValue(value: unknown, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const cleaned = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function sourceStatus(
  config: Pick<OnlinePriceAdapterConfig, "sourceKey" | "label">,
  status: OnlinePriceSourceResult["status"]["status"],
  message: string
) {
  return {
    sourceKey: config.sourceKey,
    label: config.label,
    status,
    message
  };
}

export function noConfig(config: OnlinePriceAdapterConfig): OnlinePriceSourceResult {
  return {
    offers: [],
    status: sourceStatus(config, "no_config", config.noConfigMessage)
  };
}

export function normalizeCandidate(
  config: Pick<OnlinePriceAdapterConfig, "sourceKey" | "label">,
  input: CandidateInput
): OnlinePriceCandidate | null {
  const productName = text(input.productName);
  const priceGross = numberValue(input.priceGross);

  if (!productName || priceGross <= 0) return null;

  return {
    sourceKey: config.sourceKey,
    supplierName: text(input.supplierName) ?? config.label,
    productName,
    productUrl: text(input.productUrl),
    priceGross,
    shippingCost: Math.max(0, numberValue(input.shippingCost, 0)),
    deliveryTimeText: text(input.deliveryTimeText),
    checkedAt: new Date().toISOString(),
    sourceNote: text(input.sourceNote)
  };
}

export function findRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) {
    return payload.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }

  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const candidates = [
    record.offers,
    record.results,
    record.items,
    record.products,
    record.shopping_results,
    record.product_results
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
    }
  }

  return [];
}

export function normalizeGenericRows(
  config: Pick<OnlinePriceAdapterConfig, "sourceKey" | "label">,
  rows: Record<string, unknown>[],
  sourceNote?: string
) {
  return rows
    .map((row) =>
      normalizeCandidate(config, {
        supplierName:
          row.supplier_name ?? row.supplierName ?? row.seller ?? row.shop ?? row.merchant ?? row.store ?? row.source,
        productName: row.product_name ?? row.productName ?? row.name ?? row.title,
        productUrl: row.product_url ?? row.productUrl ?? row.url ?? row.link,
        priceGross: row.price_gross ?? row.priceGross ?? row.price ?? row.gross_price ?? row.extracted_price,
        shippingCost: row.shipping_cost ?? row.shippingCost ?? row.shipping ?? row.delivery_price,
        deliveryTimeText: row.delivery_time_text ?? row.deliveryTime ?? row.delivery ?? row.delivery_time,
        sourceNote: row.source_note ?? row.note ?? sourceNote
      })
    )
    .filter((offer): offer is OnlinePriceCandidate => offer !== null);
}

function normalizeSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function searchWordVariants(word: string) {
  const variants = new Set([word]);
  const baenderSuffix = "baender";
  const blaetterSuffix = "blaetter";
  if (word.endsWith("en") && word.length > 4) variants.add(word.slice(0, -2));
  if (word.endsWith("er") && word.length > 4) variants.add(word.slice(0, -2));
  if (word.endsWith("e") && word.length > 4) variants.add(word.slice(0, -1));
  if (word.endsWith("s") && word.length > 4) variants.add(word.slice(0, -1));
  if (word.endsWith(baenderSuffix)) variants.add(`${word.slice(0, -baenderSuffix.length)}band`);
  if (word.endsWith(blaetterSuffix)) variants.add(`${word.slice(0, -blaetterSuffix.length)}blatt`);
  return Array.from(variants).filter((variant) => variant.length > 2);
}

export function queryMatchesRow(query: string, row: Record<string, string>) {
  const haystack = normalizeSearchText(Object.values(row).join(" "));
  const words = normalizeSearchText(query)
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 2);

  return words.length === 0 || words.some((word) => searchWordVariants(word).some((variant) => haystack.includes(variant)));
}

export async function fetchJson(
  url: URL,
  init: RequestInit,
  config: Pick<OnlinePriceAdapterConfig, "sourceKey" | "label">
): Promise<OnlinePriceSourceResult | unknown> {
  const response = await fetch(url, { ...init, cache: "no-store" });

  if (!response.ok) {
    return {
      offers: [],
      status: sourceStatus(config, "unreachable", `${config.label}: Quelle nicht erreichbar (${response.status}).`)
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      offers: [],
      status: sourceStatus(config, "error", `${config.label}: Antwort ist kein JSON.`)
    };
  }

  return response.json();
}

export function isSourceResult(value: unknown): value is OnlinePriceSourceResult {
  return Boolean(value && typeof value === "object" && "offers" in value && "status" in value);
}
