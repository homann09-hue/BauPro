import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { allPermissionKeys, hasAppPermission, normalizePermissionKeys, type PermissionKey } from "@/lib/permissions";
import { canOperate, isManager } from "@/lib/utils";
import type { Company, Profile } from "@/types/app";

const PROFILE_SELECT_WITH_SESSION_TIMEOUT =
  "id, company_id, email, full_name, role, active, companies(id, name, session_timeout_minutes)";
const PROFILE_SELECT_FALLBACK = "id, company_id, email, full_name, role, active, companies(id, name)";

type ProfileWithCompany = Profile & {
  companies?: Company | null;
};

export type AppContext = {
  userId: string;
  email: string | null;
  profile: Profile;
  company: {
    id: string;
    name: string;
    session_timeout_minutes: number;
  };
  companyId: string;
  companyName: string;
  canManage: boolean;
  canOperate: boolean;
  permissions: PermissionKey[];
  mfaEnabled: boolean;
};

export async function getOptionalAppContext(): Promise<AppContext | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;

  const initialProfileResult = await supabase
    .from("profiles")
    .select(PROFILE_SELECT_WITH_SESSION_TIMEOUT)
    .eq("id", user.id)
    .maybeSingle();
  let profile: unknown = initialProfileResult.data;
  let error = initialProfileResult.error;

  if (!profile && error && isMissingSchemaError(error)) {
    const fallback = await supabase.from("profiles").select(PROFILE_SELECT_FALLBACK).eq("id", user.id).maybeSingle();
    profile = fallback.data;
    error = fallback.error;
  }

  if (!profile) {
    await supabase.rpc("bootstrap_my_profile");

    const retry = await supabase
      .from("profiles")
      .select(PROFILE_SELECT_WITH_SESSION_TIMEOUT)
      .eq("id", user.id)
      .maybeSingle();

    profile = retry.data;
    error = retry.error;

    if (!profile && error && isMissingSchemaError(error)) {
      const fallback = await supabase.from("profiles").select(PROFILE_SELECT_FALLBACK).eq("id", user.id).maybeSingle();
      profile = fallback.data;
      error = fallback.error;
    }
  }

  if (error || !profile) return null;

  const typedProfile = profile as unknown as ProfileWithCompany;
  const company = typedProfile.companies;
  const companyName = company?.name ?? "Meine Firma";
  const sessionTimeoutMinutes = Number(company?.session_timeout_minutes ?? 30);
  let permissions: PermissionKey[] = isManager(typedProfile.role) ? allPermissionKeys : [];

  if (!isManager(typedProfile.role)) {
    const permissionsResult = await supabase
      .from("employee_permissions")
      .select("permission_key")
      .eq("company_id", typedProfile.company_id)
      .eq("profile_id", typedProfile.id)
      .eq("granted", true);

    if (!permissionsResult.error) {
      permissions = normalizePermissionKeys(
        (permissionsResult.data ?? []).map((row) => String((row as { permission_key?: string }).permission_key ?? ""))
      );
    } else if (!isMissingSchemaError(permissionsResult.error)) {
      permissions = [];
    }
  }

  const factors = await supabase.auth.mfa.listFactors();
  const mfaEnabled = !factors.error && (factors.data?.totp?.length ?? 0) > 0;

  return {
    userId: user.id,
    email: user.email ?? null,
    profile: typedProfile,
    company: {
      id: typedProfile.company_id,
      name: companyName,
      session_timeout_minutes: Number.isFinite(sessionTimeoutMinutes) ? sessionTimeoutMinutes : 30
    },
    companyId: typedProfile.company_id,
    companyName,
    canManage: isManager(typedProfile.role),
    canOperate: canOperate(typedProfile.role),
    permissions,
    mfaEnabled
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

export async function requireAdmin() {
  const context = await requireAppContext();

  if (context.profile.role !== "admin") {
    redirect("/dashboard?error=Keine+Berechtigung");
  }

  return context;
}

export async function requirePermission(permission: PermissionKey, redirectTo = "/dashboard") {
  const context = await requireAppContext();

  if (!hasAppPermission(context.profile.role, context.permissions, permission)) {
    redirect(`${redirectTo}?error=Keine+Berechtigung`);
  }

  return context;
}

export async function requireAnyPermission(permissions: PermissionKey[], redirectTo = "/dashboard") {
  const context = await requireAppContext();

  if (!permissions.some((permission) => hasAppPermission(context.profile.role, context.permissions, permission))) {
    redirect(`${redirectTo}?error=Keine+Berechtigung`);
  }

  return context;
}
