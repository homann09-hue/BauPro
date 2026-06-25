import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import {
  BriefcaseBusiness,
  Calculator,
  ExternalLink,
  FileDown,
  FileSignature,
  FileText,
  ListChecks,
  LockKeyhole,
  MessageSquareText,
  PackageCheck,
  ReceiptText,
  Send,
  XCircle
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { CustomerPortalLinkForm } from "@/components/customer-portal/customer-portal-link-form";
import { WorkOrderDraftForm } from "@/components/customer-portal/work-order-draft-form";
import { WorkOrderSendButton } from "@/components/customer-portal/work-order-send-button";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { createInvoiceFromOrderAction } from "@/lib/actions/invoice-actions";
import { createBringListFromOrderAction } from "@/lib/actions/bring-list-actions";
import {
  createCustomerPortalEventAction,
  revokeCustomerPortalLinkAction,
  uploadCustomerDocumentAction
} from "@/lib/actions/customer-portal-actions";
import {
  archiveOrderMeasurementItemAction,
  createOrderMeasurementItemAction,
  recalculateOrderMaterialsAction,
  updateOrderDimensionsAction,
  updateOrderStatusAction
} from "@/lib/actions/order-actions";
import { requireAppContext } from "@/lib/auth";
import { customerPortalUrl } from "@/lib/customer-portal/tokens";
import { orderMeasurementItemSelect } from "@/lib/data/selects";
import { formatQuantity } from "@/lib/inventory";
import { customerDisplayName, orderPriorityLabels, orderStatusLabels, orderTypeLabels } from "@/lib/order-labels";
import { aggregateMeasurementItems, orderMeasurementItemTypeLabels } from "@/lib/order-measurements";
import { publicAppOrigin } from "@/lib/security/origin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";
import type {
  CustomerPortalToken,
  CustomerDocument,
  CustomerPortalEvent,
  CustomerPortalMessage,
  JobDimension,
  JobMaterialRequirement,
  Order,
  OrderMeasurementItem,
  OrderMeasurementItemType,
  OrderPriority,
  OrderStatus,
  PublicJobMaterialRequirement,
  PublicOrder,
  WorkOrder
} from "@/types/app";

const orderStatuses = Object.keys(orderStatusLabels) as OrderStatus[];
const orderPriorities = Object.keys(orderPriorityLabels) as OrderPriority[];
type PortalTokenListItem = Pick<
  CustomerPortalToken,
  "id" | "company_id" | "customer_id" | "jobsite_id" | "label" | "expires_at" | "revoked_at" | "created_by" | "created_at" | "last_used_at"
>;
type WorkOrderListItem = Pick<
  WorkOrder,
  | "id"
  | "company_id"
  | "customer_id"
  | "jobsite_id"
  | "order_id"
  | "title"
  | "description"
  | "scope_of_work"
  | "price_note"
  | "status"
  | "version"
  | "content_hash"
  | "sent_at"
  | "viewed_at"
  | "signed_at"
  | "rejected_at"
  | "signer_name"
  | "rejection_reason"
  | "created_by"
  | "created_at"
  | "updated_at"
>;
type OrderCostEstimateRow = {
  id: string;
  company_id: string;
  job_id: string;
  material_ek_total: number;
  material_vk_total: number;
  labor_hours_estimated: number;
  labor_rate_net: number;
  labor_total_net: number;
  overhead_percent: number;
  overhead_total: number;
  profit_markup_percent: number;
  profit_total: number;
  subtotal_net: number;
  vat_rate: number;
  vat_total: number;
  total_gross: number;
  price_source_summary: Record<string, unknown> | null;
  created_at: string;
  job_estimate_items?: OrderCostEstimateItemRow[];
};
type OrderCostEstimateItemRow = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  ek_unit_price: number | null;
  vk_unit_price: number | null;
  ek_total: number | null;
  vk_total: number | null;
  price_source: string;
  notes: string | null;
};

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

function estimateNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function estimateSummaryNumber(estimate: OrderCostEstimateRow, key: string) {
  const rawValue = estimate.price_source_summary?.[key];
  if (typeof rawValue === "number" || typeof rawValue === "string") return estimateNumber(rawValue);
  return 0;
}

function estimateSummaryWarnings(estimate: OrderCostEstimateRow) {
  const rawValue = estimate.price_source_summary?.roofing_material_warnings;
  return Array.isArray(rawValue) ? rawValue.filter((item): item is string => typeof item === "string") : [];
}

