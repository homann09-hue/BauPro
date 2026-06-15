import { notFound } from "next/navigation";
import { BriefcaseBusiness, Calculator, FileDown, ListChecks, LockKeyhole, PackageCheck, Warehouse } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { createBringListFromOrderAction } from "@/lib/actions/bring-list-actions";
import { recalculateOrderMaterialsAction, updateOrderStatusAction } from "@/lib/actions/order-actions";
import { requireAppContext } from "@/lib/auth";
import { formatQuantity } from "@/lib/inventory";
import { customerDisplayName, orderPriorityLabels, orderStatusLabels, orderTypeLabels } from "@/lib/order-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";
import type {
  JobDimension,
  JobMaterialRequirement,
  Order,
  OrderPriority,
  OrderStatus,
  PublicJobMaterialRequirement,
  PublicOrder
} from "@/types/app";

const orderStatuses = Object.keys(orderStatusLabels) as OrderStatus[];
const orderPriorities = Object.keys(orderPriorityLabels) as OrderPriority[];

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-md bg-fog p-3">
      <p className="meta-label">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm font-black text-ink">{value || "Keine Angabe"}</p>
    </div>
  );
}

function customerName(order: Order | PublicOrder) {
  if ("customers" in order && order.customers) return customerDisplayName(order.customers);
  if ("customer_name" in order && order.customer_name) return order.customer_name;
  return "Kunde";
}

function requirementTotals(items: JobMaterialRequirement[]) {
  return items.reduce(
    (totals, item) => ({
      purchase: totals.purchase + Number(item.purchase_total ?? 0),
      sales: totals.sales + Number(item.sales_total ?? 0),
      margin: totals.margin + Number(item.margin_total ?? 0)
    }),
    { purchase: 0, sales: 0, margin: 0 }
  );
}

