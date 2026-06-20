import "server-only";

import { createHash } from "node:crypto";
import { mergeAutomaticBringListItems, type AutomaticBringListItemDraft } from "@/lib/bring-lists/auto-generate-utils";
import { bringListTemplates } from "@/lib/bring-list-templates";
import type { AppContext } from "@/lib/auth";
import { searchOrFilter } from "@/lib/data/shared";
import { bringListItemSelect, jobMaterialRequirementPublicSelect, planningAssignmentSelect } from "@/lib/data/selects";
import { checkBringListAvailability } from "@/lib/inventory/check-availability";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  BringList,
  BringListItem,
  JobMaterialRequirement,
  Jobsite,
  OrderPriority,
  OrderStatus,
  OrderType,
  PlanningAssignment,
  PlanningResourceStatus
} from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type BringListSyncResult = {
  created: number;
  updated: number;
  checked: number;
  listIds: string[];
};

type AutoOrder = {
  id: string;
  company_id: string;
  jobsite_id: string | null;
  title: string;
  order_type: OrderType;
  status: OrderStatus;
  priority: OrderPriority;
  assigned_employee_ids: string[];
  start_date: string | null;
  end_date: string | null;
  jobsites?: Pick<Jobsite, "id" | "name" | "customer" | "address" | "assigned_employee_ids"> | null;
};

type AutoJobsite = Pick<Jobsite, "id" | "name" | "customer" | "address" | "assigned_employee_ids" | "status">;

type InventoryMatch = {
  id: string;
  name: string;
  unit: string;
  location_id: string | null;
  stock: number;
  minimum_stock: number;
  inventory_locations?: { name: string | null; location_type: string | null; vehicle_id: string | null } | null;
};

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function sourceHash(items: AutomaticBringListItemDraft[]) {
  const stable = items
    .map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      itemType: item.itemType,
      materialId: item.materialId,
      inventoryItemId: item.inventoryItemId,
      sourceType: item.sourceType,
      sourceRef: item.sourceRef,
      requiredVehicleId: item.requiredVehicleId
    }))
    .sort((a, b) => `${a.sourceType}:${a.sourceRef}`.localeCompare(`${b.sourceType}:${b.sourceRef}`));

  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

function actorMayGenerate(context: AppContext) {
  return context.canManage || context.canOperate;
}

function employeeIdsForJobsite({
  jobsite,
  orders,
  assignments
}: {
  jobsite: AutoJobsite;
  orders: AutoOrder[];
  assignments: PlanningAssignment[];
}) {
  const ids = new Set<string>();
  for (const assignment of assignments) {
    if (assignment.resource_type === "employee" && assignment.employee_id) ids.add(assignment.employee_id);
  }
  for (const order of orders) {
    for (const id of order.assigned_employee_ids ?? []) ids.add(id);
  }
  for (const id of jobsite.assigned_employee_ids ?? []) ids.add(id);
  return [...ids];
}

function firstVehicleForJobsite(assignments: PlanningAssignment[]) {
  return assignments.find((assignment) => assignment.resource_type === "vehicle" && assignment.vehicle_id)?.vehicle_id ?? null;
}

function equipmentNote(status: PlanningResourceStatus | undefined) {
  if (status === "defekt") return "Geraet ist als defekt markiert. Ersatz pruefen.";
  if (status === "werkstatt") return "Geraet ist in der Werkstatt. Ersatz pruefen.";
  if (status === "reserviert") return "Geraet ist bereits reserviert. Verfuegbarkeit pruefen.";
  return null;
}

function itemFromRequirement(requirement: JobMaterialRequirement): AutomaticBringListItemDraft {
  return {
    name: requirement.material_name,
    quantity: Number(requirement.total_quantity ?? 0),
    unit: requirement.unit,
    itemType: "material",
    materialId: null,
    inventoryItemId: requirement.inventory_item_id,
    sourceType: "order_material",
    sourceRef: requirement.id,
    vehicleId: null,
    requiredVehicleId: null,
    notes: requirement.location_name ? `Geplanter Lagerort: ${requirement.location_name}` : null
  };
}

function itemsFromOrderTemplate(order: AutoOrder): AutomaticBringListItemDraft[] {
  return bringListTemplates[order.order_type].map((item, index) => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    itemType: item.itemType,
    materialId: null,
    inventoryItemId: null,
    sourceType: "order_template",
    sourceRef: `${order.id}:${index}:${item.name}`,
    vehicleId: null,
    requiredVehicleId: null,
    notes: `Standardausstattung fuer ${order.title}`
  }));
}

