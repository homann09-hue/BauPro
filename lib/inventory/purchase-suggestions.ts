import type { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function generatePurchaseSuggestions({
  supabase,
  companyId,
  materialId,
  inventoryItemId,
  jobId,
  bringListId,
  quantityNeeded,
  unit,
  reason
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  materialId?: string | null;
  inventoryItemId?: string | null;
  jobId?: string | null;
  bringListId?: string | null;
  quantityNeeded: number;
  unit: string;
  reason: string;
}) {
  if (quantityNeeded <= 0) return null;

  let query = supabase
    .from("purchase_suggestions")
    .select("id")
    .eq("company_id", companyId)
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
    quantity_needed: quantityNeeded,
    unit,
    reason,
    status: "open"
  };

  if (existing?.id) {
    const { data } = await supabase.from("purchase_suggestions").update(payload).eq("id", existing.id).select("id").single();
    return (data?.id as string | undefined) ?? (existing.id as string);
  }

  const { data } = await supabase.from("purchase_suggestions").insert(payload).select("id").single();
  return (data?.id as string | undefined) ?? null;
}
