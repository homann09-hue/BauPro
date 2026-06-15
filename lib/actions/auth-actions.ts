"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAppContext, requireManager } from "@/lib/auth";
import { isUnsupportedVorarbeiterRoleError } from "@/lib/supabase/errors";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalString, requiredString } from "@/lib/utils";
import type { Role } from "@/types/app";

function toQuery(value: string) {
  return encodeURIComponent(value);
}

function normalizeRole(value: FormDataEntryValue | null): Role {
  const role = String(value ?? "mitarbeiter");
  return role === "admin" || role === "chef" || role === "vorarbeiter" || role === "mitarbeiter" ? role : "mitarbeiter";
}

export async function signInAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = requiredString(formData, "email");
  const password = requiredString(formData, "password");

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message = error.message.includes("Email not confirmed")
      ? "Bitte bestaetige zuerst deine E-Mail-Adresse."
      : error.message.includes("Invalid login credentials")
        ? "E-Mail oder Passwort stimmt nicht."
        : error.message;
    redirect(`/login?error=${toQuery(message)}`);
  }

  await supabase.rpc("bootstrap_my_profile");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile) {
    redirect(
      `/login?error=${toQuery("Login war erfolgreich, aber das Firmenprofil fehlt. Bitte supabase/schema.sql in Supabase ausfuehren und erneut einloggen.")}`
    );
  }

  redirect("/dashboard");
}

export async function signUpCompanyAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const origin = (await headers()).get("origin") ?? "";
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
    redirect(`/register?error=${toQuery(error.message)}`);
  }

  if (data.session) {
    redirect("/dashboard");
  }

  redirect(
    `/login?success=${toQuery("Account angelegt. Falls E-Mail-Bestaetigung aktiv ist, bestaetige bitte zuerst deine E-Mail.")}`
  );
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createEmployeeAction(formData: FormData) {
  const context = await requireManager();
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
    redirect(`/team?error=${toQuery(error?.message ?? "Mitarbeiter konnte nicht angelegt werden.")}`);
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
    redirect(`/team?error=${toQuery(profileResult.error.message)}`);
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
  const id = requiredString(formData, "id");
  const fullName = optionalString(formData, "full_name");
  const role = normalizeRole(formData.get("role"));
  const active = formData.get("active") === "on";

  if (id === context.userId && !active) {
    redirect(`/team?error=${toQuery("Du kannst deinen eigenen Zugang nicht deaktivieren.")}`);
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
    redirect(`/team?error=${toQuery(error.message)}`);
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
  const returnTo = String(formData.get("return_to") ?? "/profile");
  const fullName = requiredString(formData, "full_name");

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName })
    .eq("id", context.userId)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`${returnTo}?error=${toQuery(error.message)}`);
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  redirect(`${returnTo}?success=${toQuery("Profil wurde gespeichert.")}`);
}

export async function updateCompanyProfileAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const returnTo = String(formData.get("return_to") ?? "/settings");
  const name = requiredString(formData, "name");

  const { error } = await supabase.from("companies").update({ name }).eq("id", context.companyId);

  if (error) {
    redirect(`${returnTo}?error=${toQuery(error.message)}`);
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect(`${returnTo}?success=${toQuery("Firmenprofil wurde gespeichert.")}`);
}
