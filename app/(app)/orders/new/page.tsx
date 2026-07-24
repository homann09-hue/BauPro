import { OrderWizardForm } from "@/components/forms/order-wizard-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requirePermission } from "@/lib/auth";
import {
  calculationSettingsSelect,
  companyPricingSettingsSelect,
  customerFormSelect,
  inventoryItemCalculationSelect,
  profileOptionSelect
} from "@/lib/data/selects";
import { hasAppPermission } from "@/lib/permissions";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { RoofingMaterialPriceRow } from "@/lib/roofing-material-estimate";
import { searchParamMessage } from "@/lib/utils";
import type { CompanyPricingSettings, Customer, Profile } from "@/types/app";

const customerOptionLimit = 120;
const employeeOptionLimit = 120;
const materialPriceOptionLimit = 250;

function defaultCustomerId(params: Record<string, string | string[] | undefined>) {
  const value = params.customer_id;
  return typeof value === "string" ? value : undefined;
}

export default async function NewOrderPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePermission("orders.create", "/orders");
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const requestedCustomerId = defaultCustomerId(params);
  const { error, success } = searchParamMessage(params);
  const canSeeAnyPrices =
    hasAppPermission(context.profile.role, context.permissions, "prices.purchase.view") ||
    hasAppPermission(context.profile.role, context.permissions, "prices.sales.view");
  const canUseCalculation = canSeeAnyPrices || hasAppPermission(context.profile.role, context.permissions, "quotes.create");

  const [customersResult, employeesResult, settingsResult, calculationSettingsResult, inventoryResult] = await Promise.all([
    supabase
      .from("customers")
      .select(customerFormSelect)
      .eq("company_id", context.companyId)
      .eq("status", "aktiv")
      .order("updated_at", { ascending: false })
      .limit(customerOptionLimit),
    supabase
      .from("profiles")
      .select(profileOptionSelect)
      .eq("company_id", context.companyId)
      .eq("active", true)
      .in("role", ["mitarbeiter", "vorarbeiter"])
      .order("full_name")
      .limit(employeeOptionLimit),
    supabase
      .from("company_pricing_settings")
      .select(companyPricingSettingsSelect)
      .eq("company_id", context.companyId)
      .maybeSingle(),
    canUseCalculation
      ? supabase
          .from("calculation_settings")
          .select(calculationSettingsSelect)
          .eq("company_id", context.companyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    canSeeAnyPrices
      ? supabase
          .from("inventory_items")
          .select(inventoryItemCalculationSelect)
          .eq("company_id", context.companyId)
          .order("name", { ascending: true })
          .limit(materialPriceOptionLimit)
      : Promise.resolve({ data: [], error: null })
  ]);
  const customerRows = [...((customersResult.data ?? []) as Customer[])];
  if (requestedCustomerId && !customerRows.some((customer) => customer.id === requestedCustomerId)) {
    const { data: requestedCustomer } = await supabase
      .from("customers")
      .select(customerFormSelect)
      .eq("company_id", context.companyId)
      .eq("id", requestedCustomerId)
      .maybeSingle();
    if (requestedCustomer) customerRows.unshift(requestedCustomer as Customer);
  }

  const queryError =
    safeQueryErrorMessage(customersResult.error) ||
    safeQueryErrorMessage(employeesResult.error) ||
    safeQueryErrorMessage(settingsResult.error) ||
    safeQueryErrorMessage(calculationSettingsResult.error) ||
    safeQueryErrorMessage(inventoryResult.error);

  const settings = (settingsResult.data ?? {
    company_id: context.companyId,
    waste_percent: 20,
    default_markup_percent: 35,
    auto_calculate_sales_price: true
  }) as CompanyPricingSettings;
  const materialPriceOptions = ((inventoryResult.data ?? []) as unknown as Array<
    Omit<RoofingMaterialPriceRow, "inventory_locations"> & {
      inventory_locations?: RoofingMaterialPriceRow["inventory_locations"] | RoofingMaterialPriceRow["inventory_locations"][];
    }
  >).map((item) => ({
    ...item,
    inventory_locations: Array.isArray(item.inventory_locations)
      ? item.inventory_locations[0] ?? null
      : item.inventory_locations ?? null
  }));

  return (
    <>
      <PageHeader
        title="Neuer Auftrag"
        description="Kunde wählen, Auftrag erfassen und Materialbedarf mit Verschnitt berechnen."
      />
      <MessageBox error={error || queryError} success={success} />
      <OrderWizardForm
        customers={customerRows}
        employees={(employeesResult.data ?? []) as Profile[]}
        defaultCustomerId={requestedCustomerId}
        defaultWastePercent={Number(settings.waste_percent ?? 20)}
        canManage={context.canManage}
        materialPriceOptions={materialPriceOptions}
        calculationDefaults={{
          vatRate: Number(calculationSettingsResult.data?.default_vat_rate ?? 19),
          internalLaborRateNet: canUseCalculation ? Number(calculationSettingsResult.data?.default_internal_hourly_cost ?? 38) : 0,
          laborRateNet: canUseCalculation ? Number(calculationSettingsResult.data?.default_labor_rate_net ?? 65) : 0,
          travelRatePerKm: canUseCalculation ? Number(calculationSettingsResult.data?.default_travel_rate_per_km ?? 0.75) : 0,
          travelFlatRate: canUseCalculation ? Number(calculationSettingsResult.data?.default_travel_flat_rate ?? 0) : 0
        }}
      />
    </>
  );
}
