import Link from "next/link";
import { Mail, Phone, Plus, Search, UserRound } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth";
import { customerDisplayName, customerStatusLabels, customerTypeLabels } from "@/lib/order-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Customer } from "@/types/app";

function searchValue(params: Record<string, string | string[] | undefined>) {
  const value = params.q;
  return typeof value === "string" ? value.trim() : "";
}

function customerMatchesSearch(customer: Customer, search: string) {
  if (!search) return true;
  const haystack = [
    customer.company,
    customer.first_name,
    customer.last_name,
    customer.contact_person,
    customer.phone,
    customer.email,
    customer.billing_address,
    customer.jobsite_address
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

export default async function CustomersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const search = searchValue(params);

  const { data } = await supabase
    .from("customers")
    .select("*")
    .order("updated_at", { ascending: false });

  const customers = ((data ?? []) as Customer[]).filter((customer) => customerMatchesSearch(customer, search));

  return (
    <>
      <PageHeader
        title="Kunden"
        description="Kundenkartei mit Kontaktdaten, Adressen und direkter Auftragsanlage."
        actionHref="/customers/new"
        actionLabel="Neuer Kunde"
        actionIcon={Plus}
      />
      <MessageBox error={error} success={success} />

      <form className="surface mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_auto]" action="/customers">
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

      {customers.length === 0 ? (
        <EmptyState
          icon={UserRound}
          title="Noch keine Kunden"
          description="Lege den ersten Kunden an und erstelle danach direkt einen Auftrag."
          actionHref="/customers/new"
          actionLabel="Kunde anlegen"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {customers.map((customer) => (
            <article key={customer.id} className="interactive-surface overflow-hidden p-0">
              <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
              <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="meta-label">{customerTypeLabels[customer.customer_type]}</p>
                    <h2 className="mt-1 text-lg font-black text-ink">{customerDisplayName(customer)}</h2>
                    {customer.contact_person ? <p className="text-sm font-semibold text-slate-600">{customer.contact_person}</p> : null}
                  </div>
                  <span className="w-fit rounded-md bg-mint px-2.5 py-1 text-xs font-black text-moss">
                    {customerStatusLabels[customer.status]}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <p className="flex items-center gap-2 rounded-md bg-fog p-3">
                    <Phone className="h-4 w-4 text-moss" aria-hidden="true" />
                    {customer.phone || "Kein Telefon"}
                  </p>
                  <p className="flex items-center gap-2 rounded-md bg-fog p-3">
                    <Mail className="h-4 w-4 text-moss" aria-hidden="true" />
                    {customer.email || "Keine E-Mail"}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/customers/${customer.id}`} className="btn-primary">
                    Öffnen
                  </Link>
                  <Link href={`/orders/new?customer_id=${customer.id}`} className="btn-secondary">
                    Auftrag
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
