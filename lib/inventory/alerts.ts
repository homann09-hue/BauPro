import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MaterialAlertSeverity, MaterialAlertType } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function createOrUpdateMaterialAlert({
  supabase,
  companyId,
  materialId,
  inventoryItemId,
  jobId,
  bringListId,
  alertType,
  severity,
  message,
  requiredQuantity,
  availableQuantity,
  missingQuantity,
  unit,
  createdBySystem = true
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  materialId?: string | null;
  inventoryItemId?: string | null;
  jobId?: string | null;
  bringListId?: string | null;
  alertType: MaterialAlertType;
  severity: MaterialAlertSeverity;
  message: string;
  requiredQuantity?: number | null;
  availableQuantity?: number | null;
  missingQuantity?: number | null;
  unit?: string | null;
  createdBySystem?: boolean;
}) {
  let query = supabase
    .from("material_alerts")
    .select("id")
    .eq("company_id", companyId)
    .eq("alert_type", alertType)
    .eq("status", "open");

  query = inventoryItemId ? query.eq("inventory_item_id", inventoryItemId) : query.is("inventory_item_id", null);
  query = jobId ? query.eq("job_id", jobId) : query.is("job_id", null);
  query = bringListId ? query.eq("bring_list_id", bringListId) : query.is("bring_list_id", null);

  const { data: existing } = await query.maybeSingle();
  const payload = {
    company_id: companyId,
    material_id: materialId ?? null,
    inventory_item_id: inventoryItemId ?? null,
    job_id: jobId ?? null,
    bring_list_id: bringListId ?? null,
    alert_type: alertType,
    severity,
    message,
    required_quantity: requiredQuantity ?? null,
    available_quantity: availableQuantity ?? null,
    missing_quantity: missingQuantity ?? null,
    unit: unit ?? null,
    created_by_system: createdBySystem,
    status: "open"
  };

  if (existing?.id) {
    const { data } = await supabase.from("material_alerts").update(payload).eq("id", existing.id).select("id").single();
    return (data?.id as string | undefined) ?? (existing.id as string);
  }

  const { data } = await supabase.from("material_alerts").insert(payload).select("id").single();
  return (data?.id as string | undefined) ?? null;
}

export async function resolveMaterialAlertsIfStockOk({
  supabase,
  companyId,
  inventoryItemId
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  inventoryItemId: string;
}) {
  const { data: item } = await supabase
    .from("inventory_items")
    .select("id, stock, minimum_stock")
    .eq("company_id", companyId)
    .eq("id", inventoryItemId)
    .single();

  if (!item) return;
  if (Number(item.stock ?? 0) <= Number(item.minimum_stock ?? 0)) return;

  await supabase
    .from("material_alerts")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("company_id", companyId)
    .eq("inventory_item_id", inventoryItemId)
    .eq("status", "open")
    .in("alert_type", ["low_stock", "out_of_stock", "below_minimum_after_reservation"]);
}
