import type { OnlinePriceSourceKey } from "@/types/app";

export type OnlinePriceCandidate = {
  sourceKey: OnlinePriceSourceKey;
  supplierName: string;
  productName: string;
  productUrl: string | null;
  priceGross: number;
  shippingCost: number;
  deliveryTimeText: string | null;
  checkedAt: string;
  sourceNote: string | null;
};

export type OnlinePriceSourceStatus = {
  sourceKey: OnlinePriceSourceKey;
  label: string;
  status: "ok" | "no_config" | "unreachable" | "error";
  message: string;
};

export type OnlinePriceSourceResult = {
  offers: OnlinePriceCandidate[];
  status: OnlinePriceSourceStatus;
};

export type OnlinePriceSource = {
  sourceKey: OnlinePriceSourceKey;
  label: string;
  search(query: string): Promise<OnlinePriceSourceResult>;
};
