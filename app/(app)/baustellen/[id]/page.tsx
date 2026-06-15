import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, FileDown, Hammer, LockKeyhole, PackageCheck, Warehouse } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MaterialCalculationForm } from "@/components/forms/material-calculation-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { updateMaterialCalculationRuleAction, updatePricingSettingsAction } from "@/lib/actions/material-calculation-actions";
import { requireAppContext } from "@/lib/auth";
import { formatQuantity } from "@/lib/inventory";
import { roofTypeLabels } from "@/lib/material-calculations";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";
import type {
  CompanyPricingSettings,
  JobMaterialCalculation,
  JobMaterialCalculationItem,
  Jobsite,
  MaterialCalculationRule,
  PublicJobMaterialCalculationItem
} from "@/types/app";

function preferredRules(rules: MaterialCalculationRule[], companyId: string) {
  const byKey = new Map<string, MaterialCalculationRule>();

  for (const rule of rules) {
    if (rule.company_id === null && !byKey.has(rule.rule_key)) byKey.set(rule.rule_key, rule);
  }
  for (const rule of rules) {
    if (rule.company_id === companyId) byKey.set(rule.rule_key, rule);
  }

  return [...byKey.values()].sort((a, b) => a.roof_type.localeCompare(b.roof_type) || a.sort_order - b.sort_order);
}

function calculationTotals(items: JobMaterialCalculationItem[]) {
  return items.reduce(
    (totals, item) => ({
      purchase: totals.purchase + Number(item.purchase_total ?? 0),
      sales: totals.sales + Number(item.sales_total ?? 0),
      margin: totals.margin + Number(item.margin_total ?? 0)
    }),
    { purchase: 0, sales: 0, margin: 0 }
  );
}

