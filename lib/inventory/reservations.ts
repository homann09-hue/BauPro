import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MaterialReservationStatus } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function reservedQuantityForInventoryItem({
  supabase,
  companyId,
  inventoryItemId,
  excludeBringListId
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  inventoryItemId: string;
  excludeBringListId?: string | null;
}) {
  let query = supabase
    .from("material_reservations")
    .select("quantity_reserved, bring_list_id")
    .eq("company_id", companyId)
    .eq("inventory_item_id", inventoryItemId)
    .in("status", ["open", "reserved", "partially_reserved"]);

  if (excludeBringListId) query = query.neq("bring_list_id", excludeBringListId);

  const { data } = await query;
  return (data ?? []).reduce((sum, row) => sum + Number(row.quantity_reserved ?? 0), 0);
}

export async function createMaterialReservation({
  supabase,
  companyId,
  jobId,
  bringListId,
  materialId,
  inventoryItemId,
  quantityRequired,
  quantityReserved,
  unit,
  reservedBy
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  jobId?: string | null;
  bringListId?: string | null;
  materialId?: string | null;
  inventoryItemId?: string | null;
  quantityRequired: number;
  quantityReserved: number;
  unit: string;
  reservedBy: string;
}) {
  const status: MaterialReservationStatus =
    quantityReserved <= 0 ? "missing" : quantityReserved < quantityRequired ? "partially_reserved" : "reserved";

  let query = supabase
    .from("material_reservations")
    .select("id")
    .eq("company_id", companyId)
    .eq("status", "open");

  query = inventoryItemId ? query.eq("inventory_item_id", inventoryItemId) : query.is("inventory_item_id", null);
  query = bringListId ? query.eq("bring_list_id", bringListId) : query.is("bring_list_id", null);

  const { data: existing } = await query.maybeSingle();
  const payload = {
    company_id: companyId,
    job_id: jobId ?? null,
    bring_list_id: bringListId ?? null,
    material_id: materialId ?? null,
    inventory_item_id: inventoryItemId ?? null,
    quantity_required: quantityRequired,
    quantity_reserved: quantityReserved,
    unit,
    status,
    reserved_by: reservedBy,
    reserved_at: new Date().toISOString()
  };

  if (existing?.id) {
    const { data } = await supabase.from("material_reservations").update(payload).eq("id", existing.id).select("id").single();
    return (data?.id as string | undefined) ?? (existing.id as string);
  }

  const { data } = await supabase.from("material_reservations").insert(payload).select("id").single();
  return (data?.id as string | undefined) ?? null;
}
