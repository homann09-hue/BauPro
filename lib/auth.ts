import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isManager } from "@/lib/utils";
import type { Profile } from "@/types/app";

export type AppContext = {
  userId: string;
  email: string | null;
  profile: Profile;
  companyId: string;
  companyName: string;
  canManage: boolean;
};

export async function getOptionalAppContext(): Promise<AppContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  let { data: profile, error } = await supabase
    .from("profiles")
    .select("*, companies(id, name)")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.rpc("bootstrap_my_profile");

    const retry = await supabase
      .from("profiles")
      .select("*, companies(id, name)")
      .eq("id", user.id)
      .maybeSingle();

    profile = retry.data;
    error = retry.error;
  }

  if (error || !profile) return null;

  const typedProfile = profile as Profile;
  const company = typedProfile.companies;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: typedProfile,
    companyId: typedProfile.company_id,
    companyName: company?.name ?? "Meine Firma",
    canManage: isManager(typedProfile.role)
  };
}

export async function requireAppContext() {
  const context = await getOptionalAppContext();

  if (!context) {
    redirect("/login");
  }

  return context;
}

export async function requireManager() {
  const context = await requireAppContext();

  if (!context.canManage) {
    redirect("/dashboard?error=Keine+Berechtigung");
  }

  return context;
}
