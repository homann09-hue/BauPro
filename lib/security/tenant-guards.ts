import type { AppContext } from "@/lib/auth";
import { SafeActionError } from "@/lib/security/errors";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Role } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export async function assertProfilesInCompany({
  supabase,
  companyId,
  profileIds,
  allowedRoles
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  profileIds: string[];
  allowedRoles?: Role[];
}) {
  const ids = Array.from(new Set(profileIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, active")
    .eq("company_id", companyId)
    .in("id", ids);

  if (error) throw new SafeActionError("Mitarbeiter konnten nicht geprueft werden.");

  const rows = (data ?? []) as Array<{ id: string; role: Role; active: boolean }>;
  const allowed = rows.filter((row) => row.active && (!allowedRoles || allowedRoles.includes(row.role)));
  if (allowed.length !== ids.length) {
    throw new SafeActionError("Mindestens ein Mitarbeiter gehoert nicht zu deiner Firma oder hat keine passende Rolle.");
  }

  return allowed.map((row) => row.id);
}

export async function assertJobsiteInCompany({
  supabase,
  context,
  jobsiteId
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  jobsiteId: string | null;
}) {
  if (!jobsiteId) return null;

  const { data, error } = await supabase
    .from("jobsites")
    .select("id, assigned_employee_ids")
    .eq("id", jobsiteId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Baustelle wurde nicht gefunden.");

  const assigned = ((data as { assigned_employee_ids?: string[] }).assigned_employee_ids ?? []) as string[];
  if (!context.canManage && !assigned.includes(context.userId)) {
    throw new SafeActionError("Keine Berechtigung fuer diese Baustelle.");
  }

  return data;
}

export async function assertVehicleInCompany({
  supabase,
  companyId,
  vehicleId
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  vehicleId: string | null;
}) {
  if (!vehicleId) return null;

  const { data, error } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("company_id", companyId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Fahrzeug wurde nicht gefunden.");
  return data;
}

export async function assertSupplierInCompany({
  supabase,
  companyId,
  supplierId
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  supplierId: string | null;
}) {
  if (!supplierId) return null;

  const { data, error } = await supabase
    .from("suppliers")
    .select("id")
    .eq("id", supplierId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Lieferant wurde nicht gefunden.");
  return data;
}

export async function assertInventoryItemInCompany({
  supabase,
  companyId,
  itemId
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  itemId: string | null;
}) {
  if (!itemId) return null;

  const { data, error } = await supabase
    .from("inventory_items")
    .select("id")
    .eq("id", itemId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Material wurde nicht gefunden.");
  return data;
}

export async function assertSupplierIntegrationInCompany({
  supabase,
  companyId,
  integrationId
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  integrationId: string | null;
}) {
  if (!integrationId) return null;

  const { data, error } = await supabase
    .from("supplier_integrations")
    .select("id")
    .eq("id", integrationId)
    .eq("company_id", companyId)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Lieferantenintegration wurde nicht gefunden.");
  return data;
}

export async function assertBringListAccess({
  supabase,
  context,
  bringListId
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  bringListId: string;
}) {
  const { data, error } = await supabase
    .from("bring_lists")
    .select("id, job_id, assigned_to, created_by, jobsites(assigned_employee_ids)")
    .eq("id", bringListId)
    .eq("company_id", context.companyId)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Mitbringliste wurde nicht gefunden.");

  const list = data as {
    id: string;
    job_id: string | null;
    assigned_to: string | null;
    created_by: string | null;
    jobsites?: { assigned_employee_ids?: string[] } | null;
  };
  const assignedEmployees = list.jobsites?.assigned_employee_ids ?? [];
  const allowed =
    context.canManage ||
    list.assigned_to === context.userId ||
    list.created_by === context.userId ||
    assignedEmployees.includes(context.userId);

  if (!allowed) throw new SafeActionError("Keine Berechtigung fuer diese Mitbringliste.");
  return list;
}
