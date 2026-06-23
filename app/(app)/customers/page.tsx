import Link from "next/link";
import { ArrowRight, Building2, Mail, MapPin, Phone, Plus, Search, UserRound, Users } from "lucide-react";
import { StatCard } from "@/components/construction-ui";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAnyPermission } from "@/lib/auth";
import { hasAppPermission } from "@/lib/permissions";
import { customerHref, customerStatusFilters, customerTypeFilters, loadCustomerList } from "@/lib/data/customers";
import { customerDisplayName, customerStatusLabels, customerTypeLabels } from "@/lib/order-labels";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, searchParamMessage } from "@/lib/utils";

export default async function CustomersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAnyPermission(["customers.view", "customers.edit"], "/dashboard");
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const { search, selectedStatus, selectedType, page, from, to, customers, totalCount, totalPages, error: queryError, counts } = await loadCustomerList({
    supabase,
    companyId: context.companyId,
    params
  });

  return (
    <>
      <PageHeader
        title="Kunden"
        description="Kundenkartei mit Kontaktdaten, Adressen und direkter Auftragsanlage."
        actionHref={hasAppPermission(context.profile.role, context.permissions, "customers.edit") ? "/customers/new" : undefined}
        actionLabel={hasAppPermission(context.profile.role, context.permissions, "customers.edit") ? "Neuer Kunde" : undefined}
        actionIcon={hasAppPermission(context.profile.role, context.permissions, "customers.edit") ? Plus : undefined}
      />
      <MessageBox error={error || safeQueryErrorMessage(queryError)} success={success} />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon={Users} label="Aktive Kunden" value={counts.active} tone="green" />
        <StatCard icon={Building2} label="Gewerbekunden" value={counts.commercial} tone="info" />
        <StatCard icon={UserRound} label="Privatkunden" value={counts.private} tone="neutral" />
      </section>

      <section className="filter-bar mb-5">
        <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/customers">
          {selectedStatus !== "alle" ? <input type="hidden" name="status" value={selectedStatus} /> : null}
          {selectedType !== "alle" ? <input type="hidden" name="type" value={selectedType} /> : null}
          <label className="sr-only" htmlFor="customer-search">
            Kunden suchen
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="customer-search"
              className="field-input pl-9"
              name="q"
              defaultValue={search}
              placeholder="Suchen: Name, Firma, Telefon, Adresse..."
            />
          </div>
          <button className="btn-primary" type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Suchen
          </button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {customerStatusFilters.map((filter) => (
            <Link
              key={filter.value}
              href={customerHref({ q: search, status: filter.value, type: selectedType })}
              className={cn(
                "filter-chip",
                selectedStatus === filter.value
                  ? "filter-chip-active"
                  : ""
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {customerTypeFilters.map((filter) => (
            <Link
              key={filter.value}
              href={customerHref({ q: search, status: selectedStatus, type: filter.value })}
              className={cn(
                "filter-chip",
                selectedType === filter.value
                  ? "border-anthracite bg-anthracite text-white hover:bg-anthracite"
                  : ""
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </section>

      {customers.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Noch keine Kunden"
          description="Lege den ersten Kunden an und erstelle danach direkt einen Auftrag."
          actionHref="/customers/new"
          actionLabel="Kunde anlegen"
        />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Kundenkartei</p>
              <h2 className="section-title">Kontakte und Auftragseinstieg</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {totalCount} Einträge · Seite {page} von {totalPages}
            </p>
          </div>
          <div className="mobile-card-list lg:grid-cols-2">
            {customers.map((customer) => (
              <article key={customer.id} className="interactive-surface group overflow-hidden p-0">
                <div className="h-1.5 bg-primary" />
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="meta-label">{customerTypeLabels[customer.customer_type]}</p>
                      <h2 className="mt-1 text-lg font-black text-ink">{customerDisplayName(customer)}</h2>
                      {customer.contact_person ? <p className="text-sm font-semibold text-slate-600">{customer.contact_person}</p> : null}
                    </div>
                    <span
                      className={cn(
                        "w-fit rounded-md px-2.5 py-1 text-xs font-black ring-1",
                        customer.status === "aktiv" ? "bg-mint text-primary ring-primary/20" : "bg-slate-100 text-slate-600 ring-slate-200"
                      )}
                    >
                      {customerStatusLabels[customer.status]}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p className="flex min-w-0 items-center gap-2 rounded-md bg-fog p-3">
                      <Phone className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate">{customer.phone || "Kein Telefon"}</span>
                    </p>
                    <p className="flex min-w-0 items-center gap-2 rounded-md bg-fog p-3">
                      <Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                      <span className="truncate">{customer.email || "Keine E-Mail"}</span>
                    </p>
                  </div>

                  <p className="mt-3 flex items-start gap-2 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {customer.jobsite_address || customer.billing_address || "Keine Adresse hinterlegt"}
                  </p>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Link href={`/customers/${customer.id}`} className="btn-primary w-full sm:w-auto">
                      Öffnen
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <Link href={`/orders/new?customer_id=${customer.id}`} className="btn-secondary w-full sm:w-auto">
                      Auftrag
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={customerHref({ q: search, status: selectedStatus, type: selectedType, page: Math.max(1, page - 1) })}
                className={cn("btn-secondary", page <= 1 && "pointer-events-none opacity-50")}
              >
                Zurück
              </Link>
              <span className="text-center text-sm font-bold text-slate-500">
                {from + 1}-{Math.min(to + 1, totalCount)} von {totalCount}
              </span>
              <Link
                href={customerHref({ q: search, status: selectedStatus, type: selectedType, page: Math.min(totalPages, page + 1) })}
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
