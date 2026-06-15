import type { SupplierProviderKey } from "@/types/app";

export type SupplierProviderConfig = {
  providerKey: SupplierProviderKey;
  name: string;
  supportsApi: boolean;
  supportsCsv: boolean;
  supportsAffiliateFeed: boolean;
  requiresApiKey: boolean;
  enabledByDefault: boolean;
  documentationUrl?: string;
};

export const supplierProviders: SupplierProviderConfig[] = [
  {
    providerKey: "manual",
    name: "Manuelle Angebote",
    supportsApi: false,
    supportsCsv: false,
    supportsAffiliateFeed: false,
    requiresApiKey: false,
    enabledByDefault: true
  },
  {
    providerKey: "csv",
    name: "CSV-Import",
    supportsApi: false,
    supportsCsv: true,
    supportsAffiliateFeed: false,
    requiresApiKey: false,
    enabledByDefault: true
  },
  {
    providerKey: "idealo",
    name: "idealo",
    supportsApi: true,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: true,
    enabledByDefault: false,
    documentationUrl: "https://partner.idealo.com/"
  },
  {
    providerKey: "geizhals",
    name: "Geizhals",
    supportsApi: true,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: true,
    enabledByDefault: false,
    documentationUrl: "https://geizhals.de/"
  },
  {
    providerKey: "google_shopping",
    name: "Google Shopping",
    supportsApi: true,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: true,
    enabledByDefault: false,
    documentationUrl: "https://developers.google.com/shopping-content"
  },
  {
    providerKey: "ebay",
    name: "eBay",
    supportsApi: true,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: true,
    enabledByDefault: false,
    documentationUrl: "https://developer.ebay.com/"
  },
  {
    providerKey: "amazon_business",
    name: "Amazon Business",
    supportsApi: true,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: true,
    enabledByDefault: false
  },
  {
    providerKey: "contorion",
    name: "Contorion",
    supportsApi: true,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: true,
    enabledByDefault: false
  },
  {
    providerKey: "hornbach",
    name: "Hornbach",
    supportsApi: false,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: false,
    enabledByDefault: false
  },
  {
    providerKey: "bauhaus",
    name: "BAUHAUS",
    supportsApi: false,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: false,
    enabledByDefault: false
  },
  {
    providerKey: "obi",
    name: "OBI",
    supportsApi: false,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: false,
    enabledByDefault: false
  },
  {
    providerKey: "wuerth",
    name: "Würth",
    supportsApi: true,
    supportsCsv: true,
    supportsAffiliateFeed: false,
    requiresApiKey: true,
    enabledByDefault: false
  },
  {
    providerKey: "spax",
    name: "SPAX",
    supportsApi: false,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: false,
    enabledByDefault: false
  },
  {
    providerKey: "fischer",
    name: "fischer",
    supportsApi: false,
    supportsCsv: true,
    supportsAffiliateFeed: true,
    requiresApiKey: false,
    enabledByDefault: false
  }
];

export function getProviderConfig(providerKey: SupplierProviderKey) {
  return supplierProviders.find((provider) => provider.providerKey === providerKey);
}
