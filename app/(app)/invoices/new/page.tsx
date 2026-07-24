import { Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { createInvoiceAction } from "@/lib/actions/invoice-actions";
import { requireManager } from "@/lib/auth";
import { customerFormSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Customer, Order } from "@/types/app";

export default async function NewInvoicePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const [customersResult, ordersResult] = await Promise.all([
    supabase
      .from("customers")
      .select(customerFormSelect)
      .eq("company_id", context.companyId)
      .eq("status", "aktiv")
      .order("updated_at", { ascending: false }),
    supabase
      .from("orders")
      .select("id, customer_id, order_number, title, status, jobsite_address")
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
  ]);

  const customers = (customersResult.data ?? []) as Customer[];
  const orders = (ordersResult.data ?? []) as Order[];

  return (
    <>
      <PageHeader
        title="Neuer Beleg"
        description="Angebot, Rechnung oder Gutschrift mit Positionen erstellen."
      />
      <MessageBox error={error || safeQueryErrorMessage(customersResult.error) || safeQueryErrorMessage(ordersResult.error)} success={success} />

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Zuerst Kunde anlegen"
          description="Für Angebote und Rechnungen brauchst du mindestens einen aktiven Kunden."
          actionHref="/customers/new"
          actionLabel="Kunde anlegen"
        />
      ) : (
        <InvoiceForm customers={customers} orders={orders} action={createInvoiceAction} submitLabel="Beleg speichern" />
      )}
    </>
  );
}
