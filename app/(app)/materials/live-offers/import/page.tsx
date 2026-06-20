import { Upload } from "lucide-react";
import { MaterialSubnav } from "@/components/materials/material-subnav";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { importSupplierOffersCsvAction } from "@/lib/actions/supplier-actions";
import { requireManager } from "@/lib/auth";
import { inventoryPriceOptionSelect, supplierIntegrationListSelect } from "@/lib/data/selects";
import { supplierProviders } from "@/lib/suppliers/provider-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { InventoryItem, SupplierIntegration } from "@/types/app";

export default async function ImportLiveOffersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const [materialsResult, integrationsResult] = await Promise.all([
    supabase
      .from("inventory_items")
      .select(inventoryPriceOptionSelect)
      .eq("company_id", context.companyId)
      .order("name"),
    supabase
      .from("supplier_integrations")
      .select(supplierIntegrationListSelect)
      .eq("company_id", context.companyId)
      .eq("active", true)
      .order("name")
  ]);

  const materials = (materialsResult.data ?? []) as InventoryItem[];
  const integrations = (integrationsResult.data ?? []) as unknown as Array<Omit<SupplierIntegration, "api_key_encrypted">>;

  return (
    <>
      <PageHeader title="CSV-Angebote importieren" description="Erlaubte Händlerfeeds oder Exporte als Angebotsdaten übernehmen." />
      <MaterialSubnav active="/materials/live-offers" />
      <MessageBox error={error} success={success} />

      <div className="surface mb-5 p-4 text-sm leading-6 text-slate-700">
        Unterstützte Spalten: `Lieferant`, `Produktname`, `Hersteller`, `Kategorie`, `Einheit`, `Preis netto`,
        `Preis brutto`, `Versand`, `Lieferzeit`, `Lagerstatus`, `Produkt URL`, `Artikelnummer`.
      </div>

      <form action={importSupplierOffersCsvAction} className="surface p-4 sm:p-5">
        <input type="hidden" name="return_to" value="/materials/live-offers/import" />
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2 className="section-title">CSV hochladen</h2>
            <p className="text-sm text-slate-500">Semikolon und Komma werden automatisch erkannt.</p>
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
            <select className="field-input" name="provider_key" defaultValue="csv">
              {supplierProviders.map((provider) => (
                <option key={provider.providerKey} value={provider.providerKey}>
                  {provider.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Lieferant Fallback</span>
            <input className="field-input" name="supplier_name" placeholder="falls CSV keine Lieferant-Spalte hat" />
          </label>
          <label>
            <span className="field-label">Direkt Material zuordnen</span>
            <select className="field-input" name="material_id" defaultValue="">
              <option value="">Automatisch matchen</option>
              {materials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">CSV-Datei</span>
            <input className="field-input" name="csv_file" type="file" accept=".csv,text/csv" />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Oder CSV-Inhalt einfügen</span>
            <textarea
              className="field-input min-h-48 font-mono text-xs"
              name="csv_text"
              placeholder={"Lieferant;Produktname;Preis brutto;Versand;Einheit\nContorion;Spenglerschrauben V2A 4,5x35;12,99;4,90;Stück"}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end">
          <button className="btn-primary" type="submit">
            CSV importieren
          </button>
        </div>
      </form>
    </>
  );
}
