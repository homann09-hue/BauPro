import { createSupabaseAdminClient } from "@/lib/supabase/server";

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
    try {
      return createSupabaseAdminClient();
    } catch {
      return null;
    }
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
    supabase.from("companies").select("id", { count: "exact", head: true }),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("active", true).eq("role", "chef"),
    supabase.from("material_alerts").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("companies").select("id, name, created_at").order("created_at", { ascending: false }).limit(5)
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
