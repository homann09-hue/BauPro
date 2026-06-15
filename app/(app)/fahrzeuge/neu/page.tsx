import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "@/components/forms/vehicle-form";
import { createVehicleAction } from "@/lib/actions/vehicle-actions";
import { requireManager } from "@/lib/auth";
import { searchParamMessage } from "@/lib/utils";

export default async function NewVehiclePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireManager();
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <>
      <PageHeader title="Fahrzeug anlegen" description="Stammdaten und TÜV-Termin erfassen." />
      <MessageBox error={error} success={success} />
      <VehicleForm action={createVehicleAction} submitLabel="Fahrzeug speichern" />
    </>
  );
}
