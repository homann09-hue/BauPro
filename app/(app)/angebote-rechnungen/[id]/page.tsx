import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ArrowLeft, Download, FileCode2, FileSpreadsheet, FileText, ReceiptText } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { archiveCommercialDocumentAction, updateCommercialDocumentStatusAction } from "@/lib/actions/commercial-document-actions";
import { requireManager } from "@/lib/auth";
import {
  commercialDocumentStatusFilters,
  commercialDocumentStatusLabels,
  commercialDocumentTypeLabels,
  loadCommercialDocumentDetail
} from "@/lib/data/commercial-documents";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";

function snapshotValue(snapshot: Record<string, unknown>, key: string) {
  const value = snapshot[key];
  return typeof value === "string" && value.trim() ? value : "Keine Angabe";
}

export default async function CommercialDocumentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);
  const { document, items, error: queryError } = await loadCommercialDocumentDetail({
    supabase,
    companyId: context.companyId,
    id
  });

  if (!document) notFound();

  return (
    <>
      <PageHeader
        title={`${commercialDocumentTypeLabels[document.document_type]} ${document.document_number}`}
        description={`${document.subject} · ${formatDate(document.issue_date)}`}
      />
      <MessageBox error={error || safeQueryErrorMessage(queryError)} success={success} />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/angebote-rechnungen" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={`/angebote-rechnungen/${document.id}/pdf`} className="btn-primary">
            <Download className="h-4 w-4" aria-hidden="true" />
            PDF herunterladen
          </a>
          <a href={`/angebote-rechnungen/${document.id}/datev`} className="btn-secondary">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            DATEV CSV
          </a>
          {document.document_type === "invoice" ? (
            <a href={`/angebote-rechnungen/${document.id}/xrechnung`} className="btn-secondary">
              <FileCode2 className="h-4 w-4" aria-hidden="true" />
              XRechnung XML
            </a>
          ) : null}
          {document.order_id ? (
            <Link href={`/orders/${document.order_id}`} className="btn-secondary">
              Auftrag öffnen
            </Link>
          ) : null}
        </div>
      </div>

      <section className="mb-5 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="surface p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="meta-label">Beleg</p>
              <h2 className="section-title">{document.subject}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {document.orders?.order_number ?? "Ohne Auftrag"} · erstellt {formatDateTime(document.created_at)}
              </p>
            </div>
            <StatusBadge value={document.status} label={commercialDocumentStatusLabels[document.status]} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="meta-label">Typ</p>
              <p className="mt-1 font-black text-ink">{commercialDocumentTypeLabels[document.document_type]}</p>
            </div>
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="meta-label">Datum</p>
              <p className="mt-1 font-black text-ink">{formatDate(document.issue_date)}</p>
            </div>
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="meta-label">{document.document_type === "invoice" ? "Faellig" : "Gültig bis"}</p>
              <p className="mt-1 font-black text-ink">
                {document.document_type === "invoice" ? formatDate(document.due_date) : formatDate(document.valid_until)}
              </p>
            </div>
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="meta-label">Kunde</p>
              <p className="mt-1 font-black text-ink">{snapshotValue(document.customer_snapshot, "name")}</p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-line">
            <div className="hidden grid-cols-[56px_1fr_120px_120px_120px] gap-3 bg-anthracite px-4 py-3 text-xs font-black uppercase tracking-normal text-white md:grid">
              <span>Pos.</span>
              <span>Leistung / Material</span>
              <span>Menge</span>
              <span>EP netto</span>
              <span>Gesamt</span>
            </div>
            <div className="divide-y divide-line bg-white">
              {items.map((item) => (
                <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[56px_1fr_120px_120px_120px] md:items-start">
                  <p className="text-sm font-black text-slate-500">{item.position}</p>
                  <div>
                    <p className="font-black text-ink">{item.title}</p>
                    {item.description ? <p className="mt-1 text-sm text-slate-600">{item.description}</p> : null}
                  </div>
                  <p className="text-sm font-bold text-ink">
                    {item.quantity} {item.unit}
                  </p>
                  <p className="text-sm font-bold text-ink">{formatMoney(item.unit_price_net)}</p>
                  <p className="text-sm font-black text-ink">{formatMoney(item.line_total_net)}</p>
                </div>
              ))}
              {items.length === 0 ? (
                <p className="p-4 text-sm font-semibold text-slate-600">Noch keine Positionen vorhanden.</p>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="surface p-4">
            <div className="mb-3 flex items-center gap-2">
              {document.document_type === "invoice" ? (
                <ReceiptText className="h-5 w-5 text-primary" aria-hidden="true" />
              ) : (
                <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              )}
              <h2 className="font-black text-ink">Summen</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-600">Netto</span>
                <span className="font-black text-ink">{formatMoney(document.subtotal_net)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-600">MwSt. {document.tax_rate}%</span>
                <span className="font-black text-ink">{formatMoney(document.tax_total)}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-md bg-mint p-3 text-base">
                <span className="font-black text-primary-dark">Brutto</span>
                <span className="font-black text-primary-dark">{formatMoney(document.total_gross)}</span>
              </div>
            </div>
          </section>

          <section className="surface p-4">
            <h2 className="mb-3 font-black text-ink">Status setzen</h2>
            <form action={updateCommercialDocumentStatusAction} className="grid gap-3">
              <input type="hidden" name="document_id" value={document.id} />
              <label>
                <span className="field-label">Status</span>
                <select className="field-input" name="status" defaultValue={document.status}>
                  {commercialDocumentStatusFilters
                    .filter((status) => status.value !== "alle")
                    .map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                </select>
              </label>
              <button className="btn-primary" type="submit">
                Status speichern
              </button>
            </form>
          </section>

          <section className="surface p-4">
            <h2 className="mb-3 font-black text-ink">Kunde & Hinweise</h2>
            <div className="space-y-3 text-sm">
              <p>
                <span className="font-black text-ink">Adresse:</span>{" "}
                <span className="text-slate-600">{snapshotValue(document.customer_snapshot, "billing_address")}</span>
              </p>
              <p>
                <span className="font-black text-ink">Zahlung:</span>{" "}
                <span className="text-slate-600">{document.payment_terms || "Keine Angabe"}</span>
              </p>
              <p>
                <span className="font-black text-ink">Notizen:</span>{" "}
                <span className="text-slate-600">{document.notes || "Keine Angabe"}</span>
              </p>
            </div>
          </section>

          <section className="surface p-4">
            <h2 className="mb-3 font-black text-ink">Buchhaltung</h2>
            <p className="text-sm leading-6 text-slate-600">
              DATEV-CSV und XRechnung-XML sind strukturierte Vorbereitungen für Steuerberater und E-Rechnung. Vor Import oder Versand bitte
              Kontierung, Pflichtfelder und Validierung prüfen.
            </p>
          </section>

          <form action={archiveCommercialDocumentAction} className="surface p-4">
            <input type="hidden" name="document_id" value={document.id} />
            <button className="btn-secondary w-full border-red-200 text-danger hover:bg-red-50" type="submit">
              <Archive className="h-4 w-4" aria-hidden="true" />
              Archivieren
            </button>
          </form>
        </aside>
      </section>
    </>
  );
}
