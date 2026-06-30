import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { effectivePermissionKeys, hasAppPermission, type PermissionKey } from "@/lib/permissions";
import { canOperate, isAdmin, isChef, isManager } from "@/lib/utils";
import { logServerWarning } from "@/lib/security/logging";
import { isQueryTimeoutError, withQueryTimeout } from "@/lib/performance/observability";
import type { Company, Profile } from "@/types/app";

const PROFILE_SELECT_WITH_SESSION_TIMEOUT =
  "id, company_id, email, full_name, role, active, companies(id, name, session_timeout_minutes, onboarding_completed_at)";
const PROFILE_SELECT_FALLBACK = "id, company_id, email, full_name, role, active, companies(id, name)";

const AUTH_QUERY_TIMEOUT_MS = 1_800;
const PROFILE_QUERY_TIMEOUT_MS = 2_600;
const PERMISSION_QUERY_TIMEOUT_MS = 2_400;
const MFA_QUERY_TIMEOUT_MS = 2_000;
const BOOTSTRAP_QUERY_TIMEOUT_MS = 3_000;

type ProfileWithCompany = Profile & {
  companies?: Company | null;
};

type QueryResult<TData = unknown, TError = { message?: string | null; code?: string | null }> = {
  data: TData | null;
  error: TError | null;
};

type PermissionRow = {
  permission_key?: string | null;
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

function getPermissionKeys(rows: PermissionRow[]) {
  return rows.map((row) => row.permission_key).filter((permission): permission is string => Boolean(permission));
}

async function safeGetUser() {
  const supabase = await createSupabaseServerClient();
  try {
    const result = await withQueryTimeout(
      () => supabase.auth.getUser(),
      { route: "auth", action: "auth.getUser", timeoutMs: AUTH_QUERY_TIMEOUT_MS, slowMs: 1_000 }
    );
    return { user: result.data.user, supabase, error: result.error };
  } catch (error) {
    if (!isQueryTimeoutError(error)) {
      logServerWarning("auth-context-user-fetch-failed", error, { route: "auth", action: "auth.getUser" });
    }
    return { user: null, supabase, error: error as Error | null };
  }
}

async function loadProfile(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, select: string) {
  return withQueryTimeout(
    () => supabase.from("profiles").select(select).eq("id", userId).maybeSingle(),
    { route: "auth", action: `profiles.fetch.${select.includes("onboarding_completed_at") ? "extended" : "fallback"}`, timeoutMs: PROFILE_QUERY_TIMEOUT_MS, slowMs: 1_000 }
  ) as Promise<QueryResult<ProfileWithCompany | null>>;
}

export async function getOptionalAppContext(): Promise<AppContext | null> {
  const { user, supabase } = await safeGetUser();

  if (!user) return null;

  let companyExtendedFieldsAvailable = true;
  const profileResult = await loadProfile(supabase, user.id, PROFILE_SELECT_WITH_SESSION_TIMEOUT).catch(() => ({
    data: null,
    error: { message: "profile-load-failed" } as { message?: string | null; code?: string | null }
  }));
  let profile = profileResult.data;
  let error = profileResult.error;

  if (!profile && error && isMissingSchemaError(error)) {
    companyExtendedFieldsAvailable = false;
    const fallbackResult = await loadProfile(supabase, user.id, PROFILE_SELECT_FALLBACK).catch(() => ({
      data: null,
      error: { message: "profile-fallback-failed" } as { message?: string | null; code?: string | null }
    }));
    profile = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (!profile) {
    try {
      await withQueryTimeout(
        () => supabase.rpc("bootstrap_my_profile"),
        { route: "auth", action: "bootstrap_my_profile", timeoutMs: BOOTSTRAP_QUERY_TIMEOUT_MS, slowMs: 1_300 }
      );

      const retryResult = await loadProfile(supabase, user.id, PROFILE_SELECT_WITH_SESSION_TIMEOUT);
      profile = retryResult.data;
      error = retryResult.error;
    } catch (bootstrapError) {
      logServerWarning("auth-context-bootstrap-failed", {
        route: "auth",
        action: "bootstrap_my_profile",
        errorMessage: bootstrapError instanceof Error ? bootstrapError.message : "bootstrap-failed"
      });
    }
  }

  if (!profile && error && isMissingSchemaError(error)) {
    const fallbackResult = await loadProfile(supabase, user.id, PROFILE_SELECT_FALLBACK);
    profile = fallbackResult.data;
    error = fallbackResult.error;
  }

  if (!profile || error) {
    return null;
  }

  const typedProfile = profile as unknown as ProfileWithCompany;
  const company = typedProfile.companies;
  const companyName = company?.name ?? "Meine Firma";
  const sessionTimeoutMinutes = Number(company?.session_timeout_minutes ?? 30);
  const onboardingCompletedAt = companyExtendedFieldsAvailable
    ? company?.onboarding_completed_at ?? null
    : "1970-01-01T00:00:00.000Z";
  let permissions: PermissionKey[] = effectivePermissionKeys(typedProfile.role, []);

  const [permissionsResult, factorsResult] = await Promise.allSettled([
    !isManager(typedProfile.role)
      ? withQueryTimeout(
          () =>
            supabase
              .from("employee_permissions")
              .select("permission_key")
              .eq("company_id", typedProfile.company_id)
              .eq("profile_id", typedProfile.id)
              .eq("granted", true),
          { route: "auth", action: "employee_permissions.fetch", timeoutMs: PERMISSION_QUERY_TIMEOUT_MS, slowMs: 1_100 }
        )
      : Promise.resolve({ data: [], error: null } as QueryResult<PermissionRow[]>),
    withQueryTimeout(() => supabase.auth.mfa.listFactors(), {
      route: "auth",
      action: "auth.mfa.listFactors",
      timeoutMs: MFA_QUERY_TIMEOUT_MS,
      slowMs: 900
    }).catch((error: Error) => ({ data: null, error }))
  ]);

  if (permissionsResult.status === "fulfilled" && !permissionsResult.value.error) {
    permissions = effectivePermissionKeys(typedProfile.role, getPermissionKeys((permissionsResult.value.data ?? []) as PermissionRow[]));
  } else {
    permissions = [];
  }

  let mfaEnabled = false;
  if (factorsResult.status === "fulfilled" && !factorsResult.value.error) {
    const factors = factorsResult.value as unknown as { data?: { totp?: unknown[] } };
    mfaEnabled = Array.isArray(factors.data?.totp) && factors.data.totp.length > 0;
  } else {
    logServerWarning("auth-context-mfa-timeout", {
      route: "auth",
      action: "auth.mfa.listFactors"
    });
  }

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

export async function hasActiveSession(): Promise<boolean> {
  const { user } = await safeGetUser();
  return Boolean(user);
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
