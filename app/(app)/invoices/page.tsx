import Link from "next/link";
import { CheckCircle2, FilePlus2, ReceiptText, Search, Send, WalletCards } from "lucide-react";
import { StatCard } from "@/components/construction-ui";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireManager } from "@/lib/auth";
import { invoiceHref, invoiceStatusFilters, invoiceStatusLabels, invoiceTypeFilters, invoiceTypeLabels, loadInvoiceList } from "@/lib/data/invoices";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, formatDate, formatMoney, searchParamMessage } from "@/lib/utils";

function customerName(invoice: { customers?: { company?: string | null; first_name?: string | null; last_name?: string | null; contact_person?: string | null } | null }) {
  const customer = invoice.customers;
  if (!customer) return "Ohne Kundendaten";
  return customer.company || [customer.first_name, customer.last_name].filter(Boolean).join(" ") || customer.contact_person || "Unbenannter Kunde";
}

export default async function InvoicesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const { search, selectedType, selectedStatus, page, from, to, invoices, totalCount, totalPages, error: queryError, counts } = await loadInvoiceList({
    supabase,
    companyId: context.companyId,
    params
  });

  return (
    <>
      <PageHeader
        title="Angebote & Rechnungen"
        description="Angebote, Rechnungen und Gutschriften erstellen, verfolgen und als Kunden-PDF exportieren."
        actionHref="/invoices/new"
        actionLabel="Neuer Beleg"
        actionIcon={FilePlus2}
      />
      <MessageBox error={error || safeQueryErrorMessage(queryError)} success={success} />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon={Send} label="Offen" value={counts.open} tone="warning" />
        <StatCard icon={CheckCircle2} label="Bezahlt" value={counts.paid} tone="green" />
        <StatCard icon={WalletCards} label="Gesamt brutto" value={formatMoney(counts.totalGross)} tone="info" />
      </section>

      <section className="filter-bar mb-5">
        <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/invoices">
          {selectedType !== "alle" ? <input type="hidden" name="type" value={selectedType} /> : null}
          {selectedStatus !== "alle" ? <input type="hidden" name="status" value={selectedStatus} /> : null}
          <label className="sr-only" htmlFor="invoice-search">
            Belege suchen
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input id="invoice-search" className="field-input pl-9" name="q" defaultValue={search} placeholder="Suchen: Nummer, Notiz..." />
          </div>
          <button className="btn-primary" type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Suchen
          </button>
        </form>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {invoiceTypeFilters.map((filter) => (
            <Link
              key={filter.value}
              href={invoiceHref({ q: search, type: filter.value, status: selectedStatus })}
              className={cn("filter-chip", selectedType === filter.value ? "filter-chip-active" : "")}
            >
              {filter.label}
            </Link>
          ))}
          {invoiceStatusFilters.map((filter) => (
            <Link
              key={filter.value}
              href={invoiceHref({ q: search, type: selectedType, status: filter.value })}
              className={cn("filter-chip", selectedStatus === filter.value ? "filter-chip-active" : "")}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </section>

      {invoices.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Noch keine Belege"
          description="Erstelle dein erstes Angebot oder deine erste Rechnung direkt aus dieser Zentrale."
          actionHref="/invoices/new"
          actionLabel="Beleg erstellen"
        />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Kundenbelege</p>
              <h2 className="section-title">Aktuelle Liste</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {totalCount} Einträge · Seite {page} von {totalPages}
            </p>
          </div>

          <div className="mobile-card-list lg:grid-cols-2">
            {invoices.map((invoice) => (
              <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="interactive-surface group p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="meta-label">
                      {invoiceTypeLabels[invoice.type]} · {invoice.invoice_number}
                    </p>
                    <h2 className="mt-1 text-lg font-black text-ink">{customerName(invoice)}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {invoice.orders?.order_number ?? "Ohne Auftrag"} · {formatDate(invoice.issue_date)}
                    </p>
                  </div>
                  <StatusBadge value={invoice.status} label={invoiceStatusLabels[invoice.status]} />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-line bg-fog p-3">
                    <p className="meta-label">Netto</p>
                    <p className="mt-1 font-black text-ink">{formatMoney(invoice.subtotal_eur)}</p>
                  </div>
                  <div className="rounded-md border border-line bg-fog p-3">
                    <p className="meta-label">MwSt.</p>
                    <p className="mt-1 font-black text-ink">{formatMoney(invoice.tax_eur)}</p>
                  </div>
                  <div className="rounded-md border border-line bg-mint p-3">
                    <p className="meta-label">Brutto</p>
                    <p className="mt-1 font-black text-primary-dark">{formatMoney(invoice.total_eur)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <nav className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={invoiceHref({ q: search, type: selectedType, status: selectedStatus, page: Math.max(1, page - 1) })}
                className={cn("btn-secondary", page <= 1 && "pointer-events-none opacity-50")}
              >
                Zurück
              </Link>
              <span className="text-center text-sm font-bold text-slate-500">
                {from + 1}-{Math.min(to + 1, totalCount)} von {totalCount}
              </span>
              <Link
                href={invoiceHref({ q: search, type: selectedType, status: selectedStatus, page: Math.min(totalPages, page + 1) })}
                className={cn("btn-secondary", page >= totalPages && "pointer-events-none opacity-50")}
              >
                Weiter
              </Link>
            </nav>
          ) : null}
        </>
      )}
    </>
  );
}
