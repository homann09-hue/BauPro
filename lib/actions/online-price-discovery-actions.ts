"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { discoverOnlinePrices } from "@/lib/online-price-discovery/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString } from "@/lib/utils";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function redirectTarget(formData: FormData, fallback = "/materials/online-discovery") {
  const value = String(formData.get("return_to") ?? "");
  return value.startsWith("/") ? value : fallback;
}

function revalidateDiscoveryRoutes(materialId?: string | null) {
  revalidatePath("/materials/online-discovery");
  revalidatePath("/materials/inventory");
  if (materialId) revalidatePath(`/materials/inventory/${materialId}`);
}

const legacyOnlineSourceKeys = new Set(["idealo", "geizhals", "ebay", "amazon", "contorion", "toolineo", "custom_feed"]);

export async function runOnlinePriceDiscoveryAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  const materialId = optionalString(formData, "material_id");
  let query = optionalString(formData, "query") ?? "";
  let successMessage: string | null = null;
  let errorMessage: string | null = null;

  try {
    if (materialId && !query) {
      const { data: material } = await supabase
        .from("inventory_items")
        .select("name")
        .eq("id", materialId)
        .eq("company_id", context.companyId)
        .single();
      query = String(material?.name ?? "");
    }

    if (!query.trim()) {
      throw new Error("Bitte Suchbegriff oder Material auswaehlen.");
    }

    const result = await discoverOnlinePrices(query);
    const { data: discovery, error: discoveryError } = await supabase
      .from("online_price_discoveries")
      .insert({
        company_id: context.companyId,
        material_id: materialId,
        query,
        status: result.status,
        source_statuses: result.sourceStatuses,
        cheapest_price_gross: result.cheapestPriceGross,
        average_price_gross: result.averagePriceGross,
        offer_count: result.offers.length,
        created_by: context.userId
      })
      .select("id")
      .single();

    if (discoveryError || !discovery) {
      throw new Error(discoveryError?.message ?? "Online-Recherche konnte nicht gespeichert werden.");
    }

    if (result.offers.length > 0) {
      const offerRows = result.offers.map((offer) => ({
        company_id: context.companyId,
        discovery_id: discovery.id,
        material_id: materialId,
        source_key: offer.sourceKey,
        supplier_name: offer.supplierName,
        product_name: offer.productName,
        product_url: offer.productUrl,
        price_gross: offer.priceGross,
        shipping_cost: offer.shippingCost,
        delivery_time_text: offer.deliveryTimeText,
        checked_at: offer.checkedAt,
        source_note: offer.sourceNote
      }));
      const { error: offersError } = await supabase.from("online_price_offers").insert(
        offerRows
      );

      if (offersError?.message.includes("online_price_offers_source_key_check")) {
        const fallbackRows = offerRows.map((row) => ({
          ...row,
          source_key: legacyOnlineSourceKeys.has(row.source_key) ? row.source_key : "custom_feed",
          source_note: legacyOnlineSourceKeys.has(row.source_key)
            ? row.source_note
            : `${row.source_note ? `${row.source_note} | ` : ""}Originalquelle: ${row.source_key}`
        }));
        const { error: fallbackError } = await supabase.from("online_price_offers").insert(fallbackRows);
        if (fallbackError) throw new Error(fallbackError.message);
      } else if (offersError) {
        throw new Error(offersError.message);
      }
    }

    const message =
      result.offers.length > 0
        ? `${result.offers.length} Online-Angebote gefunden.`
        : "Keine aktuellen Online-Angebote gefunden.";
    successMessage = message;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Online-Recherche konnte nicht ausgefuehrt werden.";
  }

  revalidateDiscoveryRoutes(materialId);

  if (errorMessage) {
    redirect(`${returnTo}?error=${toQuery(errorMessage)}`);
  }

  redirect(`${returnTo}?success=${toQuery(successMessage ?? "Online-Recherche wurde ausgefuehrt.")}`);
}
