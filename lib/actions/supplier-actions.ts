"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { createSupplierAdapter } from "@/lib/suppliers/adapter";
import { CsvSupplierAdapter } from "@/lib/suppliers/csv-adapter";
import { getProviderConfig } from "@/lib/suppliers/provider-config";
import { calculateSupplierMatchScore } from "@/lib/suppliers/matcher";
import type { SupplierOfferInput } from "@/lib/suppliers/types";
import { SupplierIntegrationError } from "@/lib/suppliers/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalNumber, optionalString, requiredString } from "@/lib/utils";
import type {
  InventoryItem,
  SupplierIntegration,
  SupplierIntegrationType,
  SupplierOffer,
  SupplierProviderKey
} from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function redirectTarget(formData: FormData, fallback = "/materials/live-offers") {
  const value = String(formData.get("return_to") ?? "");
  return value.startsWith("/") ? value : fallback;
}

function boolField(formData: FormData, key: string) {
  return String(formData.get(key) ?? "off") === "on";
}

function providerKeyValue(value: FormDataEntryValue | null): SupplierProviderKey {
  const key = String(value ?? "manual") as SupplierProviderKey;
  return getProviderConfig(key) ? key : "manual";
}

function integrationTypeValue(value: FormDataEntryValue | null): SupplierIntegrationType {
  const type = String(value ?? "manual");
  if (type === "api" || type === "csv" || type === "affiliate_feed") return type;
  return "manual";
}

function encryptApiKey(value: string | null) {
  if (!value) return null;
  const secret = process.env.SUPPLIER_API_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error("SUPPLIER_API_ENCRYPTION_KEY fehlt. API-Keys werden nicht unverschluesselt gespeichert.");
  }

  const iv = crypto.randomBytes(12);
  const key = crypto.createHash("sha256").update(secret).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

function money(formData: FormData, key: string, fallback = 0) {
  return optionalNumber(formData, key) ?? fallback;
}

function offerPayload(offer: SupplierOfferInput, companyId: string, userId: string) {
  if (!offer.product_name.trim()) throw new Error("Produktname fehlt.");
  if (!Number.isFinite(Number(offer.price_gross)) || Number(offer.price_gross) <= 0) {
    throw new Error(`Bruttopreis fehlt fuer ${offer.product_name}.`);
  }

  return {
    company_id: companyId,
    supplier_integration_id: offer.supplier_integration_id ?? null,
    provider_key: offer.provider_key,
    supplier_name: offer.supplier_name,
    external_product_id: offer.external_product_id ?? null,
    product_name: offer.product_name,
    manufacturer: offer.manufacturer ?? null,
    category: offer.category ?? null,
    unit: offer.unit || "Stueck",
    package_size: offer.package_size ?? null,
    price_net: offer.price_net ?? null,
    price_gross: offer.price_gross,
    currency: offer.currency || "EUR",
    vat_rate: offer.vat_rate ?? 19,
    shipping_cost: offer.shipping_cost ?? 0,
    delivery_time_text: offer.delivery_time_text ?? null,
    delivery_time_days_min: offer.delivery_time_days_min ?? null,
    delivery_time_days_max: offer.delivery_time_days_max ?? null,
    stock_status: offer.stock_status ?? null,
    product_url: offer.product_url ?? null,
    image_url: offer.image_url ?? null,
    valid_until: offer.valid_until ?? null,
    source_type: offer.source_type,
    created_by: userId
  };
}

type MaterialMatchRow = Record<string, unknown> & { id: string };

function notNull<T>(value: T | null): value is T {
  return value !== null;
}

function matchMaterialRow(row: Record<string, unknown>): MaterialMatchRow {
  return {
    ...row,
    id: String(row.id ?? ""),
    category_name: (row.material_categories as { name?: string } | null)?.name ?? null,
    subcategory_name: (row.material_subcategories as { name?: string } | null)?.name ?? null,
    search_terms: (row.material_catalog as { search_terms?: string[] } | null)?.search_terms ?? []
  };
}

