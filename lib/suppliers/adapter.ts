import type { SupplierProviderKey } from "@/types/app";
import { CsvSupplierAdapter } from "@/lib/suppliers/csv-adapter";
import { EbayAdapter } from "@/lib/suppliers/ebay-adapter";
import { GeizhalsAdapter } from "@/lib/suppliers/geizhals-adapter";
import { IdealoAdapter, OfficialFeedAdapter } from "@/lib/suppliers/idealo-adapter";
import { ManualSupplierAdapter } from "@/lib/suppliers/manual-adapter";
import type { SupplierAdapter, SupplierAdapterContext } from "@/lib/suppliers/types";

export function createSupplierAdapter(context: SupplierAdapterContext): SupplierAdapter {
  switch (context.providerKey) {
    case "manual":
      return new ManualSupplierAdapter(context);
    case "csv":
      return new CsvSupplierAdapter(context);
    case "idealo":
      return new IdealoAdapter(context);
    case "geizhals":
      return new GeizhalsAdapter(context);
    case "ebay":
      return new EbayAdapter(context);
    case "google_shopping":
      return new OfficialFeedAdapter(context, "Google Shopping");
    case "amazon_business":
      return new OfficialFeedAdapter(context, "Amazon Business");
    case "contorion":
      return new OfficialFeedAdapter(context, "Contorion");
    case "wuerth":
      return new OfficialFeedAdapter(context, "Würth");
    case "hornbach":
      return new CsvSupplierAdapter({ ...context, providerKey: "hornbach" });
    case "bauhaus":
      return new CsvSupplierAdapter({ ...context, providerKey: "bauhaus" });
    case "obi":
      return new CsvSupplierAdapter({ ...context, providerKey: "obi" });
    case "spax":
      return new CsvSupplierAdapter({ ...context, providerKey: "spax" });
    case "fischer":
      return new CsvSupplierAdapter({ ...context, providerKey: "fischer" });
    default:
      return new OfficialFeedAdapter(
        { ...context, providerKey: context.providerKey as SupplierProviderKey },
        context.supplierName ?? context.providerKey
      );
  }
}
