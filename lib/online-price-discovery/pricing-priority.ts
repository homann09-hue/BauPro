import type { InventoryItem, OnlinePriceDiscovery, SupplierOffer } from "@/types/app";

export type MaterialPriceDecision = {
  label: string;
  source: "own_purchase_price" | "supplier_offer" | "online_average" | "market_reference";
  value: number | null;
};

export function resolveMaterialPriceDecision({
  material,
  supplierOffers,
  latestDiscovery,
  marketReferencePrice
}: {
  material: Pick<InventoryItem, "purchase_price">;
  supplierOffers: SupplierOffer[];
  latestDiscovery: OnlinePriceDiscovery | null;
  marketReferencePrice?: number | null;
}): MaterialPriceDecision {
  if (material.purchase_price !== null && material.purchase_price !== undefined) {
    return {
      label: "Eigener EK",
      source: "own_purchase_price",
      value: Number(material.purchase_price)
    };
  }

  const cheapestSupplierOffer = [...supplierOffers].sort(
    (a, b) => Number(a.total_price_gross ?? 0) - Number(b.total_price_gross ?? 0)
  )[0];

  if (cheapestSupplierOffer) {
    return {
      label: "Lieferantenpreis",
      source: "supplier_offer",
      value: Number(cheapestSupplierOffer.price_net ?? cheapestSupplierOffer.total_price_gross)
    };
  }

  if (latestDiscovery?.average_price_gross) {
    return {
      label: "Online-Angebotsdurchschnitt",
      source: "online_average",
      value: Number(latestDiscovery.average_price_gross)
    };
  }

  return {
    label: "Markt-Richtpreis",
    source: "market_reference",
    value: marketReferencePrice ?? null
  };
}