function itemsFromPlanningAssignment(assignment: PlanningAssignment): AutomaticBringListItemDraft | null {
  if (assignment.resource_type === "vehicle" && assignment.vehicle_id) {
    const label = assignment.vehicles?.license_plate
      ? `${assignment.vehicles.name} (${assignment.vehicles.license_plate})`
      : (assignment.vehicles?.name ?? assignment.title);

    return {
      name: `Fahrzeug: ${label}`,
      quantity: 1,
      unit: "Stueck",
      itemType: "other",
      materialId: null,
      inventoryItemId: null,
      sourceType: "planning_vehicle",
      sourceRef: assignment.id,
      vehicleId: assignment.vehicle_id,
      requiredVehicleId: assignment.vehicle_id,
      notes: "Aus Plantafel uebernommen."
    };
  }

  if (assignment.resource_type === "equipment" && assignment.planning_resource_id) {
    const statusNote = equipmentNote(assignment.planning_resources?.status);
    return {
      name: assignment.planning_resources?.name ?? assignment.title,
      quantity: 1,
      unit: "Stueck",
      itemType: "tool",
      materialId: null,
      inventoryItemId: null,
      sourceType: "planning_equipment",
      sourceRef: assignment.id,
      vehicleId: null,
      requiredVehicleId: null,
      notes: statusNote
    };
  }

  return null;
}

async function loadInventoryMatches({
  supabase,
  companyId,
  items
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  items: AutomaticBringListItemDraft[];
}) {
  const names = [...new Set(items.filter((item) => item.itemType !== "document" && !item.inventoryItemId).map((item) => item.name))].slice(0, 50);
  const matches = new Map<string, InventoryMatch>();

  for (const name of names) {
    const { data } = await supabase
      .from("inventory_items")
      .select("id, name, unit, location_id, stock, minimum_stock, inventory_locations(id, name, location_type, vehicle_id)")
      .eq("company_id", companyId)
      .or(searchOrFilter(["name"], name))
      .order("stock", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      const row = data as unknown as InventoryMatch & {
        inventory_locations?: InventoryMatch["inventory_locations"] | NonNullable<InventoryMatch["inventory_locations"]>[];
      };
      const location = Array.isArray(row.inventory_locations) ? row.inventory_locations[0] : row.inventory_locations;
      matches.set(name, { ...row, inventory_locations: location ?? null });
    }
  }

  return matches;
}

async function loadAutoSources({
  supabase,
  context,
  date
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  date: string;
}) {
  let assignmentsQuery = supabase
    .from("planning_assignments")
    .select(planningAssignmentSelect)
    .eq("company_id", context.companyId)
    .lte("start_date", date)
    .gte("end_date", date)
    .in("status", ["geplant", "aktiv"])
    .is("archived_at", null)
    .not("jobsite_id", "is", null);

  if (!context.canManage) {
    assignmentsQuery = assignmentsQuery.or(`employee_id.eq.${context.userId},created_by.eq.${context.userId}`);
  }

  let ordersQuery = supabase
    .from("orders")
    .select("id, company_id, jobsite_id, title, order_type, status, priority, assigned_employee_ids, start_date, end_date, jobsites(id, name, customer, address, assigned_employee_ids)")
    .eq("company_id", context.companyId)
    .in("status", ["geplant", "in_arbeit"])
    .not("jobsite_id", "is", null)
    .order("priority", { ascending: false })
    .limit(100);

  if (!context.canManage) {
    ordersQuery = ordersQuery.contains("assigned_employee_ids", [context.userId]);
  }

  const [{ data: assignmentRows }, { data: orderRows }] = await Promise.all([assignmentsQuery, ordersQuery]);
  const assignments = (assignmentRows ?? []) as unknown as PlanningAssignment[];
  const orders = (orderRows ?? []) as unknown as AutoOrder[];
  const jobsiteIds = new Set<string>();

  for (const assignment of assignments) {
    if (assignment.jobsite_id) jobsiteIds.add(assignment.jobsite_id);
  }
  for (const order of orders) {
    if (order.jobsite_id) jobsiteIds.add(order.jobsite_id);
  }

  const orderIds = orders.map((order) => order.id);
  const requirementsById = new Map<string, JobMaterialRequirement>();

  if (orderIds.length > 0) {
    const { data } = await supabase
      .from("job_material_requirements")
      .select(jobMaterialRequirementPublicSelect)
      .eq("company_id", context.companyId)
      .in("order_id", orderIds)
      .is("archived_at", null);

    for (const requirement of (data ?? []) as unknown as JobMaterialRequirement[]) requirementsById.set(requirement.id, requirement);
  }

  if (jobsiteIds.size > 0) {
    const { data } = await supabase
      .from("job_material_requirements")
      .select(jobMaterialRequirementPublicSelect)
      .eq("company_id", context.companyId)
      .in("jobsite_id", [...jobsiteIds])
      .is("archived_at", null);

    for (const requirement of (data ?? []) as unknown as JobMaterialRequirement[]) requirementsById.set(requirement.id, requirement);
  }

  for (const requirement of requirementsById.values()) {
    if (requirement.jobsite_id) jobsiteIds.add(requirement.jobsite_id);
  }

  const { data: jobsiteRows } =
    jobsiteIds.size > 0
      ? await supabase
          .from("jobsites")
          .select("id, company_id, name, customer, address, assigned_employee_ids, status")
          .eq("company_id", context.companyId)
          .in("id", [...jobsiteIds])
          .in("status", ["geplant", "aktiv"])
      : { data: [] };

  const jobsites = (jobsiteRows ?? []) as unknown as AutoJobsite[];
  return { assignments, orders, requirements: [...requirementsById.values()], jobsites };
}

