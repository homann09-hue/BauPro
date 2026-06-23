import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { checkRateLimit } from "@/lib/security/rate-limit";
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

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const message = error?.message.includes("Email not confirmed")
      ? "Bitte bestätige zuerst deine E-Mail-Adresse."
      : error?.message.includes("Invalid login credentials")
        ? "E-Mail oder Passwort stimmt nicht."
        : "Login fehlgeschlagen. Bitte prüfe E-Mail und Passwort.";
    return loginError(request, message, cookiesToSet);
  }

  await supabase.rpc("bootstrap_my_profile");

  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal.error && aal.data?.nextLevel === "aal2" && aal.data.currentLevel !== "aal2") {
    return redirectWithCookies(request, "/login/mfa-challenge", cookiesToSet);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return loginError(
      request,
      "Login war erfolgreich, aber das Firmenprofil fehlt. Bitte supabase/schema.sql in Supabase ausführen und erneut einloggen.",
      cookiesToSet
    );
  }

  const loginProfile = profile as unknown as LoginProfile;
  if (loginProfile.role === "admin" || loginProfile.role === "chef") {
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("onboarding_completed_at")
      .eq("id", loginProfile.company_id)
      .maybeSingle();

    if (!companyError && !company?.onboarding_completed_at) {
      return redirectWithCookies(request, "/onboarding", cookiesToSet);
    }

    if (companyError && !isMissingSchemaError(companyError)) {
      return loginError(request, "Login war erfolgreich, aber die Firmendaten konnten nicht geladen werden.", cookiesToSet);
    }
  }

  return redirectWithCookies(request, "/dashboard", cookiesToSet);
}
