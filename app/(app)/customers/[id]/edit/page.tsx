import { notFound } from "next/navigation";
import { CustomerForm } from "@/components/forms/customer-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { updateCustomerAction } from "@/lib/actions/customer-actions";
import { requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import { customerDisplayName } from "@/lib/order-labels";
import type { Customer } from "@/types/app";

export default async function EditCustomerPage({
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
  const { data } = await supabase.from("customers").select("*").eq("id", id).single();

  if (!data) {
    notFound();
  }

  const customer = data as Customer;

  return (
    <>
      <PageHeader title="Kunde bearbeiten" description={customerDisplayName(customer)} />
      <MessageBox error={error} success={success} />
      <CustomerForm action={updateCustomerAction} customer={customer} submitLabel="Kunde aktualisieren" />
    </>
  );
}
