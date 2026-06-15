import type { SupplierOfferSourceType, SupplierProviderKey } from "@/types/app";

export type SupplierOfferInput = {
  provider_key: SupplierProviderKey;
  supplier_name: string;
  supplier_integration_id?: string | null;
  external_product_id?: string | null;
  product_name: string;
  manufacturer?: string | null;
  category?: string | null;
  unit: string;
  package_size?: number | null;
  price_net?: number | null;
  price_gross: number;
  currency: string;
  vat_rate: number;
  shipping_cost: number;
  delivery_time_text?: string | null;
  delivery_time_days_min?: number | null;
  delivery_time_days_max?: number | null;
  stock_status?: string | null;
  product_url?: string | null;
  image_url?: string | null;
  last_checked_at?: string;
  valid_until?: string | null;
  source_type: SupplierOfferSourceType;
};

export type SupplierAdapterContext = {
  providerKey: SupplierProviderKey;
  apiKey?: string | null;
  baseUrl?: string | null;
  supplierName?: string | null;
};

export interface SupplierAdapter {
  providerKey: SupplierProviderKey;
  fetchOffers(query: string): Promise<SupplierOfferInput[]>;
  fetchProduct?(externalProductId: string): Promise<SupplierOfferInput | null>;
  normalizeOffer(raw: unknown): SupplierOfferInput;
}

export class SupplierIntegrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupplierIntegrationError";
  }
}
