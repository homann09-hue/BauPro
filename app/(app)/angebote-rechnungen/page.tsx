import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, ReceiptText, Search, Send, WalletCards } from "lucide-react";
import { StatCard } from "@/components/construction-ui";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireManager } from "@/lib/auth";
import {
  commercialDocumentHref,
  commercialDocumentStatusFilters,
  commercialDocumentStatusLabels,
  commercialDocumentTypeLabels,
  loadCommercialDocumentList
} from "@/lib/data/commercial-documents";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, formatDate, formatMoney, searchParamMessage } from "@/lib/utils";

export default async function CommercialDocumentsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const { search, selectedType, selectedStatus, page, from, to, documents, totalCount, totalPages, error: queryError, counts } =
    await loadCommercialDocumentList({
      supabase,
      companyId: context.companyId,
      params
    });

  return (
    <>
      <PageHeader
        title="Angebote & Rechnungen"
        description="Kaufmännischer Kern: aus Aufträgen Angebote und Rechnungen vorbereiten, Status verfolgen und als PDF exportieren."
        actionHref="/orders"
        actionLabel="Aus Auftrag erstellen"
        actionIcon={ReceiptText}
      />
      <MessageBox error={error || safeQueryErrorMessage(queryError)} success={success} />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={FileText} label="Angebote" value={counts.quotes} tone="info" />
        <StatCard icon={ReceiptText} label="Rechnungen" value={counts.invoices} tone="neutral" />
        <StatCard icon={Send} label="Offen/Entwurf" value={counts.open} tone="warning" />
        <StatCard icon={CheckCircle2} label="Bezahlt" value={counts.paid} tone="green" />
      </section>

      <section className="surface mb-5 p-3 sm:p-4">
        <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/angebote-rechnungen">
          {selectedType !== "alle" ? <input type="hidden" name="type" value={selectedType} /> : null}
          {selectedStatus !== "alle" ? <input type="hidden" name="status" value={selectedStatus} /> : null}
          <label className="sr-only" htmlFor="commercial-document-search">
            Angebote und Rechnungen suchen
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="commercial-document-search"
              className="field-input pl-9"
              name="q"
              defaultValue={search}
              placeholder="Suchen: Nummer, Betreff..."
            />
          </div>
          <button className="btn-primary" type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Suchen
          </button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {(["alle", "quote", "invoice"] as const).map((type) => (
            <Link
              key={type}
              href={commercialDocumentHref({ q: search, type, status: selectedStatus })}
              className={cn(
                "shrink-0 rounded-md border px-3 py-2 text-sm font-black",
                selectedType === type ? "border-primary bg-primary text-white" : "border-line bg-white text-slate-700 hover:border-primary/40"
              )}
            >
              {type === "alle" ? "Alle Belege" : commercialDocumentTypeLabels[type]}
            </Link>
          ))}
          {commercialDocumentStatusFilters.map((filter) => (
            <Link
              key={filter.value}
              href={commercialDocumentHref({ q: search, type: selectedType, status: filter.value })}
              className={cn(
                "shrink-0 rounded-md border px-3 py-2 text-sm font-black",
                selectedStatus === filter.value
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-white text-slate-700 hover:border-primary/40"
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </section>

      {documents.length === 0 ? (
        <EmptyState
          icon={WalletCards}
          title="Noch keine Angebote oder Rechnungen"
          description="Oeffne einen Auftrag und erstelle daraus mit einem Klick ein Angebot oder eine Rechnung."
          actionHref="/orders"
          actionLabel="Auftrag öffnen"
        />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Kaufmaennische Zentrale</p>
              <h2 className="section-title">Aktuelle Belege</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {totalCount} Einträge · Seite {page} von {totalPages}
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {documents.map((document) => (
              <Link key={document.id} href={`/angebote-rechnungen/${document.id}`} className="interactive-surface group p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="meta-label">
                      {commercialDocumentTypeLabels[document.document_type]} · {document.document_number}
                    </p>
                    <h2 className="mt-1 text-lg font-black text-ink">{document.subject}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">
                      {document.orders?.order_number ?? "Ohne Auftrag"} · {formatDate(document.issue_date)}
                    </p>
                  </div>
                  <StatusBadge value={document.status} label={commercialDocumentStatusLabels[document.status]} />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-md border border-line bg-fog p-3">
                    <p className="meta-label">Netto</p>
                    <p className="mt-1 font-black text-ink">{formatMoney(document.subtotal_net)}</p>
                  </div>
                  <div className="rounded-md border border-line bg-fog p-3">
                    <p className="meta-label">MwSt.</p>
                    <p className="mt-1 font-black text-ink">{formatMoney(document.tax_total)}</p>
                  </div>
                  <div className="rounded-md border border-line bg-mint p-3">
                    <p className="meta-label">Brutto</p>
                    <p className="mt-1 font-black text-primary-dark">{formatMoney(document.total_gross)}</p>
                  </div>
                </div>
                <p className="mt-4 inline-flex items-center gap-1 text-sm font-black text-primary opacity-0 transition group-hover:opacity-100">
                  Öffnen
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </p>
              </Link>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={commercialDocumentHref({ q: search, type: selectedType, status: selectedStatus, page: Math.max(1, page - 1) })}
                className={cn("btn-secondary", page <= 1 && "pointer-events-none opacity-50")}
              >
                Zurück
              </Link>
              <span className="text-center text-sm font-bold text-slate-500">
                {from + 1}-{Math.min(to + 1, totalCount)} von {totalCount}
              </span>
              <Link
                href={commercialDocumentHref({ q: search, type: selectedType, status: selectedStatus, page: Math.min(totalPages, page + 1) })}
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
