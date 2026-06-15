import { CustomerForm } from "@/components/forms/customer-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { createCustomerAction } from "@/lib/actions/customer-actions";
import { requireManager } from "@/lib/auth";
import { searchParamMessage } from "@/lib/utils";

export default async function NewCustomerPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <>
      <PageHeader title="Neuer Kunde" description="Kontaktdaten und Standardadressen erfassen." />
      <MessageBox error={error} success={success} />
      <CustomerForm action={createCustomerAction} submitLabel="Kunde speichern" />
    </>
  );
}
