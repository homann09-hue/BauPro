"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAppContext, requireManager } from "@/lib/auth";
import { checkUserLimit } from "@/lib/billing/plans";
import { ensureDemoModeData } from "@/lib/demo/demo-mode";
import { requiredFormUuid } from "@/lib/security/form-data";
import { safeErrorMessage } from "@/lib/security/errors";
import { getClientIp, publicAppOrigin } from "@/lib/security/origin";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { safeReturnPath } from "@/lib/security/redirects";
import { isMissingSchemaError, isUnsupportedVorarbeiterRoleError } from "@/lib/supabase/errors";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString, requiredString } from "@/lib/utils";
import type { Role } from "@/types/app";

type LoginProfile = {
  id: string;
  company_id: string;
  role: Role;
};

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function normalizeRole(value: FormDataEntryValue | null): Role {
  const role = String(value ?? "mitarbeiter");
  return role === "admin" || role === "chef" || role === "vorarbeiter" || role === "mitarbeiter" || role === "kunde"
    ? role
    : "mitarbeiter";
}

function sessionTimeoutMinutesFromForm(formData: FormData) {
  const raw = String(formData.get("session_timeout_minutes") ?? "30").trim();
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1440 ? parsed : null;
}

function rateLimitKeyPart(value: string | null | undefined) {
  return (value || "unknown").replace(/[^a-zA-Z0-9:._-]/g, "_").slice(0, 96) || "unknown";
}

function demoStartRateLimitKey(requestHeaders: Headers) {
  const clientIp = getClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent");

  // Demo-Starts werden pro Browser/IP gedrosselt. Ein globaler Key sperrt sonst
  // lokale Tests oder mehrere Interessenten gegenseitig aus.
  return `demo:start:${rateLimitKeyPart(clientIp)}:${rateLimitKeyPart(userAgent)}`;
}

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = requiredString(formData, "email");
  const password = requiredString(formData, "password");

  try {
    assertRateLimit(`login:${email.toLowerCase()}`, 10, 60_000);
  } catch {
    redirect(`/login?error=${toQuery("Zu viele Login-Versuche. Bitte kurz warten.")}`);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = error.message.includes("Email not confirmed")
      ? "Bitte bestaetige zuerst deine E-Mail-Adresse."
      : error.message.includes("Invalid login credentials")
        ? "E-Mail oder Passwort stimmt nicht."
        : "Login fehlgeschlagen. Bitte pruefe E-Mail und Passwort.";
    redirect(`/login?error=${toQuery(message)}`);
  }

  await supabase.rpc("bootstrap_my_profile");

  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal.error && aal.data?.nextLevel === "aal2" && aal.data.currentLevel !== "aal2") {
    redirect("/login/mfa-challenge");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, company_id, role")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    redirect(
      `/login?error=${toQuery("Login war erfolgreich, aber das Firmenprofil fehlt. Bitte supabase/schema.sql in Supabase ausfuehren und erneut einloggen.")}`
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
      redirect("/onboarding");
    }

    if (companyError && !isMissingSchemaError(companyError)) {
      redirect(
        `/login?error=${toQuery("Login war erfolgreich, aber die Firmendaten konnten nicht geladen werden.")}`
      );
    }
  }

  redirect("/dashboard");
}

export async function startDemoModeAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const errorPath = safeReturnPath(formData.get("return_to"), "/demo");
  const requestHeaders = await headers();

  if (process.env.NODE_ENV === "production") {
    try {
      assertRateLimit(demoStartRateLimitKey(requestHeaders), 30, 60_000);
    } catch (error) {
      const message = safeErrorMessage(error, "Demo-Schutz konnte nicht geprueft werden.");
      console.warn("Demo-Rate-Limit wurde fuer diesen Start uebersprungen.", message);
    }
  }

  let demo: Awaited<ReturnType<typeof ensureDemoModeData>>;
  try {
    demo = await ensureDemoModeData();
  } catch (error) {
    console.error("Demo-Modus konnte nicht vorbereitet werden", error);
    redirect(`${errorPath}?error=${toQuery(safeErrorMessage(error, "Demo-Modus konnte nicht vorbereitet werden."))}`);
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: demo.chefEmail,
    password: demo.password
  });

  if (error || !data.user) {
    redirect(`${errorPath}?error=${toQuery("Demo-Login konnte nicht gestartet werden.")}`);
  }

  await supabase.rpc("bootstrap_my_profile");
  revalidatePath("/dashboard");
  redirect("/demo-tour?success=Demo-Modus gestartet. Folge den Karten von oben nach unten.");
}

export async function signUpCompanyAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const origin = publicAppOrigin((await headers()).get("origin"));
  const companyName = requiredString(formData, "company_name");
  const fullName = requiredString(formData, "full_name");
  const email = requiredString(formData, "email");
  const password = requiredString(formData, "password");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        company_name: companyName,
        full_name: fullName,
        role: "admin"
      }
    }
  });

  if (error) {
    redirect(`/register?error=${toQuery("Registrierung konnte nicht abgeschlossen werden.")}`);
  }

  if (data.session) {
    redirect("/onboarding");
  }

  redirect(
    `/login?success=${toQuery("Account angelegt. Falls E-Mail-Bestaetigung aktiv ist, bestaetige bitte zuerst deine E-Mail.")}`
  );
}

