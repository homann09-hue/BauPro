import Link from "next/link";
import { notFound } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { updateInvoiceAction } from "@/lib/actions/invoice-actions";
import { requireManager } from "@/lib/auth";
import { customerFormSelect } from "@/lib/data/selects";
import { invoiceTypeLabels, loadInvoiceDetail } from "@/lib/data/invoices";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Customer, Order } from "@/types/app";

export default async function EditInvoicePage({
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

  const [detail, customersResult, ordersResult] = await Promise.all([
    loadInvoiceDetail({ supabase, companyId: context.companyId, id }),
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

  if (!detail.invoice) notFound();

  return (
    <>
      <PageHeader
        title={`${invoiceTypeLabels[detail.invoice.type]} bearbeiten`}
        description={`${detail.invoice.invoice_number} · nur Entwürfe sind änderbar`}
      />
      <MessageBox
        error={error || safeQueryErrorMessage(detail.error) || safeQueryErrorMessage(customersResult.error) || safeQueryErrorMessage(ordersResult.error)}
        success={success}
      />

      {detail.invoice.status !== "entwurf" ? (
        <EmptyState
          icon={LockKeyhole}
          title="Beleg ist gesperrt"
          description="Gesendete, bezahlte oder stornierte Belege werden nicht nachträglich überschrieben. Du kannst den Beleg duplizieren und daraus eine neue Version erstellen."
          actionHref={`/invoices/${detail.invoice.id}`}
          actionLabel="Zur Detailansicht"
        />
      ) : (
        <>
          <div className="mb-4">
            <Link href={`/invoices/${detail.invoice.id}`} className="btn-secondary">
              Zurück zum Beleg
            </Link>
          </div>
          <InvoiceForm
            customers={(customersResult.data ?? []) as Customer[]}
            orders={(ordersResult.data ?? []) as Order[]}
            action={updateInvoiceAction}
            submitLabel="Änderungen speichern"
            invoice={detail.invoice}
            items={detail.items}
          />
        </>
      )}
    </>
  );
}
