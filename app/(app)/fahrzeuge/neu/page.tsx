import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { VehicleForm } from "@/components/forms/vehicle-form";
import { createVehicleAction } from "@/lib/actions/vehicle-actions";
import { requireManager } from "@/lib/auth";
import { profileOptionSelect } from "@/lib/data/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Profile } from "@/types/app";

export default async function NewVehiclePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const { data } = await supabase
    .from("profiles")
    .select(profileOptionSelect)
    .eq("company_id", context.companyId)
    .eq("active", true)
    .in("role", ["vorarbeiter", "mitarbeiter"])
    .order("full_name", { ascending: true });
  const employees = (data ?? []) as Profile[];

  return (
    <>
      <PageHeader title="Fahrzeug anlegen" description="Stammdaten und TÜV-Termin erfassen." />
      <MessageBox error={error} success={success} />
      <VehicleForm action={createVehicleAction} employees={employees} submitLabel="Fahrzeug speichern" />
    </>
  );
}
