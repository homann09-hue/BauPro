import Link from "next/link";
import { BriefcaseBusiness, CalendarDays, MapPin, Plus, Search } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireAppContext } from "@/lib/auth";
import { customerDisplayName, orderPriorityLabels, orderStatusLabels, orderTypeLabels } from "@/lib/order-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Order, PublicOrder } from "@/types/app";

function searchValue(params: Record<string, string | string[] | undefined>) {
  const value = params.q;
  return typeof value === "string" ? value.trim() : "";
}

function customerName(order: Order | PublicOrder) {
  if ("customers" in order && order.customers) return customerDisplayName(order.customers);
  if ("customer_name" in order && order.customer_name) return order.customer_name;
  return "Kunde";
}

function orderMatchesSearch(order: Order | PublicOrder, search: string) {
  if (!search) return true;
  const haystack = [
    order.order_number,
    order.title,
    customerName(order),
    order.jobsite_address,
    order.description,
    orderStatusLabels[order.status],
    orderTypeLabels[order.order_type]
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(search.toLowerCase());
}

export default async function OrdersPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const search = searchValue(params);

  const { data } = context.canManage
    ? await supabase
        .from("orders")
        .select("*, customers(id, company, first_name, last_name, contact_person)")
        .order("created_at", { ascending: false })
    : await supabase.from("orders_public").select("*").order("created_at", { ascending: false });

  const orders = ((data ?? []) as Array<Order | PublicOrder>).filter((order) => orderMatchesSearch(order, search));

  return (
    <>
      <PageHeader
        title="Aufträge"
        description="Aufträge, Kunden, Termine und Materialbedarf an einem Ort."
        actionHref={context.canManage ? "/orders/new" : undefined}
        actionLabel={context.canManage ? "Neuer Auftrag" : undefined}
        actionIcon={Plus}
      />
      <MessageBox error={error} success={success} />

      <form className="surface mb-4 grid gap-3 p-3 sm:grid-cols-[1fr_auto]" action="/orders">
        <label className="sr-only" htmlFor="order-search">
          Aufträge suchen
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="order-search"
            className="field-input pl-9"
            name="q"
            defaultValue={search}
            placeholder="Suchen: Auftrag, Kunde, Adresse..."
          />
        </div>
        <button className="btn-primary" type="submit">
          <Search className="h-4 w-4" aria-hidden="true" />
          Suchen
        </button>
      </form>

      {orders.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="Noch keine Aufträge"
          description="Lege einen Auftrag an, erfasse Maße und lasse Material automatisch berechnen."
          actionHref={context.canManage ? "/orders/new" : undefined}
          actionLabel={context.canManage ? "Auftrag anlegen" : undefined}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} className="interactive-surface overflow-hidden p-0">
              <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
              <div className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="meta-label">{order.order_number}</p>
                    <h2 className="mt-1 text-lg font-black text-ink">{order.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-700">{customerName(order)}</p>
                  </div>
                  <StatusBadge value={order.status} />
                </div>

                <p className="mt-4 flex items-start gap-2 rounded-md bg-fog p-3 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden="true" />
                  {order.jobsite_address}
                </p>

                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                  <div className="rounded-md bg-white p-3 ring-1 ring-line">
                    <p className="meta-label">Art</p>
                    <p className="mt-1 font-black text-ink">{orderTypeLabels[order.order_type]}</p>
                  </div>
                  <div className="rounded-md bg-white p-3 ring-1 ring-line">
                    <p className="meta-label">Priorität</p>
                    <p className="mt-1 font-black text-ink">{orderPriorityLabels[order.priority]}</p>
                  </div>
                  <div className="rounded-md bg-white p-3 ring-1 ring-line">
                    <p className="meta-label">Start</p>
                    <p className="mt-1 flex items-center gap-2 font-black text-ink">
                      <CalendarDays className="h-4 w-4 text-moss" aria-hidden="true" />
                      {formatDate(order.start_date)}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