export default async function OrderDetailPage({
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
  const materialSource = context.canManage ? "job_material_requirements" : "job_material_requirements_public";

  const [orderResult, dimensionResult, requirementResult] = await Promise.all([
    context.canManage
      ? supabase
          .from("orders")
          .select("*, customers(id, company, first_name, last_name, contact_person, phone, email), jobsites(id, name, address, customer)")
          .eq("id", id)
          .single()
      : supabase.from("orders_public").select("*").eq("id", id).single(),
    supabase.from("job_dimensions").select("*").eq("order_id", id).maybeSingle(),
    supabase.from(materialSource).select("*").eq("order_id", id).order("created_at", { ascending: true })
  ]);

  if (!orderResult.data) {
    notFound();
  }

  const order = orderResult.data as Order | PublicOrder;
  const dimension = dimensionResult.data as JobDimension | null;
  const requirements = (requirementResult.data ?? []) as Array<JobMaterialRequirement | PublicJobMaterialRequirement>;
  const pricedRequirements = requirements as JobMaterialRequirement[];
  const totals = context.canManage ? requirementTotals(pricedRequirements) : null;

  return (
    <>
      <PageHeader
        title={order.title}
        description={`${order.order_number} · ${customerName(order)} · ${orderTypeLabels[order.order_type]}`}
        actionHref={context.canManage ? `/orders/new?customer_id=${order.customer_id}` : undefined}
        actionLabel={context.canManage ? "Folgeauftrag" : undefined}
        actionIcon={BriefcaseBusiness}
      />
      <MessageBox error={error} success={success} />

      {!context.canManage ? (
        <div className="surface mb-5 flex items-start gap-3 p-4">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-moss" aria-hidden="true" />
          <div>
            <p className="font-black text-ink">Preisbereich ausgeblendet</p>
            <p className="mt-1 text-sm text-slate-600">
              Du siehst Materialbedarf, Lagerort und Bestand. EK, VK, Marge und interne Notizen bleiben Chef-Sache.
            </p>
          </div>
        </div>
      ) : null}

      <section className="surface mb-5 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Status" value={orderStatusLabels[order.status]} />
          <Info label="Priorität" value={orderPriorityLabels[order.priority]} />
          <Info label="Start" value={formatDate(order.start_date)} />
          <Info label="Ende" value={formatDate(order.end_date)} />
          <Info label="Kunde" value={customerName(order)} />
          <Info label="Adresse" value={order.jobsite_address} />
          <Info label="Team" value={`${order.assigned_employee_ids.length} Mitarbeiter`} />
          <Info label="Material" value={requirements.length ? `${requirements.length} Positionen` : "Noch nicht berechnet"} />
          {order.description ? <Info label="Beschreibung" value={order.description} /> : null}
          {context.canManage && "internal_notes" in order && order.internal_notes ? (
            <Info label="Interne Notizen" value={order.internal_notes} />
          ) : null}
        </div>

        {context.canManage ? (
          <form action={updateOrderStatusAction} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="order_id" value={order.id} />
            <label>
              <span className="field-label">Status</span>
              <select className="field-input" name="status" defaultValue={order.status}>
                {orderStatuses.map((status) => (
                  <option key={status} value={status}>
                    {orderStatusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Priorität</span>
              <select className="field-input" name="priority" defaultValue={order.priority}>
                {orderPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {orderPriorityLabels[priority]}
                  </option>
                ))}
              </select>
            </label>
            <button className="btn-primary self-end" type="submit">
              Status speichern
            </button>
          </form>
        ) : null}
      </section>

      <section className="mb-5 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-signal/15 text-amber-700">
              <Calculator className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="section-title">Maße</h2>
              <p className="text-sm text-slate-500">Grundlage für die automatische Materialliste.</p>
            </div>
          </div>

          {dimension ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Länge" value={dimension.length_m ? `${formatQuantity(dimension.length_m)} m` : null} />
              <Info label="Breite" value={dimension.width_m ? `${formatQuantity(dimension.width_m)} m` : null} />
              <Info label="Fläche" value={`${formatQuantity(dimension.area_m2)} m²`} />
              <Info label="Verschnitt" value={`${formatQuantity(dimension.waste_percent)} %`} />
              <Info label="Dachneigung" value={dimension.roof_pitch ? `${formatQuantity(dimension.roof_pitch)} °` : null} />
              <Info label="Traufe" value={dimension.eaves_length_m ? `${formatQuantity(dimension.eaves_length_m)} m` : null} />
              <Info label="First" value={dimension.ridge_length_m ? `${formatQuantity(dimension.ridge_length_m)} m` : null} />
              <Info label="Ortgang" value={dimension.verge_length_m ? `${formatQuantity(dimension.verge_length_m)} m` : null} />
              <Info label="Kehle" value={dimension.valley_length_m ? `${formatQuantity(dimension.valley_length_m)} m` : null} />
              <Info
                label="Wandanschluss"
                value={dimension.wall_connection_length_m ? `${formatQuantity(dimension.wall_connection_length_m)} m` : null}
              />
              <Info label="Fallrohr" value={dimension.downpipe_length_m ? `${formatQuantity(dimension.downpipe_length_m)} m` : null} />
              <Info label="Dachfenster" value={dimension.roof_windows_count} />
            </div>
          ) : (
            <EmptyState
              icon={Calculator}
              title="Keine Maße"
              description="Dieser Auftrag wurde ohne Maße angelegt. Lege bei Bedarf einen neuen Auftrag mit Maßeingabe an."
            />
          )}
        </div>

        <aside className="surface p-4 sm:p-5">
          <h2 className="section-title">Chef-Summen</h2>
          {context.canManage && totals ? (
            <div className="mt-4 grid gap-3">
              <Info label="EK gesamt" value={formatMoney(totals.purchase)} />
              <Info label="VK gesamt" value={formatMoney(totals.sales)} />
              <Info label="Marge" value={formatMoney(totals.margin)} />
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-line bg-fog p-3 text-sm font-semibold text-slate-600">
              Preise sind für Mitarbeiter ausgeblendet.
            </div>
          )}
          {context.canManage && dimension ? (
            <form action={recalculateOrderMaterialsAction} className="mt-4">
              <input type="hidden" name="order_id" value={order.id} />
              <button className="btn-primary w-full" type="submit">
                <Calculator className="h-4 w-4" aria-hidden="true" />
                Material neu berechnen
              </button>
            </form>
          ) : null}
          {context.canManage && requirements.length > 0 && "jobsite_id" in order && order.jobsite_id ? (
            <form action={createBringListFromOrderAction} className="mt-3">
              <input type="hidden" name="order_id" value={order.id} />
              <button className="btn-secondary w-full" type="submit">
                <ListChecks className="h-4 w-4" aria-hidden="true" />
                Mitbringliste für morgen
              </button>
            </form>
          ) : null}
        </aside>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">Materialbedarf</h2>
            <p className="mt-1 text-sm text-slate-500">
              Berechnet am {requirements[0]?.created_at ? formatDateTime(requirements[0].created_at) : "noch nicht berechnet"}.
            </p>
          </div>
          <StatusBadge value={order.status} />
        </div>

        {requirements.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Noch keine Materialliste"
            description={
              context.canManage
                ? "Sobald Maße vorhanden sind, kann der Materialbedarf neu berechnet werden."
                : "Für diesen Auftrag ist noch keine Materialliste vorhanden."
            }
          />
        ) : (
          <article className="surface-strong overflow-hidden">
            <div className="grid gap-3 p-4">
              {requirements.map((item) => (
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
                          <p className="meta-label">EK/VK</p>
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
              <button className="btn-secondary opacity-70" type="button" disabled title="Vorbereitet fuer die Angebotsstrecke">
                <PackageCheck className="h-4 w-4" aria-hidden="true" />
                Übernahme vorbereitet
              </button>
              <button className="btn-secondary opacity-70" type="button" disabled title="Reservierung laeuft ueber Mitbringlisten und wird hier spaeter direkt angebunden.">
                <Warehouse className="h-4 w-4" aria-hidden="true" />
                Reservierung vorbereitet
              </button>
              <button className="btn-secondary opacity-70" type="button" disabled title="PDF wird in der Angebots-/Rechnungsstrecke erzeugt.">
                <FileDown className="h-4 w-4" aria-hidden="true" />
                PDF vorbereitet
              </button>
            </div>
          </article>
        )}
      </section>
    </>
  );
}
