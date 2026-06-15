import { OfficialFeedAdapter } from "@/lib/suppliers/idealo-adapter";
import type { SupplierAdapterContext } from "@/lib/suppliers/types";

export class EbayAdapter extends OfficialFeedAdapter {
  constructor(context: SupplierAdapterContext) {
    super({ ...context, providerKey: "ebay" }, "eBay");
  }
}
