import type { InventoryItem, SupplierOffer } from "@/types/app";

type MatchMaterial = Pick<
  InventoryItem,
  "name" | "manufacturer" | "unit" | "article_number"
> & {
  category_name?: string | null;
  subcategory_name?: string | null;
  search_terms?: string[] | null;
};

type MatchOffer = Pick<SupplierOffer, "product_name" | "manufacturer" | "category" | "unit" | "external_product_id">;

const synonymMap: Record<string, string> = {
  v2a: "edelstahl",
  inox: "edelstahl",
  edelstahl: "edelstahl",
  schrauben: "schraube",
  spenglerschrauben: "spenglerschraube",
  dichtstoffe: "dichtstoff",
  trennscheiben: "trennscheibe",
  saegeblaetter: "saegeblatt",
  sägeblätter: "saegeblatt",
  mm: "mm"
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/,/g, ".")
    .replace(/(\d)\s*x\s*(\d)/g, "$1x$2")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();
}

function tokens(value?: string | null) {
  return normalizeText(value)
    .split(/\s+/)
    .filter((token) => token.length >= 2)
    .map((token) => synonymMap[token] ?? token);
}

function tokenSet(value?: string | null) {
  return new Set(tokens(value));
}

function overlapScore(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return 0;
  let hits = 0;
  for (const token of left) {
    if (right.has(token)) hits += 1;
  }

  return hits / Math.max(left.size, right.size);
}

function exactish(left?: string | null, right?: string | null) {
  const a = normalizeText(left);
  const b = normalizeText(right);
  return a && b && (a === b || a.includes(b) || b.includes(a));
}

export function calculateSupplierMatchScore(material: MatchMaterial, offer: MatchOffer) {
  const materialText = [
    material.name,
    material.manufacturer,
    material.article_number,
    material.category_name,
    material.subcategory_name,
    ...(material.search_terms ?? [])
  ].join(" ");
  const offerText = [offer.product_name, offer.manufacturer, offer.external_product_id, offer.category].join(" ");

  const nameOverlap = overlapScore(tokenSet(materialText), tokenSet(offerText));
  let score = Math.round(nameOverlap * 70);

  if (exactish(material.manufacturer, offer.manufacturer)) score += 15;
  if (exactish(material.unit, offer.unit)) score += 8;
  if (exactish(material.category_name, offer.category) || exactish(material.subcategory_name, offer.category)) score += 7;

  return Math.max(0, Math.min(100, score));
}

export function bestDealScore(offer: Pick<SupplierOffer, "total_price_gross" | "delivery_time_days_min" | "delivery_time_days_max">) {
  const deliveryDays = Number(offer.delivery_time_days_min ?? offer.delivery_time_days_max ?? 14);
  return Number(offer.total_price_gross ?? 0) + Math.max(0, deliveryDays) * 1.5;
}

export function sortBestDeal<T extends Pick<SupplierOffer, "total_price_gross" | "delivery_time_days_min" | "delivery_time_days_max">>(
  offers: T[]
) {
  return [...offers].sort((a, b) => bestDealScore(a) - bestDealScore(b));
}
