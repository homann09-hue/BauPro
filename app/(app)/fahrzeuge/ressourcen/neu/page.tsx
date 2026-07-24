import { ResourceForm } from "@/components/forms/resource-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { createPlanningResourceAction } from "@/lib/actions/planning-actions";
import { requirePermission } from "@/lib/auth";
import { profileOptionSelect, vehicleOptionSelect } from "@/lib/data/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Profile, Vehicle } from "@/types/app";

export default async function NewResourcePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePermission("vehicles.manage", "/fahrzeuge");
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const [employeesResult, vehiclesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(profileOptionSelect)
      .eq("company_id", context.companyId)
      .eq("active", true)
      .in("role", ["vorarbeiter", "mitarbeiter"])
      .order("full_name", { ascending: true }),
    supabase
      .from("vehicles")
      .select(vehicleOptionSelect)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .order("name", { ascending: true })
  ]);

  return (
    <>
      <PageHeader title="Gerät oder Ressource anlegen" description="Maschinen, Werkzeuge, Anhänger und Gerüste verwalten." />
      <MessageBox error={error} success={success} />
      <ResourceForm
        action={createPlanningResourceAction}
        employees={(employeesResult.data ?? []) as Profile[]}
        vehicles={(vehiclesResult.data ?? []) as Vehicle[]}
        submitLabel="Ressource speichern"
        returnTo="/fahrzeuge"
      />
    </>
  );
}
