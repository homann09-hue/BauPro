import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { effectivePermissionKeys, hasAppPermission, type PermissionKey } from "@/lib/permissions";
import { canOperate, isAdmin, isChef, isManager } from "@/lib/utils";
import type { Company, Profile } from "@/types/app";

const PROFILE_SELECT_WITH_SESSION_TIMEOUT =
  "id, company_id, email, full_name, role, active, companies(id, name, session_timeout_minutes, onboarding_completed_at)";
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
    onboarding_completed_at: string | null;
  };
  companyId: string;
  companyName: string;
  canManage: boolean;
  canOperate: boolean;
  isAdmin: boolean;
  isChef: boolean;
  permissions: PermissionKey[];
  mfaEnabled: boolean;
};

export async function getOptionalAppContext(): Promise<AppContext | null> {
  const supabase = await createSupabaseServerClient();
  let companyExtendedFieldsAvailable = true;
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
    companyExtendedFieldsAvailable = false;
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
      companyExtendedFieldsAvailable = false;
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
  const onboardingCompletedAt = companyExtendedFieldsAvailable
    ? company?.onboarding_completed_at ?? null
    : "1970-01-01T00:00:00.000Z";
  let permissions: PermissionKey[] = effectivePermissionKeys(typedProfile.role, []);

  if (!isManager(typedProfile.role)) {
    const permissionsResult = await supabase
      .from("employee_permissions")
      .select("permission_key")
      .eq("company_id", typedProfile.company_id)
      .eq("profile_id", typedProfile.id)
      .eq("granted", true);

    if (!permissionsResult.error) {
      permissions = effectivePermissionKeys(
        typedProfile.role,
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
      session_timeout_minutes: Number.isFinite(sessionTimeoutMinutes) ? sessionTimeoutMinutes : 30,
      // Wenn die Onboarding-Spalte in einer alten DB noch fehlt, darf die App
      // nicht in eine Redirect-Schleife laufen. /debug/system zeigt den
      // Migrationsfehler separat an.
      onboarding_completed_at: onboardingCompletedAt
    },
    companyId: typedProfile.company_id,
    companyName,
    canManage: isManager(typedProfile.role),
    canOperate: canOperate(typedProfile.role),
    isAdmin: isAdmin(typedProfile.role),
    isChef: isChef(typedProfile.role),
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