async function createAutoMatches({
  supabase,
  companyId,
  userId,
  offers,
  materialId,
  approved
}: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  companyId: string;
  userId: string;
  offers: SupplierOffer[];
  materialId?: string | null;
  approved: boolean;
}) {
  if (offers.length === 0) return;

  const materialQuery = supabase
    .from("inventory_items")
    .select(
      "*, material_categories(id, name, slug), material_subcategories(id, name, slug), material_catalog(id, search_terms)"
    )
    .eq("company_id", companyId);

  const { data: materialRows } = materialId ? await materialQuery.eq("id", materialId) : await materialQuery.limit(200);
  const materials = ((materialRows ?? []) as Array<Record<string, unknown>>).map(matchMaterialRow);

  const rows = offers.flatMap((offer) =>
    materials
      .map((material) => {
        const score = calculateSupplierMatchScore(material as unknown as InventoryItem, offer);
        if (!approved && score < 55) return null;

        return {
          company_id: companyId,
          material_id: material.id,
          supplier_offer_id: offer.id,
          match_score: approved ? Math.max(score, 90) : score,
          match_type: approved ? ("manual" as const) : ("auto" as const),
          approved_by_admin: approved,
          created_by: userId
        };
      })
      .filter(notNull)
  );

  if (rows.length > 0) {
    await supabase.from("supplier_offer_matches").upsert(rows, { onConflict: "material_id,supplier_offer_id" });
  }
}

function revalidateSupplierRoutes() {
  revalidatePath("/suppliers");
  revalidatePath("/materials/live-offers");
  revalidatePath("/materials/live-offers/import");
  revalidatePath("/materials/live-offers/new");
  revalidatePath("/materials/inventory");
  revalidatePath("/dashboard");
}

export async function createSupplierIntegrationAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData, "/suppliers");
  const providerKey = providerKeyValue(formData.get("provider_key"));
  const provider = getProviderConfig(providerKey);

  try {
    const apiKey = optionalString(formData, "api_key");
    const { error } = await supabase.from("supplier_integrations").insert({
      company_id: context.companyId,
      name: requiredString(formData, "name"),
      type: integrationTypeValue(formData.get("type")),
      provider_key: providerKey,
      base_url: optionalString(formData, "base_url"),
      api_key_encrypted: encryptApiKey(apiKey),
      active: boolField(formData, "active"),
      supports_price: boolField(formData, "supports_price") || Boolean(provider?.supportsApi || provider?.supportsCsv),
      supports_stock: boolField(formData, "supports_stock"),
      supports_delivery_time: boolField(formData, "supports_delivery_time"),
      supports_product_url: boolField(formData, "supports_product_url"),
      notes: optionalString(formData, "notes"),
      created_by: context.userId
    });

    if (error) throw new Error(error.message);
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Integration konnte nicht gespeichert werden.")}`);
  }

  revalidateSupplierRoutes();
  redirect(`${returnTo}?success=${toQuery("Lieferantenintegration wurde angelegt.")}`);
}

export async function updateSupplierIntegrationAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData, "/suppliers");
  const id = requiredString(formData, "id");
  const apiKey = optionalString(formData, "api_key");

  try {
    const payload: Record<string, unknown> = {
      name: requiredString(formData, "name"),
      type: integrationTypeValue(formData.get("type")),
      provider_key: providerKeyValue(formData.get("provider_key")),
      base_url: optionalString(formData, "base_url"),
      active: boolField(formData, "active"),
      supports_price: boolField(formData, "supports_price"),
      supports_stock: boolField(formData, "supports_stock"),
      supports_delivery_time: boolField(formData, "supports_delivery_time"),
      supports_product_url: boolField(formData, "supports_product_url"),
      notes: optionalString(formData, "notes")
    };

    if (apiKey) payload.api_key_encrypted = encryptApiKey(apiKey);

    const { error } = await supabase
      .from("supplier_integrations")
      .update(payload)
      .eq("id", id)
      .eq("company_id", context.companyId);

    if (error) throw new Error(error.message);
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Integration konnte nicht aktualisiert werden.")}`);
  }

  revalidateSupplierRoutes();
  redirect(`${returnTo}?success=${toQuery("Lieferantenintegration wurde gespeichert.")}`);
}