function OrderCostEstimatePanel({ estimate }: { estimate: OrderCostEstimateRow | null }) {
  if (!estimate) {
    return null;
  }

  const areaM2 = estimateSummaryNumber(estimate, "area_m2");
  const materialCostPerM2 = estimateSummaryNumber(estimate, "material_cost_per_m2");
  const travelKm = estimateSummaryNumber(estimate, "travel_km");
  const travelTripCount = estimateSummaryNumber(estimate, "travel_trip_count") || 1;
  const travelBillableKm = estimateSummaryNumber(estimate, "travel_billable_km");
  const travelRatePerKm = estimateSummaryNumber(estimate, "travel_rate_per_km");
  const travelFlatRate = estimateSummaryNumber(estimate, "travel_flat_rate");
  const travelTotal = estimateSummaryNumber(estimate, "travel_total_net");
  const machineExtraTotal = estimateSummaryNumber(estimate, "machine_extra_total_net");
  const laborEmployeeCount = estimateSummaryNumber(estimate, "labor_employee_count") || 1;
  const laborPersonHours = estimateSummaryNumber(estimate, "labor_person_hours") || estimateNumber(estimate.labor_hours_estimated);
  const internalLaborRate = estimateSummaryNumber(estimate, "internal_labor_rate_net");
  const laborInternalTotal = estimateSummaryNumber(estimate, "labor_internal_total_net");
  const laborSalesTotal = estimateSummaryNumber(estimate, "labor_sales_total_net") || estimateNumber(estimate.labor_total_net);
  const laborMarginTotal = estimateSummaryNumber(estimate, "labor_margin_total");
  const estimateItems = estimate.job_estimate_items ?? [];
  const warnings = estimateSummaryWarnings(estimate);

  return (
    <section className="surface mb-5 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="meta-label">Chef-Kalkulation</p>
          <h2 className="section-title">Direkte Kostenkalkulation</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            Gespeichert am {formatDateTime(estimate.created_at)}. Diese Werte sind nur für Chef/Admin sichtbar.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <div className="rounded-lg bg-mint px-4 py-3 text-right">
            <p className="meta-label text-primary-dark">Brutto</p>
            <p className="text-2xl font-black text-primary-dark">{formatMoney(estimateNumber(estimate.total_gross))}</p>
          </div>
          <a href={`/orders/${estimate.job_id}/quote.pdf`} className="btn-secondary">
            <FileDown className="h-4 w-4" aria-hidden="true" />
            Angebots-PDF herunterladen
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Info
          label="Material netto"
          value={`${formatMoney(estimateNumber(estimate.material_ek_total))}${areaM2 ? ` · ${formatQuantity(areaM2)} m² à ${formatMoney(materialCostPerM2)}` : ""}`}
        />
        <Info
          label="Arbeitsleistung VK"
          value={`${formatMoney(laborSalesTotal)} · ${formatQuantity(laborPersonHours)} Personenstunden · ${formatMoney(estimateNumber(estimate.labor_rate_net))}/h`}
        />
        <Info
          label="Interne Lohnkosten"
          value={`${formatMoney(laborInternalTotal)} · ${formatQuantity(laborEmployeeCount)} Mitarbeiter · ${formatMoney(internalLaborRate)}/h`}
        />
        <Info label="Arbeitsmarge" value={formatMoney(laborMarginTotal)} />
        <Info
          label="Fahrtkosten netto"
          value={`${formatMoney(travelTotal)}${travelKm ? ` · ${formatQuantity(travelKm)} km einfach · 2 x ${formatQuantity(travelTripCount)} Fahrten · ${formatQuantity(travelBillableKm)} km à ${formatMoney(travelRatePerKm)}` : ""}${travelFlatRate ? ` · Pauschale ${formatMoney(travelFlatRate)}` : ""}`}
        />
        <Info label="Maschinen/Extras netto" value={formatMoney(machineExtraTotal)} />
        <Info label="Netto gesamt" value={formatMoney(estimateNumber(estimate.subtotal_net))} />
        <Info label={`MwSt ${formatQuantity(estimateNumber(estimate.vat_rate))} %`} value={formatMoney(estimateNumber(estimate.vat_total))} />
        <Info label="Brutto gesamt" value={formatMoney(estimateNumber(estimate.total_gross))} />
        <Info label="Quelle" value="Manuelle Chef-Kalkulation beim Auftrag" />
      </div>

      {estimateItems.length > 0 ? (
        <div className="mt-4 rounded-lg border border-line bg-fog p-3">
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="meta-label">Dachdecker-Material</p>
              <h3 className="text-base font-black text-ink">Berechnete Materialpositionen</h3>
            </div>
            <p className="text-sm font-black text-primary-dark">{estimateItems.length} Positionen</p>
          </div>
          <div className="grid gap-2">
            {estimateItems.map((item) => (
              <div key={item.id} className="rounded-md border border-line bg-white p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black text-ink">{item.description}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatQuantity(estimateNumber(item.quantity))} {item.unit} · {item.price_source}
                    </p>
                    {item.notes ? <p className="mt-1 text-xs font-semibold text-slate-500">{item.notes}</p> : null}
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-black text-ink">{item.ek_total === null ? "Preis fehlt" : formatMoney(item.ek_total)}</p>
                    {item.ek_unit_price !== null ? (
                      <p className="text-xs font-semibold text-slate-500">{formatMoney(item.ek_unit_price)} / {item.unit}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-black text-amber-900">Preiswarnungen</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-amber-800">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function CommercialDocumentPanel({
  order,
  materialCount,
  salesTotal
}: {
  order: Order;
  materialCount: number;
  salesTotal: number;
}) {
  return (
    <section className="surface mb-5 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="meta-label">Kaufmännischer Kern</p>
          <h2 className="section-title">Angebot oder Rechnung aus Auftrag erstellen</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            BauPro übernimmt Materialpositionen, Mengen und VK-Preise aus der Auftragsberechnung. Preise bleiben nur für Chef/Admin sichtbar.
          </p>
        </div>
        <Link href="/invoices" className="btn-secondary">
          <ReceiptText className="h-4 w-4" aria-hidden="true" />
          Belege öffnen
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_260px]">
        <form action={createInvoiceFromOrderAction} className="rounded-lg border border-line bg-fog p-4">
          <input type="hidden" name="order_id" value={order.id} />
          <input type="hidden" name="document_type" value="quote" />
          <p className="font-black text-ink">Angebot vorbereiten</p>
          <p className="mt-1 text-sm text-slate-600">Ideal nach Aufmaß und Materialberechnung. Status wird auf „Angebot“ gesetzt.</p>
          <label className="mt-3 block">
            <span className="field-label">Betreff</span>
            <input className="field-input" name="subject" defaultValue={`Angebot ${order.title}`} />
          </label>
          <button className="btn-primary mt-3 w-full" type="submit">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Angebot erstellen
          </button>
        </form>

        <form action={createInvoiceFromOrderAction} className="rounded-lg border border-line bg-fog p-4">
          <input type="hidden" name="order_id" value={order.id} />
          <input type="hidden" name="document_type" value="invoice" />
          <p className="font-black text-ink">Rechnung vorbereiten</p>
          <p className="mt-1 text-sm text-slate-600">Für fertige Leistungen. Positionen und Summen werden automatisch übernommen.</p>
          <label className="mt-3 block">
            <span className="field-label">Betreff</span>
            <input className="field-input" name="subject" defaultValue={`Rechnung ${order.title}`} />
          </label>
          <button className="btn-secondary mt-3 w-full" type="submit">
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
            Rechnung erstellen
          </button>
        </form>

        <div className="rounded-lg border border-primary/20 bg-mint p-4">
          <p className="meta-label">Übernahme</p>
          <p className="mt-1 text-2xl font-black text-primary-dark">{materialCount}</p>
          <p className="text-sm font-semibold text-primary-dark">Materialpositionen</p>
          <p className="mt-4 text-sm font-semibold text-primary-dark">VK-Summe netto</p>
          <p className="text-xl font-black text-primary-dark">{formatMoney(salesTotal)}</p>
        </div>
      </div>
    </section>
  );
}

function decimalDefault(value?: number | null) {
  return value === null || value === undefined ? "" : String(value).replace(".", ",");
}

function DimensionField({
  label,
  name,
  value,
  inputMode = "decimal"
}: {
  label: string;
  name: string;
  value?: number | null;
  inputMode?: "decimal" | "numeric";
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <input className="field-input" name={name} inputMode={inputMode} defaultValue={decimalDefault(value)} />
    </label>
  );
}

const measurementTypes = Object.keys(orderMeasurementItemTypeLabels) as OrderMeasurementItemType[];

const measurementTypeHelp: Record<OrderMeasurementItemType, string> = {
  roof_area: "Länge x Breite, optional mit Dachneigung",
  deduction_area: "Öffnungen oder Abzüge von der Dachfläche",
  eaves_length: "Traufe in laufenden Metern",
  ridge_length: "First in laufenden Metern",
  verge_length: "Ortgang in laufenden Metern",
  valley_length: "Kehle in laufenden Metern",
  wall_connection_length: "Wandanschluss in laufenden Metern",
  downpipe_length: "Fallrohrlänge in laufenden Metern",
  roof_window: "Anzahl Dachfenster",
  penetration: "Anzahl Durchdringungen",
  roof_drain: "Anzahl Dachabläufe",
  emergency_overflow: "Anzahl Notüberläufe"
};

function measurementResultLabel(item: OrderMeasurementItem) {
  if (item.calculated_area_m2 > 0) return `${formatQuantity(item.calculated_area_m2)} m²`;
  if (item.calculated_length_m > 0) return `${formatQuantity(item.calculated_length_m)} m`;
  if (item.count_value > 0) return `${formatQuantity(item.count_value)} Stück`;
  return "0";
}

function MeasurementItemsPanel({
  orderId,
  items,
  wastePercent
}: {
  orderId: string;
  items: OrderMeasurementItem[];
  wastePercent: number;
}) {
  const summary = aggregateMeasurementItems(items, wastePercent);
  const grossArea = items
    .filter((item) => item.item_type === "roof_area")
    .reduce((sum, item) => sum + Number(item.calculated_area_m2 ?? 0), 0);
  const deductionArea = items
    .filter((item) => item.item_type === "deduction_area")
    .reduce((sum, item) => sum + Number(item.calculated_area_m2 ?? 0), 0);

  return (
    <section className="mt-5 rounded-lg border border-line bg-fog p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="meta-label">Praxis-Aufmaß</p>
          <h3 className="text-base font-black text-ink">Dachflächen, Abzüge und laufende Meter</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
            Erfasse Positionen wie auf dem Baustellenzettel. BauPro bildet daraus automatisch die Gesamtmaße und berechnet die Materialliste neu.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm lg:min-w-[360px]">
          <div className="rounded-md bg-white p-2">
            <p className="meta-label">Brutto</p>
            <p className="font-black text-ink">{formatQuantity(grossArea)} m²</p>
          </div>
          <div className="rounded-md bg-white p-2">
            <p className="meta-label">Abzug</p>
            <p className="font-black text-ink">{formatQuantity(deductionArea)} m²</p>
          </div>
          <div className="rounded-md bg-mint p-2">
            <p className="meta-label text-moss">Netto</p>
            <p className="font-black text-ink">{formatQuantity(summary.area_m2)} m²</p>
          </div>
        </div>
      </div>

      <form action={createOrderMeasurementItemAction} className="mt-4 grid gap-3 rounded-lg border border-line bg-white p-3 sm:grid-cols-2 xl:grid-cols-6">
        <input type="hidden" name="order_id" value={orderId} />
        <label className="sm:col-span-2 xl:col-span-2">
          <span className="field-label">Position</span>
          <select className="field-input" name="item_type" defaultValue="roof_area">
            {measurementTypes.map((type) => (
              <option key={type} value={type}>
                {orderMeasurementItemTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2 xl:col-span-2">
          <span className="field-label">Bezeichnung</span>
          <input className="field-input" name="label" placeholder="z. B. Hauptdach Südseite" />
        </label>
        <DimensionField label="Länge m" name="length_m" />
        <DimensionField label="Breite m" name="width_m" />
        <DimensionField label="Anzahl" name="quantity" value={1} />
        <DimensionField label="Dachneigung °" name="pitch_deg" />
        <label className="sm:col-span-2 xl:col-span-4">
          <span className="field-label">Notiz</span>
          <input className="field-input" name="notes" placeholder="optional, z. B. Gaube rechts abziehen" />
        </label>
        <button className="btn-primary self-end sm:col-span-2 xl:col-span-2" type="submit">
          <Calculator className="h-4 w-4" aria-hidden="true" />
          Position speichern
        </button>
      </form>

      <div className="mt-4 grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-4">
            <p className="font-black text-ink">Noch kein Aufmaß erfasst</p>
            <p className="mt-1 text-sm text-slate-600">
              Starte mit der ersten Dachfläche. Danach kannst du Öffnungen, Traufen, Firste und Anschlüsse ergänzen.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-lg border border-line bg-white p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-black text-ink">{item.label}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {orderMeasurementItemTypeLabels[item.item_type]} · {measurementTypeHelp[item.item_type]}
                  </p>
                  {item.notes ? <p className="mt-2 text-sm text-slate-600">{item.notes}</p> : null}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 lg:min-w-[520px]">
                  <div className="rounded-md bg-fog p-2">
                    <p className="meta-label">Länge</p>
                    <p className="font-black text-ink">{item.length_m ? `${formatQuantity(item.length_m)} m` : "-"}</p>
                  </div>
                  <div className="rounded-md bg-fog p-2">
                    <p className="meta-label">Breite</p>
                    <p className="font-black text-ink">{item.width_m ? `${formatQuantity(item.width_m)} m` : "-"}</p>
                  </div>
                  <div className="rounded-md bg-mint p-2">
                    <p className="meta-label text-moss">Ergebnis</p>
                    <p className="font-black text-ink">{measurementResultLabel(item)}</p>
                  </div>
                  <form action={archiveOrderMeasurementItemAction}>
                    <input type="hidden" name="order_id" value={orderId} />
                    <input type="hidden" name="item_id" value={item.id} />
                    <button className="btn-secondary h-full w-full justify-center" type="submit">
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                      Archivieren
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

const workOrderStatusLabels = {
  draft: "Entwurf",
  sent: "Gesendet",
  viewed: "Gesehen",
  signed: "Unterschrieben",
  rejected: "Abgelehnt"
} as const;

function CustomerPortalPanel({
  order,
  portalTokens,
  portalEvents,
  portalMessages,
  customerDocuments,
  workOrders,
  origin,
  createdPortalToken,
  nowIso
}: {
  order: Order;
  portalTokens: PortalTokenListItem[];
  portalEvents: CustomerPortalEvent[];
  portalMessages: CustomerPortalMessage[];
  customerDocuments: CustomerDocument[];
  workOrders: WorkOrderListItem[];
  origin: string;
  createdPortalToken: string | null;
  nowIso: string;
}) {
  const freshLink = createdPortalToken ? customerPortalUrl(origin, createdPortalToken) : null;
  const nowTime = new Date(nowIso).getTime();

  return (
    <section className="surface mb-5 p-4 sm:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="meta-label">Kundenportal</p>
          <h2 className="section-title">Kundenfreigabe & Arbeitsauftrag</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Kunden sehen nur freigegebene Fotos, sichtbare Updates und gesendete Arbeitsaufträge. Interne Preise,
            Lagerdaten und Teamnotizen bleiben ausgeblendet.
          </p>
        </div>
        <CustomerPortalLinkForm orderId={order.id} defaultLabel={`Portal ${order.order_number}`} />
      </div>

      {freshLink ? (
        <div className="mb-4 rounded-lg border border-primary/20 bg-mint p-3">
          <p className="text-sm font-black text-ink">Neuer Kundenlink, nur jetzt voll sichtbar</p>
          <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_auto]">
            <input className="field-input bg-white" readOnly value={freshLink} />
            <a href={freshLink} target="_blank" rel="noreferrer" className="btn-secondary">
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Öffnen
            </a>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-black text-ink">Aktive Kundenlinks</h3>
            <span className="rounded-md bg-fog px-2 py-1 text-xs font-black text-slate-600">{portalTokens.length}</span>
          </div>
          {portalTokens.length === 0 ? (
            <p className="rounded-md border border-dashed border-line p-3 text-sm font-semibold text-slate-600">
              Noch kein Kundenlink für diesen Auftrag. Erzeuge einen Link, wenn Fotos oder Arbeitsauftrag freigegeben werden sollen.
            </p>
          ) : (
            <div className="space-y-2">
              {portalTokens.map((token) => {
                const revoked = Boolean(token.revoked_at);
                const expired = new Date(token.expires_at).getTime() <= nowTime;
                return (
                  <div key={token.id} className="rounded-md border border-line bg-fog p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-ink">{token.label || "Kundenlink"}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          Gültig bis {formatDateTime(token.expires_at)} · letzter Zugriff {formatDateTime(token.last_used_at)}
                        </p>
                      </div>
                      <span
                        className={`rounded-md px-2 py-1 text-xs font-black ${
                          revoked || expired ? "bg-red-50 text-red-700" : "bg-mint text-primary"
                        }`}
                      >
                        {revoked ? "Gesperrt" : expired ? "Abgelaufen" : "Aktiv"}
                      </span>
                    </div>
                    {!revoked ? (
                      <form action={revokeCustomerPortalLinkAction} className="mt-3">
                        <input type="hidden" name="order_id" value={order.id} />
                        <input type="hidden" name="token_id" value={token.id} />
                        <button className="btn-secondary min-h-10 text-xs" type="submit">
                          <XCircle className="h-4 w-4" aria-hidden="true" />
                          Link sperren
                        </button>
                      </form>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="font-black text-ink">Arbeitsaufträge</h3>
          </div>

          <WorkOrderDraftForm orderId={order.id} orderNumber={order.order_number} defaultDescription={order.description} />

          {workOrders.length === 0 ? (
            <p className="rounded-md border border-dashed border-line p-3 text-sm font-semibold text-slate-600">
              Noch kein Arbeitsauftrag angelegt.
            </p>
          ) : (
            <div className="space-y-2">
              {workOrders.map((workOrder) => (
                <div key={workOrder.id} className="rounded-md border border-line p-3" data-testid="work-order-card">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black text-ink">{workOrder.title}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Version {workOrder.version} · {workOrderStatusLabels[workOrder.status]} · erstellt {formatDateTime(workOrder.created_at)}
                      </p>
                    </div>
                    <span className="rounded-md bg-fog px-2 py-1 text-xs font-black text-slate-600">
                      {workOrderStatusLabels[workOrder.status]}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{workOrder.scope_of_work}</p>
                  {workOrder.status === "draft" ? (
                    <WorkOrderSendButton orderId={order.id} workOrderId={workOrder.id} />
                  ) : workOrder.status === "signed" ? (
                    <p className="mt-3 rounded-md bg-mint p-3 text-sm font-semibold text-primary">
                      Unterschrieben von {workOrder.signer_name || "Kunde"} am {formatDateTime(workOrder.signed_at)}.
                    </p>
                  ) : workOrder.status === "rejected" ? (
                    <p className="mt-3 rounded-md bg-red-50 p-3 text-sm font-semibold text-red-700">
                      Abgelehnt: {workOrder.rejection_reason || "Keine Begründung angegeben."}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="font-black text-ink">Kundenfragen</h3>
            </div>
            <span className="rounded-md bg-fog px-2 py-1 text-xs font-black text-slate-600">{portalMessages.length}</span>
          </div>
          {portalMessages.length === 0 ? (
            <p className="rounded-md border border-dashed border-line p-3 text-sm font-semibold text-slate-600">
              Noch keine Frage aus dem Kundenportal.
            </p>
          ) : (
            <div className="space-y-2">
              {portalMessages.slice(0, 6).map((message) => (
                <div key={message.id} className="rounded-md border border-line bg-fog p-3">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-black text-ink">{message.sender_name}</p>
                    <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">
                      {message.status === "open" ? "Offen" : message.status === "answered" ? "Beantwortet" : "Archiviert"}
                    </span>
                  </div>
                  {message.sender_email ? <p className="mt-1 text-xs font-semibold text-slate-500">{message.sender_email}</p> : null}
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{message.message}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">{formatDateTime(message.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <MessageSquareText className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="font-black text-ink">Kundenupdate veroeffentlichen</h3>
          </div>
          <form action={createCustomerPortalEventAction} className="grid gap-3 rounded-lg border border-line bg-fog p-3">
            <input type="hidden" name="order_id" value={order.id} />
            <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
              <label>
                <span className="field-label">Art</span>
                <select className="field-input" name="event_type" defaultValue="update">
                  <option value="update">Update</option>
                  <option value="status">Status</option>
                  <option value="appointment">Termin</option>
                  <option value="document">Dokument</option>
                </select>
              </label>
              <label>
                <span className="field-label">Titel</span>
                <input className="field-input" name="title" placeholder="z. B. Arbeiten für morgen bestätigt" required />
              </label>
            </div>
            <label>
              <span className="field-label">Nachricht für Kunden</span>
              <textarea className="field-input min-h-24" name="body" placeholder="Kurz, klar und ohne interne Notizen." />
            </label>
            <button className="btn-primary justify-self-start" type="submit">
              <Send className="h-4 w-4" aria-hidden="true" />
              Im Portal anzeigen
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {portalEvents.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-md border border-line bg-fog p-3">
                <p className="font-black text-ink">{event.title}</p>
                {event.body ? <p className="mt-1 text-sm text-slate-600">{event.body}</p> : null}
                <p className="mt-2 text-xs font-semibold text-slate-500">{formatDateTime(event.event_date)}</p>
              </div>
            ))}
            {portalEvents.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-3 text-sm font-semibold text-slate-600">
                Noch keine Kundenupdates veroeffentlicht.
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-line bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="font-black text-ink">Dokument freigeben</h3>
          </div>
          <form action={uploadCustomerDocumentAction} className="grid gap-3 rounded-lg border border-line bg-fog p-3">
            <input type="hidden" name="order_id" value={order.id} />
            <label>
              <span className="field-label">Titel im Portal</span>
              <input className="field-input" name="title" placeholder="z. B. Angebot, Aufmaß, Fotodokumentation" />
            </label>
            <label>
              <span className="field-label">Datei</span>
              <input className="field-input" name="document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
            </label>
            <p className="text-xs font-semibold text-slate-500">Erlaubt: PDF, JPG, PNG, WebP bis 15 MB. Dokumente sind nur über den Kundenlink sichtbar.</p>
            <button className="btn-primary justify-self-start" type="submit">
              <FileText className="h-4 w-4" aria-hidden="true" />
              Hochladen & freigeben
            </button>
          </form>

          <div className="mt-4 space-y-2">
            {customerDocuments.map((document) => (
              <div key={document.id} className="rounded-md border border-line bg-fog p-3">
                <p className="font-black text-ink">{document.title}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {document.content_type || "Datei"} · freigegeben {formatDateTime(document.created_at)}
                </p>
              </div>
            ))}
            {customerDocuments.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-3 text-sm font-semibold text-slate-600">
                Noch keine Dokumente im Kundenportal.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
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
  const resolvedSearchParams = await searchParams;
  const { error, success } = searchParamMessage(resolvedSearchParams);
  const createdPortalToken = typeof resolvedSearchParams?.portal_token === "string" ? resolvedSearchParams.portal_token : null;
  const materialSource = context.canManage ? "job_material_requirements" : "job_material_requirements_public";
  const orderSelect =
    "id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, priority, jobsite_address, start_date, end_date, description, internal_notes, assigned_employee_ids, has_dimensions, created_by, created_at, updated_at, customers(id, company, first_name, last_name, contact_person, phone, email), jobsites(id, name, address, customer)";
  const publicOrderSelect =
    "id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, priority, jobsite_address, start_date, end_date, description, assigned_employee_ids, has_dimensions, created_by, created_at, updated_at, customer_name";
  const dimensionSelect =
    "id, company_id, order_id, length_m, width_m, area_m2, roof_pitch, eaves_length_m, ridge_length_m, valley_length_m, wall_connection_length_m, building_height_m, downpipe_length_m, roof_windows_count, penetrations_count, roof_drains_count, emergency_overflows_count, waste_percent, notes, created_by, archived_at, created_at, updated_at";
  const requirementSelect = context.canManage
    ? "id, company_id, order_id, dimension_id, jobsite_id, rule_id, catalog_item_id, inventory_item_id, material_name, unit, base_quantity, waste_percent, waste_quantity, total_quantity, purchase_price, sales_price, purchase_total, sales_total, margin_total, location_name, stock, minimum_stock, archived_at, created_at"
    : "id, company_id, order_id, dimension_id, jobsite_id, rule_id, catalog_item_id, inventory_item_id, material_name, unit, base_quantity, waste_percent, waste_quantity, total_quantity, location_name, stock, minimum_stock, archived_at, created_at";
  const estimateSelect =
    "id, company_id, job_id, material_ek_total, material_vk_total, labor_hours_estimated, labor_rate_net, labor_total_net, overhead_percent, overhead_total, profit_markup_percent, profit_total, subtotal_net, vat_rate, vat_total, total_gross, price_source_summary, created_at, job_estimate_items(id, description, quantity, unit, ek_unit_price, vk_unit_price, ek_total, vk_total, price_source, notes)";
  const measurementQuery = context.canManage
    ? supabase
        .from("order_measurement_items")
        .select(orderMeasurementItemSelect)
        .eq("order_id", id)
        .is("archived_at", null)
        .order("created_at", { ascending: true })
    : Promise.resolve({ data: [], error: null });
  const estimateQuery = context.canManage
    ? supabase
        .from("job_estimates")
        .select(estimateSelect)
        .eq("company_id", context.companyId)
        .eq("job_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null, error: null });

  const [orderResult, dimensionResult, requirementResult, measurementResult, estimateResult] = await Promise.all([
    context.canManage
      ? supabase
          .from("orders")
          .select(orderSelect)
          .eq("id", id)
          .single()
      : supabase.from("orders_public").select(publicOrderSelect).eq("id", id).single(),
    supabase.from("job_dimensions").select(dimensionSelect).eq("order_id", id).is("archived_at", null).maybeSingle(),
    supabase.from(materialSource).select(requirementSelect).eq("order_id", id).is("archived_at", null).order("created_at", { ascending: true }),
    measurementQuery,
    estimateQuery
  ]);

  if (!orderResult.data) {
    notFound();
  }

  const order = orderResult.data as unknown as Order | PublicOrder;
  const dimension = dimensionResult.data as unknown as JobDimension | null;
  const requirements = (requirementResult.data ?? []) as unknown as Array<JobMaterialRequirement | PublicJobMaterialRequirement>;
  const measurementItems = (measurementResult.data ?? []) as unknown as OrderMeasurementItem[];
  const costEstimate = (estimateResult.data ?? null) as unknown as OrderCostEstimateRow | null;
  const pricedRequirements = requirements as JobMaterialRequirement[];
  const totals = context.canManage ? requirementTotals(pricedRequirements) : null;
  let portalTokens: PortalTokenListItem[] = [];
  let portalEvents: CustomerPortalEvent[] = [];
  let portalMessages: CustomerPortalMessage[] = [];
  let customerDocuments: CustomerDocument[] = [];
  let workOrders: WorkOrderListItem[] = [];
  let portalOrigin = "http://localhost:3000";

  if (context.canManage) {
    const headerStore = await headers();
    portalOrigin = publicAppOrigin(headerStore.get("origin"));
    let tokenQuery = supabase
      .from("customer_portal_tokens")
      .select("id, company_id, customer_id, jobsite_id, label, expires_at, revoked_at, created_by, created_at, last_used_at")
      .eq("company_id", context.companyId)
      .eq("customer_id", order.customer_id)
      .order("created_at", { ascending: false })
      .limit(8);
    if (order.jobsite_id) tokenQuery = tokenQuery.eq("jobsite_id", order.jobsite_id);
    let eventQuery = supabase
      .from("customer_portal_events")
      .select("id, company_id, customer_id, jobsite_id, event_type, title, body, visible_to_customer, event_date, created_by, created_at")
      .eq("company_id", context.companyId)
      .eq("customer_id", order.customer_id)
      .eq("visible_to_customer", true)
      .order("event_date", { ascending: false })
      .limit(8);
    let documentQuery = supabase
      .from("customer_documents")
      .select("id, company_id, customer_id, jobsite_id, title, storage_path, file_name, content_type, visible_to_customer, uploaded_by, created_at")
      .eq("company_id", context.companyId)
      .eq("customer_id", order.customer_id)
      .eq("visible_to_customer", true)
      .order("created_at", { ascending: false })
      .limit(8);
    let messageQuery = supabase
      .from("customer_portal_messages")
      .select("id, company_id, customer_id, jobsite_id, portal_token_id, sender_name, sender_email, message, status, answered_at, answered_by, created_at")
      .eq("company_id", context.companyId)
      .eq("customer_id", order.customer_id)
      .order("created_at", { ascending: false })
      .limit(8);
    if (order.jobsite_id) {
      eventQuery = eventQuery.eq("jobsite_id", order.jobsite_id);
      documentQuery = documentQuery.eq("jobsite_id", order.jobsite_id);
      messageQuery = messageQuery.eq("jobsite_id", order.jobsite_id);
    }

    const [portalTokenResult, portalEventResult, customerDocumentResult, portalMessageResult, workOrderResult] = await Promise.all([
      tokenQuery,
      eventQuery,
      documentQuery,
      messageQuery,
      supabase
        .from("work_orders")
        .select(
          "id, company_id, customer_id, jobsite_id, order_id, title, description, scope_of_work, price_note, status, version, content_hash, sent_at, viewed_at, signed_at, rejected_at, signer_name, rejection_reason, created_by, created_at, updated_at"
        )
        .eq("company_id", context.companyId)
        .eq("order_id", order.id)
        .order("created_at", { ascending: false })
    ]);
    portalTokens = (portalTokenResult.data ?? []) as unknown as PortalTokenListItem[];
    portalEvents = (portalEventResult.data ?? []) as unknown as CustomerPortalEvent[];
    customerDocuments = (customerDocumentResult.data ?? []) as unknown as CustomerDocument[];
    portalMessages = (portalMessageResult.data ?? []) as unknown as CustomerPortalMessage[];
    workOrders = (workOrderResult.data ?? []) as unknown as WorkOrderListItem[];
  }

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

      {context.canManage ? <OrderCostEstimatePanel estimate={costEstimate} /> : null}

      {context.canManage ? (
        <CommercialDocumentPanel
          order={order as Order}
          materialCount={pricedRequirements.length}
          salesTotal={totals?.sales ?? 0}
        />
      ) : null}

      {context.canManage ? (
        <CustomerPortalPanel
          order={order as Order}
          portalTokens={portalTokens}
          portalEvents={portalEvents}
          portalMessages={portalMessages}
          customerDocuments={customerDocuments}
          workOrders={workOrders}
          origin={portalOrigin}
          createdPortalToken={createdPortalToken}
          nowIso={new Date().toISOString()}
        />
      ) : null}

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
              title="Keine Maße gespeichert"
              description="Trage die Maße unten nach. Danach berechnet BauPro die Materialliste erneut."
            />
          )}

          {context.canManage ? (
            <MeasurementItemsPanel
              orderId={order.id}
              items={measurementItems}
              wastePercent={dimension?.waste_percent ?? 20}
            />
          ) : null}

          {context.canManage ? (
            <form action={updateOrderDimensionsAction} className="mt-5 rounded-lg border border-line bg-white p-4">
              <input type="hidden" name="order_id" value={order.id} />
              <div className="mb-4">
                <p className="meta-label">{dimension ? "Maße korrigieren" : "Maße nachtragen"}</p>
                <h3 className="text-base font-black text-ink">Maße speichern & Material berechnen</h3>
                <p className="mt-1 text-sm text-slate-600">
                  Länge und Breite berechnen die Fläche automatisch auf dem Server. Bestehende Maße werden überschrieben.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <DimensionField label="Länge m" name="length_m" value={dimension?.length_m} />
                <DimensionField label="Breite m" name="width_m" value={dimension?.width_m} />
                <DimensionField label="Fläche m²" name="area_m2" value={dimension?.area_m2} />
                <DimensionField label="Verschnitt %" name="waste_percent" value={dimension?.waste_percent ?? 20} />
                <DimensionField label="Dachneigung °" name="roof_pitch" value={dimension?.roof_pitch} />
                <DimensionField label="Traufe m" name="eaves_length_m" value={dimension?.eaves_length_m} />
                <DimensionField label="First m" name="ridge_length_m" value={dimension?.ridge_length_m} />
                <DimensionField label="Ortgang m" name="verge_length_m" value={dimension?.verge_length_m} />
                <DimensionField label="Kehle m" name="valley_length_m" value={dimension?.valley_length_m} />
                <DimensionField label="Wandanschluss m" name="wall_connection_length_m" value={dimension?.wall_connection_length_m} />
                <DimensionField label="Gebäudehöhe m" name="building_height_m" value={dimension?.building_height_m} />
                <DimensionField label="Fallrohrlänge m" name="downpipe_length_m" value={dimension?.downpipe_length_m} />
                <DimensionField label="Dachfenster" name="roof_windows_count" value={dimension?.roof_windows_count} inputMode="numeric" />
                <DimensionField label="Durchdringungen" name="penetrations_count" value={dimension?.penetrations_count} inputMode="numeric" />
                <DimensionField label="Dachabläufe" name="roof_drains_count" value={dimension?.roof_drains_count} inputMode="numeric" />
                <DimensionField label="Notüberläufe" name="emergency_overflows_count" value={dimension?.emergency_overflows_count} inputMode="numeric" />
                <label className="sm:col-span-2 lg:col-span-4">
                  <span className="field-label">Notizen zur Berechnung</span>
                  <input className="field-input" name="dimension_notes" defaultValue={dimension?.notes ?? ""} />
                </label>
              </div>
              <div className="mt-4 flex justify-end">
                <button className="btn-primary" type="submit">
                  <Calculator className="h-4 w-4" aria-hidden="true" />
                  Maße speichern
                </button>
              </div>
            </form>
          ) : null}
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

            {context.canManage ? (
              <div className="flex flex-col gap-3 border-t border-line bg-fog p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-600">
                  Materialbedarf kann direkt als Mitbringliste genutzt werden. Reservierung und Lagerabgleich laufen über die Mitbringliste.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  {"jobsite_id" in order && order.jobsite_id ? (
                    <form action={createBringListFromOrderAction}>
                      <input type="hidden" name="order_id" value={order.id} />
                      <button className="btn-secondary w-full sm:w-auto" type="submit">
                        <ListChecks className="h-4 w-4" aria-hidden="true" />
                        Mitbringliste erzeugen
                      </button>
                    </form>
                  ) : null}
                  {costEstimate ? (
                    <a className="btn-secondary" href={`/orders/${order.id}/quote.pdf`}>
                      <FileDown className="h-4 w-4" aria-hidden="true" />
                      Angebots-PDF
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </article>
        )}
      </section>
    </>
  );
}
