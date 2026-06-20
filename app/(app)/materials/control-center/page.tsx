import Link from "next/link";
import { ArrowRight, PackageCheck, ShoppingCart, TriangleAlert, Warehouse, type LucideIcon } from "lucide-react";
import { ContextualHelpTip } from "@/components/help/ContextualHelpTip";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { reserveBringListMaterialsAction, updatePurchaseSuggestionStatusAction } from "@/lib/actions/bring-list-actions";
import { requireManager } from "@/lib/auth";
import { formatQuantity } from "@/lib/inventory";
import { criticalPositionText, loadBringListMaterialStatus, materialStatusText, tomorrowIsoDate } from "@/lib/inventory/material-intelligence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";

const riskStyles = {
  green: "border-primary/25 bg-mint text-primary-dark",
  yellow: "border-warning/35 bg-amber-50 text-amber-950",
  red: "border-red-200 bg-red-50 text-red-800",
  blue: "border-info/20 bg-blue-50 text-info"
} as const;

export default async function MaterialControlCenterPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const date = tomorrowIsoDate();
  const statuses = await loadBringListMaterialStatus({ supabase, companyId: context.companyId, date });
  const criticalCount = statuses.reduce((sum, status) => sum + status.summary.criticalCount, 0);
  const warningCount = statuses.reduce((sum, status) => sum + status.summary.warningCount, 0);
  const purchaseCount = statuses.reduce((sum, status) => sum + status.purchaseSuggestions.length, 0);

  return (
    <>
      <PageHeader
        title="Material Control Center"
        description={`Materialstatus für Baustellen am ${formatDate(date)}.`}
      />
      <MessageBox error={error} success={success} />
      <ContextualHelpTip featureKey="material_control_center" returnTo="/materials/control-center" />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Warehouse} label="Mitbringlisten morgen" value={statuses.length} tone="green" />
        <SummaryCard icon={TriangleAlert} label="Kritische Positionen" value={criticalCount} tone={criticalCount > 0 ? "red" : "green"} />
        <SummaryCard icon={TriangleAlert} label="Knappe Positionen" value={warningCount} tone={warningCount > 0 ? "yellow" : "green"} />
        <SummaryCard icon={ShoppingCart} label="Offene Einkaufsvorschläge" value={purchaseCount} tone={purchaseCount > 0 ? "yellow" : "green"} />
      </div>

      {statuses.length === 0 ? (
        <EmptyState
          icon={Warehouse}
          title="Keine Mitbringlisten für morgen"
          description="Sobald Mitbringlisten für morgen erstellt werden, prüft BauPro Lager, Reservierungen und Einkaufsvorschläge."
          actionHref="/bring-lists/new"
          actionLabel="Mitbringliste erstellen"
        />
      ) : (
        <div className="grid gap-4">
          {statuses.map((status) => (
            <article key={status.bringList.id} className="surface overflow-hidden p-0">
              <div className={`border-b p-4 ${riskStyles[status.summary.riskLevel]}`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="meta-label">{formatDate(status.bringList.date)}</p>
                    <h2 className="mt-1 text-xl font-black">{status.bringList.jobsites?.name ?? status.bringList.title}</h2>
                    <p className="mt-1 text-sm font-semibold">{status.bringList.jobsites?.address ?? "Keine Adresse"}</p>
                  </div>
                  <span className="w-fit rounded-md bg-white/80 px-3 py-1.5 text-xs font-black shadow-sm">
                    {status.summary.statusLabel}
                  </span>
                </div>
              </div>

              <div className="p-4 sm:p-5">
                <div className="grid gap-2 sm:grid-cols-4">
                  <Metric label="Positionen" value={status.summary.totalPositions} />
                  <Metric label="Kritisch" value={status.summary.criticalCount} />
                  <Metric label="Knapp" value={status.summary.warningCount} />
                  <Metric label="Einkauf offen" value={status.purchaseSuggestions.length} />
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="space-y-2">
                    <h3 className="text-sm font-black uppercase tracking-normal text-ink">Materialstatus</h3>
                    {status.positions.map((position) => (
                      <div key={position.item.id} className="rounded-md border border-line bg-fog p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-black text-ink">{position.materialName}</p>
                            <p className="mt-1 text-sm text-slate-600">
                              Bedarf {formatQuantity(position.availability.requiredQuantity)} {position.availability.unit} · verfügbar{" "}
                              {formatQuantity(position.availability.availableQuantity)} {position.availability.unit}
                              {position.availability.locationName ? ` · ${position.availability.locationName}` : ""}
                            </p>
                          </div>
                          <span className={`w-fit rounded-md border px-2.5 py-1 text-xs font-black ${riskStyles[position.availability.riskLevel]}`}>
                            {position.availability.statusLabel}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-black uppercase tracking-normal text-ink">Aktionen</h3>
                    <form action={reserveBringListMaterialsAction}>
                      <input type="hidden" name="bring_list_id" value={status.bringList.id} />
                      <button className="btn-primary w-full" type="submit">
                        <PackageCheck className="h-4 w-4" aria-hidden="true" />
                        Material reservieren
                      </button>
                    </form>
                    <Link href={`/bring-lists/${status.bringList.id}`} className="btn-secondary w-full">
                      Mitbringliste öffnen
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>

                    {status.summary.criticalCount > 0 ? (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                        <p className="font-black">Kritische Positionen</p>
                        <ul className="mt-2 space-y-1">
                          {status.positions
                            .filter((position) => position.availability.riskLevel === "red")
                            .slice(0, 4)
                            .map((position) => (
                              <li key={position.item.id}>{criticalPositionText(position)}</li>
                            ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="rounded-md border border-line bg-white p-3 text-sm font-semibold text-slate-600">
                        {materialStatusText(status)}
                      </p>
                    )}

                    {status.purchaseSuggestions.map((suggestion) => (
                      <form key={suggestion.id} action={updatePurchaseSuggestionStatusAction} className="rounded-md border border-line bg-white p-3">
                        <p className="text-sm font-black text-ink">
                          Einkauf: {formatQuantity(suggestion.quantity_needed)} {suggestion.unit}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{suggestion.reason}</p>
                        <input type="hidden" name="id" value={suggestion.id} />
                        <div className="mt-2 flex flex-wrap gap-2">
                          <button className="btn-secondary h-9 px-3 text-xs" name="status" value="ordered" type="submit">
                            Bestellt
                          </button>
                          <button className="btn-secondary h-9 px-3 text-xs" name="status" value="received" type="submit">
                            Erhalten
                          </button>
                        </div>
                      </form>
                    ))}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: keyof typeof riskStyles;
}) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${riskStyles[tone]}`}>
      <Icon className="h-5 w-5" aria-hidden="true" />
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="mt-1 text-sm font-black">{label}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <p className="meta-label">{label}</p>
      <p className="mt-1 text-xl font-black text-ink">{value}</p>
    </div>
  );
}