export async function createManualSupplierOfferAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData, "/materials/live-offers/new");
  const materialId = optionalString(formData, "material_id");
  const integrationId = optionalString(formData, "supplier_integration_id");
  const providerKey = providerKeyValue(formData.get("provider_key"));

  try {
    const adapter = createSupplierAdapter({ providerKey, supplierName: optionalString(formData, "supplier_name") });
    const offer = adapter.normalizeOffer({
      supplier_integration_id: integrationId,
      supplier_name: optionalString(formData, "supplier_name"),
      external_product_id: optionalString(formData, "external_product_id"),
      product_name: requiredString(formData, "product_name"),
      manufacturer: optionalString(formData, "manufacturer"),
      category: optionalString(formData, "category"),
      unit: requiredString(formData, "unit"),
      package_size: optionalNumber(formData, "package_size"),
      price_net: optionalNumber(formData, "price_net"),
      price_gross: money(formData, "price_gross"),
      currency: optionalString(formData, "currency") ?? "EUR",
      vat_rate: money(formData, "vat_rate", 19),
      shipping_cost: money(formData, "shipping_cost", 0),
      delivery_time_text: optionalString(formData, "delivery_time_text"),
      delivery_time_days_min: optionalNumber(formData, "delivery_time_days_min"),
      delivery_time_days_max: optionalNumber(formData, "delivery_time_days_max"),
      stock_status: optionalString(formData, "stock_status"),
      product_url: optionalString(formData, "product_url"),
      image_url: optionalString(formData, "image_url"),
      valid_until: optionalString(formData, "valid_until")
    });

    const { data, error } = await supabase
      .from("supplier_offers")
      .insert(offerPayload({ ...offer, supplier_integration_id: integrationId, source_type: "manual" }, context.companyId, context.userId))
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Angebot konnte nicht gespeichert werden.");
    await createAutoMatches({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      offers: [data as SupplierOffer],
      materialId,
      approved: Boolean(materialId)
    });
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Angebot konnte nicht gespeichert werden.")}`);
  }

  revalidateSupplierRoutes();
  redirect(`/materials/live-offers?success=${toQuery("Angebot wurde gespeichert.")}`);
}

export async function importSupplierOffersCsvAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData, "/materials/live-offers/import");
  const providerKey = providerKeyValue(formData.get("provider_key"));
  const integrationId = optionalString(formData, "supplier_integration_id");
  const materialId = optionalString(formData, "material_id");

  try {
    const file = formData.get("csv_file");
    const pastedCsv = optionalString(formData, "csv_text");
    const csvText = file instanceof File && file.size > 0 ? await file.text() : pastedCsv;

    if (!csvText) throw new Error("Bitte CSV-Datei hochladen oder CSV-Inhalt einfuegen.");

    const adapter = new CsvSupplierAdapter({
      providerKey,
      supplierName: optionalString(formData, "supplier_name") ?? "CSV"
    });
    const offers = adapter.parse(csvText).map((offer) => ({
      ...offer,
      supplier_integration_id: integrationId,
      provider_key: providerKey
    }));

    if (offers.length === 0) throw new Error("Keine Angebote in der CSV gefunden.");

    const { data, error } = await supabase
      .from("supplier_offers")
      .insert(offers.map((offer) => offerPayload(offer, context.companyId, context.userId)))
      .select("*");

    if (error) throw new Error(error.message);

    await createAutoMatches({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      offers: (data ?? []) as SupplierOffer[],
      materialId,
      approved: Boolean(materialId)
    });
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "CSV-Import fehlgeschlagen.")}`);
  }

  revalidateSupplierRoutes();
  redirect(`/materials/live-offers?success=${toQuery("CSV-Angebote wurden importiert.")}`);
}

export async function fetchSupplierOffersAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData, "/suppliers");
  const integrationId = requiredString(formData, "supplier_integration_id");
  const query = requiredString(formData, "query");

  try {
    const { data: integration, error } = await supabase
      .from("supplier_integrations")
      .select("*")
      .eq("id", integrationId)
      .eq("company_id", context.companyId)
      .single();

    if (error || !integration) throw new Error("Integration wurde nicht gefunden.");
    const typed = integration as SupplierIntegration;
    const adapter = createSupplierAdapter({
      providerKey: typed.provider_key,
      apiKey: typed.api_key_encrypted,
      baseUrl: typed.base_url,
      supplierName: typed.name
    });
    const offers = await adapter.fetchOffers(query);

    if (offers.length === 0) {
      throw new SupplierIntegrationError("Der Anbieter hat keine Angebote geliefert oder ist nur als Feed vorbereitet.");
    }

    const { error: insertError } = await supabase
      .from("supplier_offers")
      .insert(offers.map((offer) => offerPayload({ ...offer, supplier_integration_id: typed.id }, context.companyId, context.userId)));

    if (insertError) throw new Error(insertError.message);
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Angebotssuche fehlgeschlagen.")}`);
  }

  revalidateSupplierRoutes();
  redirect(`${returnTo}?success=${toQuery("Angebotssuche wurde verarbeitet.")}`);
}

