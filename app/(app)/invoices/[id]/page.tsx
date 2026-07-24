import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Copy, Download, Edit3, ReceiptText } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { deleteInvoiceAction, duplicateInvoiceAction, updateInvoiceStatusAction } from "@/lib/actions/invoice-actions";
import { requireManager } from "@/lib/auth";
import { invoiceStatusLabels, invoiceTypeLabels, loadInvoiceDetail } from "@/lib/data/invoices";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, searchParamMessage } from "@/lib/utils";
import type { InvoiceStatus } from "@/types/app";

function customerName(invoice: { customers?: { company?: string | null; first_name?: string | null; last_name?: string | null; contact_person?: string | null } | null }) {
  const customer = invoice.customers;
  if (!customer) return "Ohne Kundendaten";
  return customer.company || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.contact_person || "Unbenannter Kunde";
}

function nextStatusOptions(status: InvoiceStatus) {
  const options: InvoiceStatus[] = [status];
  if (status === "entwurf") options.push("gesendet", "storniert");
  if (status === "gesendet") options.push("bezahlt", "storniert");
  if (status === "bezahlt") options.push("storniert");
  return Array.from(new Set(options));
}

export default async function InvoiceDetailPage({
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
  const { invoice, items, error: queryError } = await loadInvoiceDetail({ supabase, companyId: context.companyId, id });

  if (!invoice) notFound();

  return (
    <>
      <PageHeader
        title={`${invoiceTypeLabels[invoice.type]} ${invoice.invoice_number}`}
        description={`${customerName(invoice)} · ${formatDate(invoice.issue_date)}`}
      />
      <MessageBox error={error || safeQueryErrorMessage(queryError)} success={success} />

      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/invoices" className="btn-secondary">
          Zurück zur Übersicht
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row">
          <a href={`/api/invoices/${invoice.id}/pdf`} className="btn-primary">
            <Download className="h-4 w-4" aria-hidden="true" />
            Als PDF herunterladen
          </a>
          {invoice.status === "entwurf" ? (
            <Link href={`/invoices/${invoice.id}/edit`} className="btn-secondary">
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              Bearbeiten
            </Link>
          ) : null}
          <form action={duplicateInvoiceAction}>
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <button className="btn-secondary w-full" type="submit">
              <Copy className="h-4 w-4" aria-hidden="true" />
              Duplicate
            </button>
          </form>
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <div className="surface p-4 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="meta-label">Kunde</p>
              <h2 className="section-title">{customerName(invoice)}</h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                {invoice.orders?.order_number ?? "Ohne Auftrag"} · {invoice.orders?.title ?? "Freier Beleg"}
              </p>
            </div>
            <StatusBadge value={invoice.status} label={invoiceStatusLabels[invoice.status]} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="meta-label">Typ</p>
              <p className="mt-1 font-black text-ink">{invoiceTypeLabels[invoice.type]}</p>
            </div>
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="meta-label">Datum</p>
              <p className="mt-1 font-black text-ink">{formatDate(invoice.issue_date)}</p>
            </div>
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="meta-label">Faellig</p>
              <p className="mt-1 font-black text-ink">{formatDate(invoice.due_date)}</p>
            </div>
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="meta-label">Nummer</p>
              <p className="mt-1 font-black text-ink">{invoice.invoice_number}</p>
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-line">
            <div className="hidden grid-cols-[56px_1fr_110px_120px_120px] gap-3 bg-anthracite px-4 py-3 text-xs font-black uppercase tracking-normal text-white md:grid">
              <span>Pos.</span>
              <span>Beschreibung</span>
              <span>Menge</span>
              <span>EP netto</span>
              <span>Gesamt</span>
            </div>
            <div className="divide-y divide-line bg-white">
              {items.map((item) => (
                <div key={item.id} className="grid gap-3 p-4 md:grid-cols-[56px_1fr_110px_120px_120px] md:items-start">
                  <p className="text-sm font-black text-slate-500">{item.position}</p>
                  <p className="font-black text-ink">{item.description}</p>
                  <p className="text-sm font-bold text-ink">
                    {item.quantity} {item.unit}
                  </p>
                  <p className="text-sm font-bold text-ink">{formatMoney(item.unit_price_eur)}</p>
                  <p className="text-sm font-black text-ink">{formatMoney(item.total_eur)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <section className="surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-primary" aria-hidden="true" />
              <h2 className="font-black text-ink">Summen</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-600">Netto</span>
                <span className="font-black text-ink">{formatMoney(invoice.subtotal_eur)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="font-semibold text-slate-600">MwSt. {invoice.tax_rate_percent}%</span>
                <span className="font-black text-ink">{formatMoney(invoice.tax_eur)}</span>
              </div>
              <div className="flex justify-between gap-3 rounded-md bg-mint p-3 text-base">
                <span className="font-black text-primary-dark">Brutto</span>
                <span className="font-black text-primary-dark">{formatMoney(invoice.total_eur)}</span>
              </div>
            </div>
          </section>

          <section className="surface p-4">
            <h2 className="mb-3 font-black text-ink">Status ändern</h2>
            <form action={updateInvoiceStatusAction} className="grid gap-3">
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <label>
                <span className="field-label">Status</span>
                <select className="field-input" name="status" defaultValue={invoice.status}>
                  {nextStatusOptions(invoice.status).map((status) => (
                    <option key={status} value={status}>
                      {invoiceStatusLabels[status]}
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
            <h2 className="mb-3 font-black text-ink">Hinweise</h2>
            <p className="text-sm leading-6 text-slate-600">{invoice.notes || "Keine Zahlungsbedingungen oder Notizen hinterlegt."}</p>
          </section>

          {invoice.status === "entwurf" ? (
            <form action={deleteInvoiceAction} className="surface p-4">
              <input type="hidden" name="invoice_id" value={invoice.id} />
              <button className="btn-secondary w-full border-red-200 text-danger hover:bg-red-50" type="submit">
                <Archive className="h-4 w-4" aria-hidden="true" />
                Entwurf archivieren
              </button>
            </form>
          ) : null}
        </aside>
      </section>
    </>
  );
}
