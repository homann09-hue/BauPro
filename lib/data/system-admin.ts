import { postgrestTimeoutResponse, withQueryTimeout } from "@/lib/performance/observability";
import { tryCreateScopedSupabaseAdminClient } from "@/lib/supabase/admin";

export type SystemAdminStats = {
  serviceRoleAvailable: boolean;
  companies: number;
  users: number;
  chefs: number;
  openAlerts: number;
  latestCompanies: Array<{ id: string; name: string; created_at?: string | null }>;
};

export async function loadSystemAdminStats(): Promise<SystemAdminStats> {
  const supabase = (() => {
    return tryCreateScopedSupabaseAdminClient({
      caller: "data.system-admin.loadSystemAdminStats",
      reason: "Systemadmin-Dashboard zeigt firmenuebergreifende Kennzahlen."
    });
  })();

  if (!supabase) {
    return {
      serviceRoleAvailable: false,
      companies: 0,
      users: 0,
      chefs: 0,
      openAlerts: 0,
      latestCompanies: []
    };
  }

  const [companiesResult, usersResult, chefsResult, alertsResult, latestCompaniesResult] = await Promise.all([
    withQueryTimeout(
      () => supabase.from("companies").select("id", { count: "exact", head: true }),
      {
        route: "system-admin",
        action: "companies.count",
        timeoutMs: 2_000,
        fallback: () => postgrestTimeoutResponse("Timeout bei companies.count")
      }
    ),
    withQueryTimeout(
      () => supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
      {
        route: "system-admin",
        action: "profiles.count",
        timeoutMs: 2_000,
        fallback: () => postgrestTimeoutResponse("Timeout bei profiles.count")
      }
    ),
    withQueryTimeout(
      () => supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true).eq("role", "chef"),
      {
        route: "system-admin",
        action: "profiles-chef.count",
        timeoutMs: 2_000,
        fallback: () => postgrestTimeoutResponse("Timeout bei profiles-chef.count")
      }
    ),
    withQueryTimeout(
      () => supabase.from("material_alerts").select("id", { count: "exact", head: true }).eq("status", "open"),
      {
        route: "system-admin",
        action: "alerts.count",
        timeoutMs: 2_000,
        fallback: () => postgrestTimeoutResponse("Timeout bei material_alerts.count")
      }
    ),
    withQueryTimeout(
      () => supabase.from("companies").select("id, name, created_at").order("created_at", { ascending: false }).limit(5),
      {
        route: "system-admin",
        action: "companies.latest",
        timeoutMs: 2_200,
        fallback: () => postgrestTimeoutResponse("Timeout bei companies.latest")
      }
    )
  ]);

  return {
    serviceRoleAvailable: true,
    companies: companiesResult.count ?? 0,
    users: usersResult.count ?? 0,
    chefs: chefsResult.count ?? 0,
    openAlerts: alertsResult.count ?? 0,
    latestCompanies: (latestCompaniesResult.data ?? []) as SystemAdminStats["latestCompanies"]
  };
}
