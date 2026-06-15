import { BadgeEuro } from "lucide-react";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { createManualSupplierOfferAction } from "@/lib/actions/supplier-actions";
import { requireManager } from "@/lib/auth";
import { supplierProviders } from "@/lib/suppliers/provider-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { InventoryItem, SupplierIntegration } from "@/types/app";

export default async function NewLiveOfferPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const [materialsResult, integrationsResult] = await Promise.all([
    supabase.from("inventory_items").select("id, name, unit, purchase_price, manufacturer").order("name"),
    supabase.from("supplier_integrations").select("*").eq("active", true).order("name")
  ]);

  const materials = (materialsResult.data ?? []) as InventoryItem[];
  const integrations = (integrationsResult.data ?? []) as SupplierIntegration[];

  return (
    <>
      <PageHeader title="Manuelles Angebot" description="Ein echtes Lieferantenangebot erfassen und optional direkt einem Material zuordnen." />
      <MaterialSubnav active="/materials/live-offers" />
      <MessageBox error={error} success={success} />

      <form action={createManualSupplierOfferAction} className="surface p-4 sm:p-5">
        <input type="hidden" name="return_to" value="/materials/live-offers/new" />
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
            <BadgeEuro className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="section-title">Angebot erfassen</h2>
            <p className="text-sm text-slate-500">Manuelle Angebote sind sofort im Preisvergleich nutzbar.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label>
            <span className="field-label">Integration</span>
            <select className="field-input" name="supplier_integration_id" defaultValue="">
              <option value="">Keine Integration</option>
              {integrations.map((integration) => (
                <option key={integration.id} value={integration.id}>
                  {integration.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Anbieter</span>
            <select className="field-input" name="provider_key" defaultValue="manual">
              {supplierProviders.map((provider) => (
                <option key={provider.providerKey} value={provider.providerKey}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Lieferant</span>
            <input className="field-input" name="supplier_name" placeholder="z. B. Baustoffhandel Müller" required />
          </label>
          <label>
            <span className="field-label">Material zuordnen</span>
            <select className="field-input" name="material_id" defaultValue="">
              <option value="">Später zuordnen</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Produktname</span>
            <input className="field-input" name="product_name" placeholder="z. B. Spenglerschrauben V2A 4,5 x 35 mm" required />
          </label>
          <label>
            <span className="field-label">Hersteller</span>
            <input className="field-input" name="manufacturer" placeholder="z. B. SPAX, Fischer, Würth" />
          </label>
          <label>
            <span className="field-label">Kategorie</span>
            <input className="field-input" name="category" placeholder="Befestigung" />
          </label>
          <label>
            <span className="field-label">Einheit</span>
            <input className="field-input" name="unit" defaultValue="Stueck" required />
          </label>
          <label>
            <span className="field-label">Packungsgröße</span>
            <input className="field-input" name="package_size" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">EK netto</span>
            <input className="field-input" name="price_net" inputMode="decimal" />
          </label>
          <label>
            <span className="field-label">Preis brutto</span>
            <input className="field-input" name="price_gross" inputMode="decimal" required />
          </label>
          <label>
            <span className="field-label">MwSt %</span>
            <input className="field-input" name="vat_rate" inputMode="decimal" defaultValue="19" />
          </label>
          <label>
            <span className="field-label">Versand brutto</span>
            <input className="field-input" name="shipping_cost" inputMode="decimal" defaultValue="0" />
          </label>
          <label>
            <span className="field-label">Währung</span>
            <input className="field-input" name="currency" defaultValue="EUR" />
          </label>
          <label>
            <span className="field-label">Lieferzeit Text</span>
            <input className="field-input" name="delivery_time_text" placeholder="z. B. 1-3 Werktage" />
          </label>
          <label>
            <span className="field-label">Lieferzeit min. Tage</span>
            <input className="field-input" name="delivery_time_days_min" inputMode="numeric" />
          </label>
          <label>
            <span className="field-label">Lieferzeit max. Tage</span>
            <input className="field-input" name="delivery_time_days_max" inputMode="numeric" />
          </label>
          <label>
            <span className="field-label">Lagerstatus</span>
            <input className="field-input" name="stock_status" placeholder="Auf Lager" />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Produkt-URL</span>
            <input className="field-input" name="product_url" type="url" placeholder="https://..." />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Bild-URL</span>
            <input className="field-input" name="image_url" type="url" placeholder="optional" />
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="btn-primary" type="submit">
            Angebot speichern
          </button>
        </div>
      </form>
    </>
  );
}
