import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { AuthError, PostgrestError } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isQueryTimeoutError, withQueryTimeout, withRouteTiming } from "@/lib/performance/observability";
import { logServerWarning } from "@/lib/security/logging";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";
import type { Role } from "@/types/app";

type LoginProfile = {
  id: string;
  company_id: string;
  role: Role;
};

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

const LOGIN_SIGNIN_TIMEOUT_MS = 10_000;
const LOGIN_BOOTSTRAP_TIMEOUT_MS = 4_000;
const LOGIN_AAL_TIMEOUT_MS = 2_000;
const LOGIN_PROFILE_TIMEOUT_MS = 2_500;
const LOGIN_COMPANY_TIMEOUT_MS = 2_000;

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

function redirectWithCookies(request: NextRequest, path: string, cookiesToSet: CookieToSet[]) {
  const response = NextResponse.redirect(new URL(path, request.url), { status: 303 });
  cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
  return response;
}

function loginError(request: NextRequest, message: string, cookiesToSet: CookieToSet[] = []) {
  return redirectWithCookies(request, `/login?error=${encodeMessage(message)}`, cookiesToSet);
}

function authTimeout(message: string) {
  return new AuthError(message, 504, "timeout");
}

function postgrestTimeout(message: string) {
  return {
    data: null,
    error: new PostgrestError({ message, details: "", hint: "", code: "timeout" }),
    count: null,
    status: 504,
    statusText: "Timeout",
    success: false as const
  };
}

function createAuthRouteClient(request: NextRequest, cookiesToSet: CookieToSet[]) {
  const url = getSupabaseUrl();
  const anonKey = getSupabasePublishableKey();

  if (!url || !anonKey) {
    throw new Error("Supabase Umgebungsvariablen fehlen.");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(newCookies) {
        cookiesToSet.push(...newCookies);
      }
    }
  });
}

export async function POST(request: NextRequest) {
  return withRouteTiming("api/auth/login", "POST", async () => {
    const cookiesToSet: CookieToSet[] = [];
    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return loginError(request, "Formular konnte nicht gelesen werden.");
    }

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      return loginError(request, "Bitte E-Mail und Passwort eingeben.");
    }

    try {
      await checkRateLimit(`login:${email}`, 10, 60_000);
    } catch {
      return loginError(request, "Zu viele Login-Versuche. Bitte kurz warten.");
    }

    let supabase: ReturnType<typeof createAuthRouteClient>;
    try {
      supabase = createAuthRouteClient(request, cookiesToSet);
    } catch {
      return loginError(request, "Supabase ist nicht konfiguriert.");
    }

    const { data, error } = await withQueryTimeout(
      () => supabase.auth.signInWithPassword({ email, password }),
      {
        route: "api/auth/login",
        action: "auth.signIn",
        timeoutMs: LOGIN_SIGNIN_TIMEOUT_MS,
        fallback: () => ({ data: { user: null, session: null }, error: authTimeout("Login Timeout") })
      }
    );

    if (error || !data.user) {
      const message = error?.message.includes("Email not confirmed")
        ? "Bitte bestätige zuerst deine E-Mail-Adresse."
        : error?.message.includes("Invalid login credentials")
          ? "E-Mail oder Passwort stimmt nicht."
          : "Login fehlgeschlagen. Bitte prüfe E-Mail und Passwort.";
      return loginError(request, message, cookiesToSet);
    }

    await withQueryTimeout(
      () => supabase.rpc("bootstrap_my_profile"),
      {
        route: "api/auth/login",
        action: "auth.bootstrap_my_profile",
        timeoutMs: LOGIN_BOOTSTRAP_TIMEOUT_MS,
        fallback: () => postgrestTimeout("Bootstrap Timeout")
      }
    ).catch((bootstrapError) => {
      if (isQueryTimeoutError(bootstrapError)) {
        logServerWarning("login-bootstrap-timeout", bootstrapError, {
          route: "api/auth/login",
          action: "auth.bootstrap_my_profile"
        });
      }
    });

    const aal = await withQueryTimeout(
      () => supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
      {
        route: "api/auth/login",
        action: "auth.mfa.getAuthenticatorAssuranceLevel",
        timeoutMs: LOGIN_AAL_TIMEOUT_MS,
        fallback: () => ({ data: null, error: authTimeout("MFA Timeout") })
      }
    );
    if (!aal.error && aal.data?.nextLevel === "aal2" && aal.data.currentLevel !== "aal2") {
      return redirectWithCookies(request, "/login/mfa-challenge", cookiesToSet);
    }

    const { data: profile, error: profileError } = await withQueryTimeout(
      () =>
        supabase
          .from("profiles")
          .select("id, company_id, role")
          .eq("id", data.user.id)
          .maybeSingle(),
      {
        route: "api/auth/login",
        action: "profiles.fetch",
        timeoutMs: LOGIN_PROFILE_TIMEOUT_MS,
        fallback: () => postgrestTimeout("Profile Timeout")
      }
    );

    if (profileError || !profile) {
      return loginError(
        request,
        "Login war erfolgreich, aber das Firmenprofil fehlt. Bitte supabase/schema.sql in Supabase ausführen und erneut einloggen.",
        cookiesToSet
      );
    }

    const loginProfile = profile as unknown as LoginProfile;
    if (loginProfile.role === "chef") {
      const { data: company, error: companyError } = await withQueryTimeout(
        () =>
          supabase
            .from("companies")
            .select("onboarding_completed_at")
            .eq("id", loginProfile.company_id)
            .maybeSingle(),
        {
          route: "api/auth/login",
          action: "companies.onboarding-state",
          timeoutMs: LOGIN_COMPANY_TIMEOUT_MS,
          fallback: () => postgrestTimeout("Company Timeout")
        }
      );

      if (!companyError && !company?.onboarding_completed_at) {
        return redirectWithCookies(request, "/onboarding", cookiesToSet);
      }

      if (companyError && !isMissingSchemaError(companyError)) {
        return loginError(request, "Login war erfolgreich, aber die Firmendaten konnten nicht geladen werden.", cookiesToSet);
      }
    }

    return redirectWithCookies(request, "/dashboard", cookiesToSet);
  });
}
