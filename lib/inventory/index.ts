import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { InventoryItem, InventoryLocation, InventoryLocationType } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const inventoryLocationTypes: InventoryLocationType[] = [
  "Hauptlager",
  "Fahrzeuglager",
  "Baustelle",
  "Container",
  "Werkstatt"
];

const defaultLocations: Array<Pick<InventoryLocation, "name" | "location_type" | "notes">> = [
  {
    name: "Hauptlager",
    location_type: "Hauptlager",
    notes: "Zentrales Lager fuer Standardmaterial und Nachbestellung."
  },
  {
    name: "Fahrzeuglager 1",
    location_type: "Fahrzeuglager",
    notes: "Materialbestand im ersten Montagefahrzeug."
  },
  {
    name: "Baustellenmaterial",
    location_type: "Baustelle",
    notes: "Material, das bereits fuer laufende Baustellen reserviert ist."
  },
  {
    name: "Container",
    location_type: "Container",
    notes: "Materialcontainer auf Hof oder Baustelle."
  },
  {
    name: "Werkstatt",
    location_type: "Werkstatt",
    notes: "Kleinmaterial, Werkstatt- und Reparaturbedarf."
  }
];

export async function ensureDefaultInventoryLocations(
  supabase: SupabaseServerClient,
  companyId: string
) {
  const { data, error } = await supabase
    .from("inventory_locations")
    .select("*")
    .eq("company_id", companyId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (error || (data && data.length > 0)) {
    return (data ?? []) as InventoryLocation[];
  }

  const { data: inserted } = await supabase
    .from("inventory_locations")
    .upsert(
      defaultLocations.map((location) => ({
        ...location,
        company_id: companyId
      })),
      { onConflict: "company_id,name" }
    )
    .select("*")
    .order("created_at", { ascending: true });

  return (inserted ?? []) as InventoryLocation[];
}

export function isLowStock(item: Pick<InventoryItem, "stock" | "minimum_stock">) {
  return Number(item.minimum_stock) > 0 && Number(item.stock) <= Number(item.minimum_stock);
}

export function formatQuantity(value?: number | string | null) {
  const numberValue = Number(value ?? 0);

  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

export function toInventoryLocationType(value: FormDataEntryValue | null): InventoryLocationType {
  const locationType = String(value ?? "Hauptlager");
  return inventoryLocationTypes.includes(locationType as InventoryLocationType)
    ? (locationType as InventoryLocationType)
    : "Hauptlager";
}
