import { OrderWizardForm } from "@/components/forms/order-wizard-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { CompanyPricingSettings, Customer, Profile } from "@/types/app";

function defaultCustomerId(params: Record<string, string | string[] | undefined>) {
  const value = params.customer_id;
  return typeof value === "string" ? value : undefined;
}

export default async function NewOrderPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);

  const [customersResult, employeesResult, settingsResult] = await Promise.all([
    supabase.from("customers").select("*").eq("status", "aktiv").order("updated_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("active", true).in("role", ["mitarbeiter", "vorarbeiter"]).order("full_name"),
    supabase.from("company_pricing_settings").select("*").eq("company_id", context.companyId).maybeSingle()
  ]);

  const settings = (settingsResult.data ?? {
    company_id: context.companyId,
    waste_percent: 20,
    default_markup_percent: 35,
    auto_calculate_sales_price: true
  }) as CompanyPricingSettings;

  return (
    <>
      <PageHeader
        title="Neuer Auftrag"
        description="Kunde wählen, Auftrag erfassen und Materialbedarf mit Verschnitt berechnen."
      />
      <MessageBox error={error} success={success} />
      <OrderWizardForm
        customers={(customersResult.data ?? []) as Customer[]}
        employees={(employeesResult.data ?? []) as Profile[]}
        defaultCustomerId={defaultCustomerId(params)}
        defaultWastePercent={Number(settings.waste_percent ?? 20)}
      />
    </>
  );
}
