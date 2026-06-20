import { createOrUpdateMaterialAlert } from "@/lib/inventory/alerts";
import { bringListItemWithInventorySelect, bringListOperationalSelect } from "@/lib/data/selects";
import { generatePurchaseSuggestions } from "@/lib/inventory/purchase-suggestions";
import { createMaterialReservation, reservedQuantityForInventoryItem } from "@/lib/inventory/reservations";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BringListItem, InventoryItem, MaterialAlertSeverity } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type AvailabilityStatus = "ausreichend" | "knapp" | "nicht_vorhanden" | "unter_mindestbestand_nach_reservierung";

export type AvailabilityResult = {
  status: AvailabilityStatus;
  requiredQuantity: number;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  missingQuantity: number;
  unit: string;
};

export async function checkMaterialAvailability({
  supabase,
  companyId,
  inventoryItemId,
  requiredQuantity,
  unit,
  excludeBringListId
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  inventoryItemId: string | null;
  requiredQuantity: number;
  unit: string;
  excludeBringListId?: string | null;
}): Promise<AvailabilityResult> {
  if (!inventoryItemId) {
    return {
      status: "nicht_vorhanden",
      requiredQuantity,
      stockQuantity: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
      missingQuantity: requiredQuantity,
      unit
    };
  }

  const [{ data: item }, reservedQuantity] = await Promise.all([
    supabase
      .from("inventory_items_public")
      .select("id, stock, minimum_stock, unit")
      .eq("company_id", companyId)
      .eq("id", inventoryItemId)
      .single(),
    reservedQuantityForInventoryItem({ supabase, companyId, inventoryItemId, excludeBringListId })
  ]);

  const typedItem = item as Pick<InventoryItem, "stock" | "minimum_stock"> | null;
  const stockQuantity = Number(typedItem?.stock ?? 0);
  const availableQuantity = Math.max(0, stockQuantity - reservedQuantity);
  const missingQuantity = Math.max(0, requiredQuantity - availableQuantity);
  const afterReservation = availableQuantity - Math.min(availableQuantity, requiredQuantity);

  let status: AvailabilityStatus = "ausreichend";
  if (missingQuantity >= requiredQuantity) status = "nicht_vorhanden";
  else if (missingQuantity > 0) status = "knapp";
  else if (typedItem && Number(typedItem.minimum_stock ?? 0) > 0 && afterReservation < Number(typedItem.minimum_stock)) {
    status = "unter_mindestbestand_nach_reservierung";
  }

  return {
    status,
    requiredQuantity,
    stockQuantity,
    reservedQuantity,
    availableQuantity,
    missingQuantity,
    unit
  };
}

function severityForStatus(status: AvailabilityStatus): MaterialAlertSeverity {
  if (status === "nicht_vorhanden") return "critical";
  if (status === "knapp" || status === "unter_mindestbestand_nach_reservierung") return "warning";
  return "info";
}

function snapshotRiskForStatus(status: AvailabilityStatus) {
  if (status === "nicht_vorhanden") return "red";
  if (status === "knapp" || status === "unter_mindestbestand_nach_reservierung") return "yellow";
  return "green";
}

function snapshotLabelForStatus(status: AvailabilityStatus) {
  if (status === "nicht_vorhanden") return "Fehlt";
  if (status === "knapp") return "Knapp";
  if (status === "unter_mindestbestand_nach_reservierung") return "Unter Mindestbestand";
  return "Alles da";
}

export async function checkBringListAvailability({
  supabase,
  companyId,
  bringListId,
  reserve = false,
  reservedBy
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  bringListId: string;
  reserve?: boolean;
  reservedBy?: string;
}) {
  const [{ data: bringList }, { data: items }] = await Promise.all([
    supabase.from("bring_lists").select(bringListOperationalSelect).eq("id", bringListId).eq("company_id", companyId).single(),
    supabase.from("bring_list_items").select(bringListItemWithInventorySelect).eq("bring_list_id", bringListId)
  ]);

  const results = [];
  for (const item of ((items ?? []) as unknown as BringListItem[]).filter((row) => row.item_type === "material")) {
    const availability = await checkMaterialAvailability({
      supabase,
      companyId,
      inventoryItemId: item.inventory_item_id,
      requiredQuantity: Number(item.quantity),
      unit: item.unit,
      excludeBringListId: bringListId
    });

    await supabase.from("bring_list_availability_snapshots").insert({
      company_id: companyId,
      bring_list_id: bringListId,
      bring_list_item_id: item.id,
      inventory_item_id: item.inventory_item_id,
      required_quantity: availability.requiredQuantity,
      available_quantity: availability.availableQuantity,
      reserved_quantity: availability.reservedQuantity,
      missing_quantity: availability.missingQuantity,
      risk_level: snapshotRiskForStatus(availability.status),
      status_label: snapshotLabelForStatus(availability.status),
      source: reserve ? "reservation_check" : "availability_check"
    });

    if (availability.status !== "ausreichend") {
      const alertType =
        availability.status === "unter_mindestbestand_nach_reservierung"
          ? "below_minimum_after_reservation"
          : availability.status === "nicht_vorhanden"
            ? "out_of_stock"
            : "missing_for_job";
      const missing = availability.missingQuantity > 0 ? availability.missingQuantity : Math.max(0, availability.requiredQuantity);
      const materialName = item.custom_item_name;
      const message = `${materialName}: benoetigt ${availability.requiredQuantity} ${item.unit}, verfuegbar ${availability.availableQuantity} ${item.unit}.`;

      await createOrUpdateMaterialAlert({
        supabase,
        companyId,
        materialId: item.material_id,
        inventoryItemId: item.inventory_item_id,
        jobId: (bringList as { job_id?: string } | null)?.job_id ?? null,
        bringListId,
        alertType,
        severity: severityForStatus(availability.status),
        message,
        requiredQuantity: availability.requiredQuantity,
        availableQuantity: availability.availableQuantity,
        missingQuantity: missing,
        unit: item.unit
      });

      if (missing > 0) {
        await generatePurchaseSuggestions({
          supabase,
          companyId,
          materialId: item.material_id,
          inventoryItemId: item.inventory_item_id,
          jobId: (bringList as { job_id?: string } | null)?.job_id ?? null,
          bringListId,
          quantityNeeded: missing,
          unit: item.unit,
          reason: `Fehlt fuer Mitbringliste: ${materialName}`
        });
      }
    }

    if (reserve && reservedBy) {
      await createMaterialReservation({
        supabase,
        companyId,
        jobId: (bringList as { job_id?: string } | null)?.job_id ?? null,
        bringListId,
        materialId: item.material_id,
        inventoryItemId: item.inventory_item_id,
        quantityRequired: availability.requiredQuantity,
        quantityReserved: Math.min(availability.availableQuantity, availability.requiredQuantity),
        unit: item.unit,
        reservedBy
      });
    }

    results.push({ itemId: item.id, ...availability });
  }

  return results;
}

export async function checkJobMaterialAvailability({
  supabase,
  companyId,
  jobId
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  jobId: string;
}) {
  const { data: lists } = await supabase
    .from("bring_lists")
    .select("id")
    .eq("company_id", companyId)
    .eq("job_id", jobId)
    .neq("status", "delivered");

  const results = [];
  for (const list of lists ?? []) {
    results.push(...(await checkBringListAvailability({ supabase, companyId, bringListId: list.id as string })));
  }
  return results;
}
