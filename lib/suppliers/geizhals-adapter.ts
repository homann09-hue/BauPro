import { OfficialFeedAdapter } from "@/lib/suppliers/idealo-adapter";
import type { SupplierAdapterContext } from "@/lib/suppliers/types";

export class GeizhalsAdapter extends OfficialFeedAdapter {
  constructor(context: SupplierAdapterContext) {
    super({ ...context, providerKey: "geizhals" }, "Geizhals");
  }
}