export default async function JobsiteDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);

  const { data: jobsiteData } = await supabase.from("jobsites").select("*").eq("id", id).single();

  if (!jobsiteData) {
    notFound();
  }

  const jobsite = jobsiteData as Jobsite;
  const itemSource = context.canManage ? "job_material_calculation_items" : "job_material_calculation_items_public";

  const [calculationsResult, itemsResult, settingsResult, rulesResult] = await Promise.all([
    supabase
      .from("job_material_calculations")
      .select("*")
      .eq("jobsite_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from(itemSource)
      .select("*")
      .eq("jobsite_id", id)
      .order("created_at", { ascending: true }),
    context.canManage
      ? supabase.from("company_pricing_settings").select("*").eq("company_id", context.companyId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    context.canManage
      ? supabase
          .from("material_calculation_rules")
          .select("*")
          .eq("active", true)
          .order("roof_type", { ascending: true })
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null })
  ]);

  const calculations = (calculationsResult.data ?? []) as JobMaterialCalculation[];
  const items = (itemsResult.data ?? []) as Array<JobMaterialCalculationItem | PublicJobMaterialCalculationItem>;
  const settings = (settingsResult.data ?? {
    company_id: context.companyId,
    waste_percent: 20,
    default_markup_percent: 35,
    auto_calculate_sales_price: true
  }) as CompanyPricingSettings;
  const rules = preferredRules((rulesResult.data ?? []) as MaterialCalculationRule[], context.companyId);
  const itemsByCalculation = new Map<string, Array<JobMaterialCalculationItem | PublicJobMaterialCalculationItem>>();

  for (const item of items) {
    const list = itemsByCalculation.get(item.calculation_id) ?? [];
    list.push(item);
    itemsByCalculation.set(item.calculation_id, list);
  }

  return (
    <>
      <PageHeader
        title={jobsite.name}
        description={`${jobsite.customer} · ${jobsite.address}`}
        actionHref={context.canManage ? `/baustellen/${jobsite.id}/bearbeiten` : undefined}
        actionLabel={context.canManage ? "Baustelle bearbeiten" : undefined}
        actionIcon={Hammer}
      />
      <MessageBox error={error} success={success} />

      <section className="surface mb-5 grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <p className="meta-label">Status</p>
          <p className="mt-1 font-black text-ink">{jobsite.status}</p>
        </div>
        <div>
          <p className="meta-label">Start</p>
          <p className="mt-1 font-black text-ink">{formatDate(jobsite.start_date)}</p>
        </div>
        <div>
          <p className="meta-label">Team</p>
          <p className="mt-1 font-black text-ink">{jobsite.assigned_employee_ids.length} Mitarbeiter</p>
        </div>
        {jobsite.notes ? <p className="text-sm text-slate-600 sm:col-span-3">{jobsite.notes}</p> : null}
      </section>

      {context.canManage ? (
        <div className="space-y-5">
          <MaterialCalculationForm jobsiteId={jobsite.id} defaultWastePercent={Number(settings.waste_percent ?? 20)} />

          <details className="surface p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-black text-ink">Chef-Einstellungen und Materialregeln</summary>
            <form action={updatePricingSettingsAction} className="mt-4 grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="return_to" value={`/baustellen/${jobsite.id}`} />
              <label>
                <span className="field-label">Verschnitt %</span>
                <input className="field-input" name="waste_percent" inputMode="decimal" defaultValue={settings.waste_percent} />
              </label>
              <label>
                <span className="field-label">Standard-Aufschlag %</span>
                <input
                  className="field-input"
                  name="default_markup_percent"
                  inputMode="decimal"
                  defaultValue={settings.default_markup_percent}
                />
              </label>
              <label className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink sm:col-span-2">
                <input
                  type="checkbox"
                  name="auto_calculate_sales_price"
                  defaultChecked={settings.auto_calculate_sales_price}
                  className="h-4 w-4 rounded border-line text-moss"
                />
                VK automatisch aus EK + Aufschlag berechnen
              </label>
              <button className="btn-primary sm:col-span-4" type="submit">
                Einstellungen speichern
              </button>
            </form>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {rules.map((rule) => (
                <form key={rule.id} action={updateMaterialCalculationRuleAction} className="rounded-lg border border-line bg-white p-3">
                  <input type="hidden" name="return_to" value={`/baustellen/${jobsite.id}`} />
                  <input type="hidden" name="rule_id" value={rule.id} />
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink">{rule.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{roofTypeLabels[rule.roof_type]}</p>
                    </div>
                    <span className="rounded-md bg-mint px-2 py-1 text-xs font-black text-moss">
                      {rule.company_id ? "Firma" : "Standard"}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label>
                      <span className="field-label">Regelname</span>
                      <input className="field-input" name="name" defaultValue={rule.name} />
                    </label>
                    <label>
                      <span className="field-label">Material</span>
                      <input className="field-input" name="material_name" defaultValue={rule.material_name} />
                    </label>
                    <label>
                      <span className="field-label">Einheit</span>
                      <input className="field-input" name="unit" defaultValue={rule.unit} />
                    </label>
                    <label>
                      <span className="field-label">Faktor</span>
                      <input className="field-input" name="factor" inputMode="decimal" defaultValue={rule.factor} />
                    </label>
                    <label>
                      <span className="field-label">Abstand m</span>
                      <input className="field-input" name="spacing_m" inputMode="decimal" defaultValue={rule.spacing_m ?? ""} />
                    </label>
                    <label className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        name="waste_applies"
                        defaultChecked={rule.waste_applies}
                        className="h-4 w-4 rounded border-line text-moss"
                      />
                      Verschnitt anwenden
                    </label>
                  </div>
                  <button className="btn-secondary mt-3 w-full" type="submit">
                    Regel speichern
                  </button>
                </form>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className="surface mb-5 flex items-start gap-3 p-4">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-moss" aria-hidden="true" />
          <div>
            <p className="font-black text-ink">Preisbereich ausgeblendet</p>
            <p className="mt-1 text-sm text-slate-600">
              Du siehst Materialbedarf, Lagerort und Bestand. EK, VK, Aufschlag und Marge bleiben Chef-Sache.
            </p>
          </div>
        </div>
      )}

      <section className="mt-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">Berechnete Materiallisten</h2>
            <p className="mt-1 text-sm text-slate-500">Grundmenge, Zuschlag und Gesamtmenge je Berechnung.</p>
          </div>
          <Link href="/berichte/neu" className="btn-secondary">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Tagesbericht
          </Link>
        </div>

        {calculations.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Noch keine Materialberechnung"
            description={
              context.canManage
                ? "Gib oben die Maße ein und erstelle die erste schnelle Materialliste."
                : "Noch keine Materialliste fuer diese Baustelle vorhanden."
            }
          />
        ) : (
          <div className="space-y-4">
            {calculations.map((calculation) => {
              const calculationItems = itemsByCalculation.get(calculation.id) ?? [];
              const pricedItems = calculationItems as JobMaterialCalculationItem[];
              const totals = context.canManage ? calculationTotals(pricedItems) : null;

              return (
                <article key={calculation.id} className="surface-strong overflow-hidden">
                  <div className="border-b border-line bg-fog p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-black text-ink">{roofTypeLabels[calculation.roof_type]}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatDateTime(calculation.created_at)} · {formatQuantity(calculation.area_m2)} m² ·{" "}
                          {formatQuantity(calculation.waste_percent)} % Verschnitt
                        </p>
                      </div>
                      {context.canManage && totals ? (
                        <div className="grid grid-cols-3 gap-2 text-right text-sm">
                          <div>
                            <p className="meta-label">EK</p>
                            <p className="font-black text-ink">{formatMoney(totals.purchase)}</p>
                          </div>
                          <div>
                            <p className="meta-label">VK</p>
                            <p className="font-black text-ink">{formatMoney(totals.sales)}</p>
                          </div>
                          <div>
                            <p className="meta-label">Marge</p>
                            <p className="font-black text-emerald-700">{formatMoney(totals.margin)}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="grid gap-3 p-4">
                    {calculationItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-line bg-white p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <p className="font-black text-ink">{item.material_name}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {item.location_name || "Kein Lagerbestand"} · Bestand {formatQuantity(item.stock ?? 0)} / Minimum{" "}
                              {formatQuantity(item.minimum_stock ?? 0)}
                            </p>
                          </div>
                          <div className={context.canManage ? "grid grid-cols-4 gap-2 text-sm lg:min-w-[620px]" : "grid grid-cols-2 gap-2 text-sm lg:min-w-[320px]"}>
                            {context.canManage ? (
                              <>
                                <div className="rounded-md bg-fog p-2">
                                  <p className="meta-label">Grund</p>
                                  <p className="font-black text-ink">
                                    {formatQuantity(item.base_quantity)} {item.unit}
                                  </p>
                                </div>
                                <div className="rounded-md bg-fog p-2">
                                  <p className="meta-label">+{formatQuantity(item.waste_percent)} %</p>
                                  <p className="font-black text-ink">
                                    {formatQuantity(item.waste_quantity)} {item.unit}
                                  </p>
                                </div>
                              </>
                            ) : null}
                            <div className="rounded-md bg-mint p-2">
                              <p className="meta-label text-moss">Gesamt</p>
                              <p className="font-black text-ink">
                                {formatQuantity(item.total_quantity)} {item.unit}
                              </p>
                            </div>
                            {context.canManage && "purchase_total" in item ? (
                              <div className="rounded-md bg-fog p-2">
                                <p className="meta-label">Kosten</p>
                                <p className="font-black text-ink">
                                  {formatMoney(item.purchase_total)} / {formatMoney(item.sales_total)}
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-md bg-fog p-2">
                                <p className="meta-label">Lager</p>
                                <p className="truncate font-black text-ink">{item.location_name || "-"}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-line bg-fog p-4 sm:flex-row sm:justify-end">
                    <button className="btn-secondary opacity-70" type="button" disabled title="Vorbereitet fuer die Auftrags- und Angebotsstrecke">
                      <PackageCheck className="h-4 w-4" aria-hidden="true" />
                      Übernahme vorbereitet
                    </button>
                    <button className="btn-secondary opacity-70" type="button" disabled title="Reservierung laeuft produktiv ueber Mitbringlisten.">
                      <Warehouse className="h-4 w-4" aria-hidden="true" />
                      Reservierung vorbereitet
                    </button>
                    <button className="btn-secondary opacity-70" type="button" disabled title="PDF wird in der Angebots-/Rechnungsstrecke erzeugt.">
                      <FileDown className="h-4 w-4" aria-hidden="true" />
                      PDF vorbereitet
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