export async function signOutAction(formData?: FormData) {
  const supabase = await createSupabaseServerClient();
  const reason = formData?.get("reason") === "inactivity" ? "inactivity" : "manual";
  await supabase.auth.signOut();
  if (reason === "inactivity") {
    redirect(`/login?success=${toQuery("Du wurdest wegen Inaktivität abgemeldet.")}`);
  }
  redirect("/login");
}

export async function createEmployeeAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    redirect(`/team?error=${toQuery("SUPABASE_SERVICE_ROLE_KEY fehlt fuer das Anlegen von Mitarbeitern.")}`);
  }

  const email = requiredString(formData, "email");
  const password = requiredString(formData, "password");
  const fullName = requiredString(formData, "full_name");
  const role = normalizeRole(formData.get("role"));

  try {
    await checkUserLimit(supabase, context.companyId);
  } catch (error) {
    redirect(`/team?error=${toQuery(safeErrorMessage(error, "Nutzerlimit konnte nicht geprueft werden."))}`);
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      company_id: context.companyId,
      full_name: fullName,
      role
    }
  });

  if (error || !data.user) {
    redirect(`/team?error=${toQuery("Mitarbeiter konnte nicht angelegt werden.")}`);
  }

  let finalRole = role;
  let profileResult = await admin.from("profiles").upsert({
    id: data.user.id,
    company_id: context.companyId,
    email,
    full_name: fullName,
    role: finalRole,
    active: true
  });

  if (profileResult.error && role === "vorarbeiter" && isUnsupportedVorarbeiterRoleError(profileResult.error)) {
    finalRole = "mitarbeiter";
    await admin.auth.admin.updateUserById(data.user.id, {
      user_metadata: {
        company_id: context.companyId,
        full_name: fullName,
        role: finalRole
      }
    });
    profileResult = await admin.from("profiles").upsert({
      id: data.user.id,
      company_id: context.companyId,
      email,
      full_name: fullName,
      role: finalRole,
      active: true
    });
  }

  if (profileResult.error) {
    redirect(`/team?error=${toQuery("Mitarbeiterprofil konnte nicht gespeichert werden.")}`);
  }

  revalidatePath("/team");
  const success =
    finalRole === role
      ? "Mitarbeiter wurde angelegt."
      : "Mitarbeiter wurde angelegt. Hinweis: Vorarbeiter-Rolle ist erst nach der Rollen-Migration verfuegbar.";
  redirect(`/team?success=${toQuery(success)}`);
}

export async function updateEmployeeAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const id = requiredFormUuid(formData, "id", "Mitarbeiter");
  const fullName = optionalString(formData, "full_name");
  const role = normalizeRole(formData.get("role"));
  const active = formData.get("active") === "on";

  if (id === context.userId && !active) {
    redirect(`/team?error=${toQuery("Du kannst deinen eigenen Zugang nicht deaktivieren.")}`);
  }

  if (role === "admin" && context.profile.role !== "admin") {
    redirect(`/team?error=${toQuery("Nur Admins koennen andere Nutzer zu Admin befoerdern.")}`);
  }

  let finalRole = role;
  let { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, role: finalRole, active })
    .eq("id", id)
    .eq("company_id", context.companyId);

  if (error && role === "vorarbeiter" && isUnsupportedVorarbeiterRoleError(error)) {
    finalRole = "mitarbeiter";
    const fallback = await supabase
      .from("profiles")
      .update({ full_name: fullName, role: finalRole, active })
      .eq("id", id)
      .eq("company_id", context.companyId);
    error = fallback.error;
  }

  if (error) {
    redirect(`/team?error=${toQuery("Mitarbeiter konnte nicht aktualisiert werden.")}`);
  }

  revalidatePath("/team");
  const success =
    finalRole === role
      ? "Mitarbeiter wurde aktualisiert."
      : "Mitarbeiter wurde aktualisiert. Hinweis: Vorarbeiter-Rolle ist erst nach der Rollen-Migration verfuegbar.";
  redirect(`/team?success=${toQuery(success)}`);
}

export async function updateOwnProfileAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"), "/profile");
  const fullName = requiredString(formData, "full_name");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", context.userId)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`${returnTo}?error=${toQuery("Profil konnte nicht gespeichert werden.")}`);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect(`${returnTo}?success=${toQuery("Profil wurde gespeichert.")}`);
}

export async function updateCompanyProfileAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"), "/settings");
  const name = requiredString(formData, "name");
  const sessionTimeoutMinutes = sessionTimeoutMinutesFromForm(formData);

  if (sessionTimeoutMinutes === null) {
    redirect(`${returnTo}?error=${toQuery("Automatische Abmeldung muss zwischen 0 und 1440 Minuten liegen.")}`);
  }

  const { data, error } = await supabase
    .from("companies")
    .update({ name, session_timeout_minutes: sessionTimeoutMinutes })
    .eq("id", context.companyId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(
      `${returnTo}?error=${toQuery(
        isMissingSchemaError(error)
          ? "Datenbank-Update fehlt: Bitte supabase/migrations/20260623_session_timeout_setting.sql ausfuehren."
          : "Firmenprofil konnte nicht gespeichert werden."
      )}`
    );
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect(`${returnTo}?success=${toQuery("Firmenprofil wurde gespeichert.")}`);
}
