import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, BriefcaseBusiness, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { updateCustomerStatusAction } from "@/lib/actions/customer-actions";
import { requireAnyPermission } from "@/lib/auth";
import { customerDisplayName, customerStatusLabels, customerTypeLabels, orderStatusLabels, orderTypeLabels } from "@/lib/order-labels";
import { hasAppPermission } from "@/lib/permissions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, searchParamMessage } from "@/lib/utils";
import type { Customer, CustomerPortalMessage, Order } from "@/types/app";

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
  const context = await requireAnyPermission(["customers.view", "customers.edit"], "/customers");
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);
  const canEditCustomer = hasAppPermission(context.profile.role, context.permissions, "customers.edit");
  const canCreateOrder = hasAppPermission(context.profile.role, context.permissions, "orders.create");
  const canViewRequests = hasAppPermission(context.profile.role, context.permissions, "customer_requests.view");
  const customerSelect =
    "id, company_id, customer_type, company, first_name, last_name, contact_person, phone, email, billing_address, jobsite_address, notes, tax_id, payment_terms, status, created_by, created_at, updated_at";
  const orderSelect =
    "id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, priority, jobsite_address, start_date, end_date, description, internal_notes, assigned_employee_ids, has_dimensions, created_by, created_at, updated_at";

  const [{ data: customerData }, { data: orderData }, { data: messageData }] = await Promise.all([
    supabase.from("customers").select(customerSelect).eq("id", id).eq("company_id", context.companyId).single(),
    supabase
      .from("orders")
      .select(orderSelect)
      .eq("customer_id", id)
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
      .limit(30),
    canViewRequests
      ? supabase
          .from("customer_portal_messages")
          .select("id, company_id, customer_id, jobsite_id, portal_token_id, sender_name, sender_email, message, status, answered_at, answered_by, created_at")
          .eq("customer_id", id)
          .eq("company_id", context.companyId)
          .order("created_at", { ascending: false })
          .limit(12)
      : Promise.resolve({ data: [] })
  ]);

  if (!customerData) {
    notFound();
  }

  const customer = customerData as unknown as Customer;
  const orders = (orderData ?? []) as unknown as Order[];
  const messages = (messageData ?? []) as unknown as CustomerPortalMessage[];

  return (
    <>
      <PageHeader
        title={customerDisplayName(customer)}
        description={`${customerTypeLabels[customer.customer_type]} · ${customerStatusLabels[customer.status]}`}
        actionHref={canCreateOrder ? `/orders/new?customer_id=${customer.id}` : undefined}
        actionLabel={canCreateOrder ? "Neuer Auftrag" : undefined}
        actionIcon={canCreateOrder ? Plus : undefined}
      />
      <MessageBox error={error} success={success} />

      {canEditCustomer ? (
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
      ) : null}

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
                  <StatusBadge value={order.status} label={orderStatusLabels[order.status]} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {canViewRequests ? (
      <section className="mt-6">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="section-title">Kundennachrichten</h2>
            <p className="mt-1 text-sm text-slate-500">Fragen aus dem Kundenportal. Daraus kann direkt ein Mangel entstehen.</p>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="surface p-4 text-sm font-semibold text-slate-600">Noch keine Kundenfragen gespeichert.</div>
        ) : (
          <div className="grid gap-3">
            {messages.map((message) => (
              <article key={message.id} className="surface-strong p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black text-ink">{message.sender_name}</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{message.message}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{formatDateTime(message.created_at)}</p>
                  </div>
                  {message.jobsite_id ? (
                    <Link
                      href={`/maengel/neu?jobsite_id=${message.jobsite_id}&source_type=customer_message&source_customer_message_id=${message.id}`}
                      className="btn-secondary shrink-0"
                    >
                      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                      Mangel daraus
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      ) : null}
    </>
  );
}
