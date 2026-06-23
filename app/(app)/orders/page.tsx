import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Plus,
  Search,
  TriangleAlert
} from "lucide-react";
import { StatCard } from "@/components/construction-ui";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireAppContext } from "@/lib/auth";
import { loadOrderList, orderHref, orderStatusFilters } from "@/lib/data/orders";
import { customerDisplayName, orderPriorityLabels, orderStatusLabels, orderTypeLabels } from "@/lib/order-labels";
import { hasAppPermission } from "@/lib/permissions";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, formatDate, searchParamMessage } from "@/lib/utils";
import type { Order, PublicOrder } from "@/types/app";

function customerName(order: Order | PublicOrder) {
  if ("customers" in order && order.customers) return customerDisplayName(order.customers);
  if ("customer_name" in order && order.customer_name) return order.customer_name;
  return "Kunde";
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
  const canCreateOrder = hasAppPermission(context.profile.role, context.permissions, "orders.create");
  const { search, selectedStatus, page, from, to, orders, totalCount, totalPages, error: queryError, counts } = await loadOrderList({
    supabase,
    canManage: context.canManage,
    params
  });

  return (
    <>
      <PageHeader
        title="Aufträge"
        description="Aufträge, Kunden, Termine und Materialbedarf an einem Ort."
        actionHref={canCreateOrder ? "/orders/new" : undefined}
        actionLabel={canCreateOrder ? "Neuer Auftrag" : undefined}
        actionIcon={canCreateOrder ? Plus : undefined}
      />
      <MessageBox error={error || safeQueryErrorMessage(queryError)} success={success} />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TriangleAlert} label="Anfrage/Angebot" value={counts.open} tone="warning" />
        <StatCard icon={CalendarDays} label="Geplant" value={counts.planned} tone="info" />
        <StatCard icon={BriefcaseBusiness} label="In Arbeit" value={counts.active} tone="green" />
        <StatCard icon={CheckCircle2} label="Fertig/Abgerechnet" value={counts.finished} tone="neutral" />
      </section>

      <section className="filter-bar mb-5">
        <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/orders">
          {selectedStatus !== "alle" ? <input type="hidden" name="status" value={selectedStatus} /> : null}
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
              placeholder="Suchen: Auftrag, Adresse, Beschreibung..."
            />
          </div>
          <button className="btn-primary" type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Suchen
          </button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {orderStatusFilters.map((filter) => (
            <Link
              key={filter.value}
              href={orderHref({ q: search, status: filter.value })}
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
      </section>

      {orders.length === 0 ? (
        <EmptyState
          icon={BriefcaseBusiness}
          title="Noch keine Aufträge"
          description="Lege einen Auftrag an, erfasse Maße und lasse Material automatisch berechnen."
          actionHref={context.canManage ? "/orders/new" : undefined}
          actionLabel={context.canManage ? "Auftrag anlegen" : undefined}
        />
      ) : (
        <>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Auftragszentrale</p>
              <h2 className="section-title">Aktuelle Aufträge</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">
              {totalCount} Einträge · Seite {page} von {totalPages}
            </p>
          </div>
          <div className="mobile-card-list lg:grid-cols-2">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="interactive-surface group overflow-hidden p-0">
                <div className={cn("h-1.5", order.priority === "hoch" ? "bg-warning" : "bg-primary")} />
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="meta-label">{order.order_number}</p>
                      <h2 className="mt-1 text-lg font-black text-ink">{order.title}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{customerName(order)}</p>
                    </div>
                    <StatusBadge value={order.status} label={orderStatusLabels[order.status]} />
                  </div>

                  <p className="mt-4 flex items-start gap-2 rounded-md bg-fog p-3 text-sm text-slate-600">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                    {order.jobsite_address}
                  </p>

                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-md bg-white p-3 ring-1 ring-line">
                      <p className="meta-label">Art</p>
                      <p className="mt-1 font-black text-ink">{orderTypeLabels[order.order_type]}</p>
                    </div>
                    <div className={cn("rounded-md p-3 ring-1", order.priority === "hoch" ? "bg-amber-50 ring-warning/30" : "bg-white ring-line")}>
                      <p className="meta-label">Priorität</p>
                      <p className="mt-1 font-black text-ink">{orderPriorityLabels[order.priority]}</p>
                    </div>
                    <div className="rounded-md bg-white p-3 ring-1 ring-line">
                      <p className="meta-label">Start</p>
                      <p className="mt-1 flex items-center gap-2 font-black text-ink">
                        <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                        {formatDate(order.start_date)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-sm font-black text-primary">
                    <span>{order.has_dimensions ? "Maße vorhanden" : "Maße offen"}</span>
                    <span className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      Öffnen
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={orderHref({ q: search, status: selectedStatus, page: Math.max(1, page - 1) })}
                className={cn("btn-secondary", page <= 1 && "pointer-events-none opacity-50")}
              >
                Zurück
              </Link>
              <span className="text-center text-sm font-bold text-slate-500">
                {from + 1}-{Math.min(to + 1, totalCount)} von {totalCount}
              </span>
              <Link
                href={orderHref({ q: search, status: selectedStatus, page: Math.min(totalPages, page + 1) })}
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
