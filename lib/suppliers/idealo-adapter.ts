import type { SupplierProviderKey } from "@/types/app";
import type { SupplierAdapter, SupplierAdapterContext, SupplierOfferInput } from "@/lib/suppliers/types";
import { SupplierIntegrationError } from "@/lib/suppliers/types";

export class OfficialFeedAdapter implements SupplierAdapter {
  providerKey: SupplierProviderKey;

  constructor(
    private context: SupplierAdapterContext,
    private providerName: string
  ) {
    this.providerKey = context.providerKey;
  }

  async fetchOffers(): Promise<SupplierOfferInput[]> {
    if (!this.context.apiKey) {
      throw new SupplierIntegrationError(
        `${this.providerName} braucht einen offiziellen API-Zugang, Affiliate-Feed oder CSV-Export. Geschuetzte Shops werden nicht gescraped.`
      );
    }

    throw new SupplierIntegrationError(
      `${this.providerName} ist vorbereitet, aber noch nicht mit einem konkreten offiziellen Feed-Endpunkt konfiguriert.`
    );
  }

  async fetchProduct() {
    if (!this.context.apiKey) {
      throw new SupplierIntegrationError(
        `${this.providerName} braucht einen offiziellen API-Zugang, Affiliate-Feed oder CSV-Export.`
      );
    }

    return null;
  }

  normalizeOffer(raw: unknown): SupplierOfferInput {
    if (!raw || typeof raw !== "object") {
      throw new SupplierIntegrationError(`${this.providerName}: Angebot konnte nicht normalisiert werden.`);
    }

    const row = raw as Record<string, unknown>;
    const priceGross = Number(row.price_gross ?? row.priceGross ?? row.price);

    if (!row.product_name && !row.productName && !row.name) {
      throw new SupplierIntegrationError(`${this.providerName}: Produktname fehlt im Feed.`);
    }

    if (!Number.isFinite(priceGross)) {
      throw new SupplierIntegrationError(`${this.providerName}: Bruttopreis fehlt im Feed.`);
    }

    return {
      provider_key: this.providerKey,
      supplier_name: String(row.supplier_name ?? row.supplierName ?? this.providerName),
      external_product_id: row.external_product_id ? String(row.external_product_id) : null,
      product_name: String(row.product_name ?? row.productName ?? row.name),
      manufacturer: row.manufacturer ? String(row.manufacturer) : null,
      category: row.category ? String(row.category) : null,
      unit: String(row.unit ?? "Stueck"),
      package_size: row.package_size ? Number(row.package_size) : null,
      price_net: row.price_net ? Number(row.price_net) : null,
      price_gross: priceGross,
      currency: String(row.currency ?? "EUR"),
      vat_rate: Number(row.vat_rate ?? 19),
      shipping_cost: Number(row.shipping_cost ?? 0),
      delivery_time_text: row.delivery_time_text ? String(row.delivery_time_text) : null,
      delivery_time_days_min: row.delivery_time_days_min ? Number(row.delivery_time_days_min) : null,
      delivery_time_days_max: row.delivery_time_days_max ? Number(row.delivery_time_days_max) : null,
      stock_status: row.stock_status ? String(row.stock_status) : null,
      product_url: row.product_url ? String(row.product_url) : null,
      image_url: row.image_url ? String(row.image_url) : null,
      valid_until: row.valid_until ? String(row.valid_until) : null,
      source_type: "api"
    };
  }
}

export class IdealoAdapter extends OfficialFeedAdapter {
  constructor(context: SupplierAdapterContext) {
    super({ ...context, providerKey: "idealo" }, "idealo");
  }
}