async function logBringListSync({
  supabase,
  companyId,
  bringListId,
  actorId,
  action,
  newValues
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  bringListId: string;
  actorId: string;
  action: string;
  newValues: Record<string, unknown>;
}) {
  await supabase.from("bring_list_audit_log").insert({
    company_id: companyId,
    bring_list_id: bringListId,
    actor_id: actorId,
    action,
    new_values: newValues
  });
}

async function upsertAutomaticItems({
  supabase,
  companyId,
  bringListId,
  vehicleId,
  drafts
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  bringListId: string;
  vehicleId: string | null;
  drafts: AutomaticBringListItemDraft[];
}) {
  if (drafts.length === 0) return { inserted: 0, updated: 0 };

  const inventoryMatches = await loadInventoryMatches({ supabase, companyId, items: drafts });
  const { data: existingRows } = await supabase.from("bring_list_items").select(bringListItemSelect).eq("bring_list_id", bringListId);
  const existing = (existingRows ?? []) as unknown as BringListItem[];
  const existingBySource = new Map(existing.filter((item) => item.source_type && item.source_ref).map((item) => [`${item.source_type}:${item.source_ref}`, item]));

  let inserted = 0;
  let updated = 0;

  for (const draft of drafts) {
    const match = draft.inventoryItemId ? null : inventoryMatches.get(draft.name);
    const inventoryItemId = draft.inventoryItemId ?? match?.id ?? null;
    const locationName = match?.inventory_locations?.name ?? null;
    const storageLocation = locationName ?? (draft.vehicleId ? "Plantafel-Fahrzeug" : null);
    const targetVehicleId = draft.vehicleId ?? null;
    const requiredVehicleId = draft.requiredVehicleId ?? null;
    const sourceKey = `${draft.sourceType}:${draft.sourceRef}`;
    const existingItem = existingBySource.get(sourceKey);

    const row = {
      inventory_item_id: inventoryItemId,
      custom_item_name: match?.name ?? draft.name,
      item_type: draft.itemType,
      quantity: draft.quantity,
      unit: match?.unit ?? draft.unit,
      storage_location: storageLocation,
      vehicle_id: targetVehicleId,
      required_vehicle_id: requiredVehicleId,
      notes:
        draft.notes ??
        (vehicleId && match?.inventory_locations?.vehicle_id && match.inventory_locations.vehicle_id !== vehicleId
          ? "Liegt laut Lagerbestand in einem anderen Fahrzeug."
          : null),
      auto_generated: true,
      source_type: draft.sourceType,
      source_ref: draft.sourceRef
    };

    if (existingItem) {
      const { error } = await supabase.from("bring_list_items").update(row).eq("id", existingItem.id).eq("bring_list_id", bringListId);
      if (!error) updated += 1;
    } else {
      const { error } = await supabase.from("bring_list_items").insert({ bring_list_id: bringListId, ...row });
      if (!error) inserted += 1;
    }
  }

  return { inserted, updated };
}

