import { AlertTriangle, Handshake, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import {
  createSupplierIntegrationAction,
  fetchSupplierOffersAction,
  updateSupplierIntegrationAction
} from "@/lib/actions/supplier-actions";
import { requireAdmin } from "@/lib/auth";
import { supplierIntegrationListSelect } from "@/lib/data/selects";
import { supplierProviders } from "@/lib/suppliers/provider-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { SupplierIntegration, SupplierIntegrationType } from "@/types/app";

const integrationTypes: Array<{ value: SupplierIntegrationType; label: string }> = [
  { value: "manual", label: "Manuell" },
  { value: "csv", label: "CSV" },
  { value: "api", label: "API" },
  { value: "affiliate_feed", label: "Affiliate Feed" }
];

export default async function SuppliersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const { data } = await supabase
    .from("supplier_integrations")
    .select(supplierIntegrationListSelect)
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: false });

  const integrations = (data ?? []) as unknown as Array<Omit<SupplierIntegration, "api_key_encrypted">>;

  return (
    <>
      <PageHeader
        title="Lieferanten"
        description="Offizielle APIs, CSV-Feeds und manuelle Angebote für den Preisvergleich vorbereiten."
      />
      <MessageBox error={error} success={success} />

      <div className="surface mb-5 flex items-start gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" aria-hidden="true" />
        <p className="text-sm leading-6 text-slate-700">
          Für echte Live-Daten wird ein offizieller API-Zugang, Affiliate-Feed oder CSV-Export benötigt. Scraping
          geschützter Shops wird nicht verwendet.
        </p>
      </div>

      <details className="surface mb-5 p-4 sm:p-5" open={integrations.length === 0}>
        <summary className="cursor-pointer text-sm font-black text-ink">Neue Lieferantenintegration</summary>
        <form action={createSupplierIntegrationAction} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <input type="hidden" name="return_to" value="/suppliers" />
          <label className="lg:col-span-2">
            <span className="field-label">Name</span>
            <input className="field-input" name="name" placeholder="z. B. Contorion CSV" required />
          </label>
          <label>
            <span className="field-label">Typ</span>
            <select className="field-input" name="type" defaultValue="manual">
              {integrationTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
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
          <label className="lg:col-span-2">
            <span className="field-label">Base URL / Feed URL</span>
            <input className="field-input" name="base_url" placeholder="optional" />
          </label>
          <label className="lg:col-span-2">
            <span className="field-label">API-Key</span>
            <input className="field-input" name="api_key" type="password" placeholder="nur bei offizieller API" />
            <p className="field-help">Zum Speichern von API-Keys muss `SUPPLIER_API_ENCRYPTION_KEY` gesetzt sein.</p>
          </label>
          <label className="lg:col-span-4">
            <span className="field-label">Notizen</span>
            <input className="field-input" name="notes" placeholder="z. B. CSV aus Händlerportal, wöchentlich exportieren" />
          </label>
          <div className="grid gap-2 sm:grid-cols-2 lg:col-span-6 lg:grid-cols-5">
            {[
              ["active", "Aktiv"],
              ["supports_price", "Preise"],
              ["supports_stock", "Bestand"],
              ["supports_delivery_time", "Lieferzeit"],
              ["supports_product_url", "Produkt-URL"]
            ].map(([name, label]) => (
              <label key={name} className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  name={name}
                  defaultChecked={name === "active" || name === "supports_price" || name === "supports_product_url"}
                  className="h-4 w-4 rounded border-line text-moss"
                />
                {label}
              </label>
            ))}
          </div>
          <button className="btn-primary lg:col-span-6" type="submit">
            Integration speichern
          </button>
        </form>
      </details>

      {integrations.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Noch keine Lieferanten"
          description="Lege manuelle Angebote oder CSV-Feeds an. Offizielle APIs kannst du vorbereiten, sobald Zugangsdaten vorhanden sind."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {integrations.map((integration) => {
            const provider = supplierProviders.find((item) => item.providerKey === integration.provider_key);
            return (
              <article key={integration.id} className="surface-strong p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="meta-label">{provider?.name ?? integration.provider_key}</p>
                    <h2 className="mt-1 text-lg font-black text-ink">{integration.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {integration.type} · {integration.active ? "aktiv" : "inaktiv"}
                    </p>
                  </div>
                  {provider?.documentationUrl ? (
                    <a className="btn-secondary" href={provider.documentationUrl} target="_blank" rel="noreferrer">
                      Doku
                    </a>
                  ) : null}
                </div>

                <form action={updateSupplierIntegrationAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="return_to" value="/suppliers" />
                  <input type="hidden" name="id" value={integration.id} />
                  <label>
                    <span className="field-label">Name</span>
                    <input className="field-input" name="name" defaultValue={integration.name} required />
                  </label>
                  <label>
                    <span className="field-label">Anbieter</span>
                    <select className="field-input" name="provider_key" defaultValue={integration.provider_key}>
                      {supplierProviders.map((providerItem) => (
                        <option key={providerItem.providerKey} value={providerItem.providerKey}>
                          {providerItem.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Typ</span>
                    <select className="field-input" name="type" defaultValue={integration.type}>
                      {integrationTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Neuer API-Key</span>
                    <input className="field-input" name="api_key" type="password" placeholder="leer lassen = behalten" />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="field-label">Base URL / Feed URL</span>
                    <input className="field-input" name="base_url" defaultValue={integration.base_url ?? ""} />
                  </label>
                  <label className="sm:col-span-2">
                    <span className="field-label">Notizen</span>
                    <input className="field-input" name="notes" defaultValue={integration.notes ?? ""} />
                  </label>
                  <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 lg:grid-cols-5">
                    {[
                      ["active", "Aktiv", integration.active],
                      ["supports_price", "Preise", integration.supports_price],
                      ["supports_stock", "Bestand", integration.supports_stock],
                      ["supports_delivery_time", "Lieferzeit", integration.supports_delivery_time],
                      ["supports_product_url", "Produkt-URL", integration.supports_product_url]
                    ].map(([name, label, checked]) => (
                      <label key={String(name)} className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink">
                        <input
                          type="checkbox"
                          name={String(name)}
                          defaultChecked={Boolean(checked)}
                          className="h-4 w-4 rounded border-line text-moss"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <button className="btn-secondary sm:col-span-2" type="submit">
                    Integration aktualisieren
                  </button>
                </form>

                <form action={fetchSupplierOffersAction} className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input type="hidden" name="return_to" value="/suppliers" />
                  <input type="hidden" name="supplier_integration_id" value={integration.id} />
                  <input className="field-input" name="query" placeholder="Angebote suchen, z. B. Spenglerschraube 4,5x35" />
                  <button className="btn-primary" type="submit">
                    <Search className="h-4 w-4" aria-hidden="true" />
                    Suchen
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
