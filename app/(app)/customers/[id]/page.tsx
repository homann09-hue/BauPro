import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { updateCustomerStatusAction } from "@/lib/actions/customer-actions";
import { requireManager } from "@/lib/auth";
import { customerDisplayName, customerStatusLabels, customerTypeLabels, orderStatusLabels, orderTypeLabels } from "@/lib/order-labels";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Customer, Order } from "@/types/app";

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md bg-fog p-3">
      <p className="meta-label">{label}</p>
      <p className="mt-1 whitespace-pre-line text-sm font-semibold text-ink">{value || "Keine Angabe"}</p>
    </div>
  );
}

export default async function CustomerDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);

  const [{ data: customerData }, { data: orderData }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase.from("orders").select("*").eq("customer_id", id).order("created_at", { ascending: false })
  ]);

  if (!customerData) {
    notFound();
  }

  const customer = customerData as Customer;
  const orders = (orderData ?? []) as Order[];

  return (
    <>
      <PageHeader
        title={customerDisplayName(customer)}
        description={`${customerTypeLabels[customer.customer_type]} · ${customerStatusLabels[customer.status]}`}
        actionHref={`/orders/new?customer_id=${customer.id}`}
        actionLabel="Neuer Auftrag"
        actionIcon={Plus}
      />
      <MessageBox error={error} success={success} />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href={`/customers/${customer.id}/edit`} className="btn-secondary">
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Kunde bearbeiten
        </Link>
        <form action={updateCustomerStatusAction}>
          <input type="hidden" name="id" value={customer.id} />
          <input type="hidden" name="status" value={customer.status === "aktiv" ? "inaktiv" : "aktiv"} />
          <button className="btn-secondary" type="submit">
            {customer.status === "aktiv" ? "Inaktiv setzen" : "Aktiv setzen"}
          </button>
        </form>
      </div>

      <section className="surface mb-6 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Firma" value={customer.company} />
          <Info label="Name" value={[customer.first_name, customer.last_name].filter(Boolean).join(" ")} />
          <Info label="Ansprechpartner" value={customer.contact_person} />
          <Info label="Telefon" value={customer.phone} />
          <Info label="E-Mail" value={customer.email} />
          <Info label="Zahlungsziel" value={customer.payment_terms} />
          <Info label="Rechnungsadresse" value={customer.billing_address} />
          <Info label="Baustellenadresse" value={customer.jobsite_address} />
          <Info label="Steuernummer/USt-ID" value={customer.tax_id} />
          {customer.notes ? <Info label="Notizen" value={customer.notes} /> : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {customer.phone ? (
            <a className="btn-secondary" href={`tel:${customer.phone}`}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Anrufen
            </a>
          ) : null}
          {customer.email ? (
            <a className="btn-secondary" href={`mailto:${customer.email}`}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              E-Mail
            </a>
          ) : null}
          {customer.jobsite_address || customer.billing_address ? (
            <a
              className="btn-secondary"
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                customer.jobsite_address ?? customer.billing_address ?? ""
              )}`}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              Karte
            </a>
          ) : null}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Aufträge</h2>
            <p className="mt-1 text-sm text-slate-500">Alle Aufträge zu diesem Kunden.</p>
          </div>
          <Link href={`/orders/new?customer_id=${customer.id}`} className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Auftrag
          </Link>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={BriefcaseBusiness}
            title="Noch keine Aufträge"
            description="Erstelle den ersten Auftrag direkt aus der Kundenkartei."
            actionHref={`/orders/new?customer_id=${customer.id}`}
            actionLabel="Auftrag erstellen"
          />
        ) : (
          <div className="grid gap-3">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="interactive-surface p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="meta-label">{order.order_number}</p>
                    <h3 className="mt-1 font-black text-ink">{order.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {orderTypeLabels[order.order_type]} · Start: {formatDate(order.start_date)}
                    </p>
                  </div>
                  <StatusBadge value={orderStatusLabels[order.status]} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