export async function ensureAutomaticBringListsForDate({
  supabase,
  context,
  date = tomorrowIsoDate()
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  date?: string;
}): Promise<BringListSyncResult> {
  if (!actorMayGenerate(context)) return { created: 0, updated: 0, checked: 0, listIds: [] };

  const { assignments, orders, requirements, jobsites } = await loadAutoSources({ supabase, context, date });
  const listIds: string[] = [];
  let created = 0;
  let updated = 0;
  let checked = 0;

  for (const jobsite of jobsites) {
    const jobAssignments = assignments.filter((assignment) => assignment.jobsite_id === jobsite.id);
    const jobOrders = orders.filter((order) => order.jobsite_id === jobsite.id);
    const jobRequirements = requirements.filter((requirement) => requirement.jobsite_id === jobsite.id || jobOrders.some((order) => order.id === requirement.order_id));
    const vehicleId = firstVehicleForJobsite(jobAssignments);
    const employeeIds = employeeIdsForJobsite({ jobsite, orders: jobOrders, assignments: jobAssignments });
    const assignedTo = employeeIds[0] ?? null;

    const drafts = mergeAutomaticBringListItems([
      ...jobRequirements.map(itemFromRequirement),
      ...jobOrders.flatMap(itemsFromOrderTemplate),
      ...jobAssignments.map(itemsFromPlanningAssignment).filter((item): item is AutomaticBringListItemDraft => Boolean(item))
    ]).filter((item) => item.quantity > 0);

    if (drafts.length === 0) continue;

    const hash = sourceHash(drafts);
    const { data: existingListData } = await supabase
      .from("bring_lists")
      .select("id, auto_generated, source_hash, assigned_to, vehicle_id, status")
      .eq("company_id", context.companyId)
      .eq("job_id", jobsite.id)
      .eq("date", date)
      .maybeSingle();

    const existingList = existingListData as Pick<BringList, "id" | "auto_generated" | "source_hash" | "assigned_to" | "vehicle_id" | "status"> | null;
    let bringListId = existingList?.id ?? null;

    if (!bringListId) {
      const { data: createdList, error } = await supabase
        .from("bring_lists")
        .insert({
          company_id: context.companyId,
          job_id: jobsite.id,
          date,
          title: `Mitbringliste ${jobsite.name}`,
          notes: "Automatisch aus Auftrag, Materialplanung, Lager und Plantafel erstellt.",
          status: "ready",
          created_by: context.userId,
          assigned_to: assignedTo,
          vehicle_id: vehicleId,
          auto_generated: true,
          generation_source: "auto_next_day",
          last_auto_synced_at: new Date().toISOString(),
          source_hash: hash
        })
        .select("id")
        .single();

      if (error || !createdList) continue;
      bringListId = createdList.id as string;
      created += 1;
    } else if (existingList && (existingList.source_hash !== hash || !existingList.auto_generated || !existingList.vehicle_id)) {
      const { error } = await supabase
        .from("bring_lists")
        .update({
          auto_generated: true,
          generation_source: existingList.auto_generated ? "auto_next_day" : "manual_plus_auto_next_day",
          last_auto_synced_at: new Date().toISOString(),
          source_hash: hash,
          assigned_to: existingList.assigned_to ?? assignedTo,
          vehicle_id: existingList.vehicle_id ?? vehicleId
        })
        .eq("id", bringListId)
        .eq("company_id", context.companyId);

      if (!error) updated += 1;
    }

    const itemResult = await upsertAutomaticItems({
      supabase,
      companyId: context.companyId,
      bringListId,
      vehicleId: existingList?.vehicle_id ?? vehicleId,
      drafts
    });

    if (itemResult.inserted > 0 || itemResult.updated > 0) updated += 1;
    await checkBringListAvailability({ supabase, companyId: context.companyId, bringListId });
    checked += 1;
    listIds.push(bringListId);

    await logBringListSync({
      supabase,
      companyId: context.companyId,
      bringListId,
      actorId: context.userId,
      action: "auto_synced",
      newValues: {
        date,
        inserted: itemResult.inserted,
        updated: itemResult.updated,
        source_hash: hash
      }
    });
  }

  return { created, updated, checked, listIds };
}
