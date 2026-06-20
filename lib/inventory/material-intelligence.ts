import { calculateMaterialAvailability, summarizeAvailability, type MaterialAvailability } from "@/lib/inventory/availability";
import { formatQuantity } from "@/lib/inventory";
import {
  bringListDetailSelect,
  bringListItemWithInventorySelect,
  materialAlertSelect,
  materialReservationSelect,
  purchaseSuggestionSelect
} from "@/lib/data/selects";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { BringList, BringListItem, InventoryItem, MaterialAlert, MaterialReservation, PurchaseSuggestion } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type BringListMaterialPosition = {
  item: BringListItem;
  materialName: string;
  availability: MaterialAvailability;
};

export type BringListMaterialStatus = {
  bringList: BringList;
  positions: BringListMaterialPosition[];
  summary: ReturnType<typeof summarizeAvailability>;
  alerts: MaterialAlert[];
  purchaseSuggestions: PurchaseSuggestion[];
};

export function tomorrowIsoDate(now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function materialStatusText(status: BringListMaterialStatus) {
  const critical = status.summary.criticalCount;
  const warnings = status.summary.warningCount;
  if (critical > 0) return `${critical} kritisch, ${warnings} knapp`;
  if (warnings > 0) return `${warnings} knapp`;
  return "Alles da";
}

export async function loadBringListMaterialStatus({
  supabase,
  companyId,
  date = tomorrowIsoDate(),
  limit = 20
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  date?: string;
  limit?: number;
}): Promise<BringListMaterialStatus[]> {
  const { data: lists } = await supabase
    .from("bring_lists")
    .select(bringListDetailSelect)
    .eq("company_id", companyId)
    .eq("date", date)
    .order("created_at", { ascending: true })
    .limit(limit);

  const bringLists = (lists ?? []) as unknown as BringList[];
  const bringListIds = bringLists.map((list) => list.id);
  if (bringListIds.length === 0) return [];

  const [{ data: itemData }, { data: reservationData }, { data: alertData }, { data: suggestionData }] = await Promise.all([
    supabase.from("bring_list_items").select(bringListItemWithInventorySelect).in("bring_list_id", bringListIds),
    supabase.from("material_reservations").select(materialReservationSelect).eq("company_id", companyId).in("bring_list_id", bringListIds),
    supabase.from("material_alerts").select(materialAlertSelect).eq("company_id", companyId).eq("status", "open").in("bring_list_id", bringListIds),
    supabase.from("purchase_suggestions").select(purchaseSuggestionSelect).eq("company_id", companyId).eq("status", "open").in("bring_list_id", bringListIds)
  ]);

  const items = (itemData ?? []) as unknown as BringListItem[];
  const reservations = (reservationData ?? []) as unknown as MaterialReservation[];
  const alerts = (alertData ?? []) as unknown as MaterialAlert[];
  const suggestions = (suggestionData ?? []) as unknown as PurchaseSuggestion[];

  return bringLists.map((bringList) => {
    const listItems = items.filter((item) => item.bring_list_id === bringList.id);
    const listReservations = reservations.filter((reservation) => reservation.bring_list_id === bringList.id);
    const listSuggestions = suggestions.filter((suggestion) => suggestion.bring_list_id === bringList.id);
    const orderedByInventoryId = new Map<string, number>();
    for (const suggestion of listSuggestions.filter((suggestion) => suggestion.status === "open" || suggestion.status === "ordered")) {
      if (!suggestion.inventory_item_id) continue;
      orderedByInventoryId.set(
        suggestion.inventory_item_id,
        (orderedByInventoryId.get(suggestion.inventory_item_id) ?? 0) + Number(suggestion.quantity_needed ?? 0)
      );
    }

    const reservedByInventoryId = new Map<string, number>();
    for (const reservation of listReservations.filter((reservation) =>
      ["open", "reserved", "partially_reserved"].includes(reservation.status)
    )) {
      if (!reservation.inventory_item_id) continue;
      reservedByInventoryId.set(
        reservation.inventory_item_id,
        (reservedByInventoryId.get(reservation.inventory_item_id) ?? 0) + Number(reservation.quantity_reserved ?? 0)
      );
    }

    const positions = listItems.map((item) => {
      const inventory = item.inventory_items as (InventoryItem & { inventory_locations?: { name?: string | null; location_type?: string | null } | null }) | undefined;
      const reservedQuantity = item.inventory_item_id ? reservedByInventoryId.get(item.inventory_item_id) ?? 0 : 0;
      const orderedQuantity = item.inventory_item_id ? orderedByInventoryId.get(item.inventory_item_id) ?? 0 : 0;
      const availability = calculateMaterialAvailability({
        requiredQuantity: Number(item.quantity),
        stockQuantity: Number(inventory?.stock ?? 0),
        reservedQuantity,
        minimumStock: Number(inventory?.minimum_stock ?? 0),
        orderedQuantity,
        unit: item.unit,
        locationName: item.storage_location ?? inventory?.inventory_locations?.name ?? null,
        locationType: inventory?.inventory_locations?.location_type ?? null
      });

      return {
        item,
        materialName: item.custom_item_name,
        availability
      };
    });

    return {
      bringList,
      positions,
      summary: summarizeAvailability(positions.map((position) => position.availability)),
      alerts: alerts.filter((alert) => alert.bring_list_id === bringList.id),
      purchaseSuggestions: listSuggestions
    };
  });
}

export function criticalPositionText(position: BringListMaterialPosition) {
  const { availability } = position;
  if (availability.missingQuantity <= 0) return `${position.materialName}: ${availability.statusLabel}`;
  return `${position.materialName}: fehlt ${formatQuantity(availability.missingQuantity)} ${availability.unit}`;
}
