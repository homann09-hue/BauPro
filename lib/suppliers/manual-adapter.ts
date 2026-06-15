import type { SupplierAdapter, SupplierAdapterContext, SupplierOfferInput } from "@/lib/suppliers/types";

function asRecord(raw: unknown) {
  return raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
}

function text(value: unknown, fallback = "") {
  return String(value ?? fallback).trim();
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class ManualSupplierAdapter implements SupplierAdapter {
  providerKey = "manual" as const;

  constructor(private context: SupplierAdapterContext = { providerKey: "manual" }) {}

  async fetchOffers() {
    return [] as SupplierOfferInput[];
  }

  normalizeOffer(raw: unknown): SupplierOfferInput {
    const row = asRecord(raw);
    const priceGross = numberValue(row.price_gross ?? row.priceGross ?? row.bruttopreis);
    const shippingCost = numberValue(row.shipping_cost ?? row.shippingCost ?? row.versand, 0);

    return {
      provider_key: this.context.providerKey,
      supplier_integration_id: text(row.supplier_integration_id) || null,
      supplier_name: text(row.supplier_name ?? row.supplierName ?? row.lieferant, this.context.supplierName ?? "Manuell"),
      external_product_id: text(row.external_product_id ?? row.sku ?? row.artikelnummer) || null,
      product_name: text(row.product_name ?? row.productName ?? row.produkt),
      manufacturer: text(row.manufacturer ?? row.hersteller) || null,
      category: text(row.category ?? row.kategorie) || null,
      unit: text(row.unit ?? row.einheit, "Stueck"),
      package_size: numberValue(row.package_size ?? row.packageSize ?? row.packung, 0) || null,
      price_net: numberValue(row.price_net ?? row.priceNet ?? row.nettopreis, 0) || null,
      price_gross: priceGross,
      currency: text(row.currency ?? row.waehrung, "EUR"),
      vat_rate: numberValue(row.vat_rate ?? row.vatRate ?? row.mwst, 19),
      shipping_cost: shippingCost,
      delivery_time_text: text(row.delivery_time_text ?? row.deliveryTime ?? row.lieferzeit) || null,
      delivery_time_days_min: numberValue(row.delivery_time_days_min ?? row.deliveryMin, 0) || null,
      delivery_time_days_max: numberValue(row.delivery_time_days_max ?? row.deliveryMax, 0) || null,
      stock_status: text(row.stock_status ?? row.stockStatus ?? row.verfuegbarkeit) || null,
      product_url: text(row.product_url ?? row.productUrl ?? row.url) || null,
      image_url: text(row.image_url ?? row.imageUrl ?? row.bild) || null,
      valid_until: text(row.valid_until ?? row.validUntil) || null,
      source_type: "manual"
    };
  }
}