export async function matchSupplierOfferAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  const materialId = requiredString(formData, "material_id");
  const offerId = requiredString(formData, "offer_id");

  try {
    const [{ data: material }, { data: offer }] = await Promise.all([
      supabase
        .from("inventory_items")
        .select("*, material_categories(id, name, slug), material_subcategories(id, name, slug), material_catalog(id, search_terms)")
        .eq("id", materialId)
        .eq("company_id", context.companyId)
        .single(),
      supabase.from("supplier_offers").select("*").eq("id", offerId).eq("company_id", context.companyId).single()
    ]);

    if (!material || !offer) throw new Error("Material oder Angebot wurde nicht gefunden.");

    const score = calculateSupplierMatchScore(
      matchMaterialRow(material as Record<string, unknown>) as unknown as InventoryItem,
      offer as SupplierOffer
    );

    const { error } = await supabase.from("supplier_offer_matches").upsert(
      {
        company_id: context.companyId,
        material_id: materialId,
        supplier_offer_id: offerId,
        match_score: Math.max(score, 90),
        match_type: "manual",
        approved_by_admin: true,
        created_by: context.userId
      },
      { onConflict: "material_id,supplier_offer_id" }
    );

    if (error) throw new Error(error.message);
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "Zuordnung fehlgeschlagen.")}`);
  }

  revalidateSupplierRoutes();
  redirect(`${returnTo}?success=${toQuery("Angebot wurde dem Material zugeordnet.")}`);
}

export async function acceptSupplierOfferAsPurchasePriceAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = redirectTarget(formData);
  const materialId = requiredString(formData, "material_id");
  const offerId = requiredString(formData, "offer_id");

  try {
    const { data: offer } = await supabase
      .from("supplier_offers")
      .select("*")
      .eq("id", offerId)
      .eq("company_id", context.companyId)
      .single();

    if (!offer) throw new Error("Angebot wurde nicht gefunden.");
    const typedOffer = offer as SupplierOffer;
    const purchasePrice = typedOffer.price_net ?? Math.round((typedOffer.price_gross / (1 + typedOffer.vat_rate / 100)) * 100) / 100;

    const { data: supplier } = await supabase
      .from("suppliers")
      .select("id")
      .eq("company_id", context.companyId)
      .ilike("name", typedOffer.supplier_name)
      .maybeSingle();

    const supplierId =
      (supplier?.id as string | undefined) ??
      (
        await supabase
          .from("suppliers")
          .insert({ company_id: context.companyId, name: typedOffer.supplier_name })
          .select("id")
          .single()
      ).data?.id;

    const { error: updateError } = await supabase
      .from("inventory_items")
      .update({
        purchase_price: purchasePrice,
        supplier_id: supplierId ?? null,
        last_price_changed_at: new Date().toISOString()
      })
      .eq("id", materialId)
      .eq("company_id", context.companyId);

    if (updateError) throw new Error(updateError.message);

    await supabase.from("supplier_price_history").insert({
      company_id: context.companyId,
      material_id: materialId,
      supplier_name: typedOffer.supplier_name,
      product_name: typedOffer.product_name,
      price_net: purchasePrice,
      price_gross: typedOffer.price_gross,
      total_price_gross: typedOffer.total_price_gross
    });

    await createAutoMatches({
      supabase,
      companyId: context.companyId,
      userId: context.userId,
      offers: [typedOffer],
      materialId,
      approved: true
    });
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(error instanceof Error ? error.message : "EK konnte nicht uebernommen werden.")}`);
  }

  revalidateSupplierRoutes();
  redirect(`${returnTo}?success=${toQuery("Angebot wurde als EK uebernommen.")}`);
}
