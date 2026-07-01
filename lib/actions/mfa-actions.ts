"use server";

import { createClient } from "@supabase/supabase-js";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requiredString } from "@/lib/utils";

export type MfaFactorSummary = {
  id: string;
  friendlyName: string | null;
  factorType: string;
  status: string;
  createdAt: string;
};

export type MfaEnrollmentResult =
  | {
      ok: true;
      factorId: string;
      otpauthUrl: string;
      qrCodeDataUrl: string;
      secret: string;
    }
  | {
      ok: false;
      error: string;
    };

function redirectBack(params: { error?: string; success?: string }): never {
  const key = params.error ? "error" : "success";
  const message = params.error ?? params.success ?? "";
  redirect(`/settings/security?${key}=${toQuery(message)}`);
}

function normalizeTotpCode(formData: FormData) {
  const code = requiredString(formData, "code").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(code)) throw new SafeActionError("Bitte einen 6-stelligen Code eingeben.");
  return code;
}

function mapFactor(factor: {
  id: string;
  friendly_name?: string;
  factor_type: string;
  status: string;
  created_at: string;
}): MfaFactorSummary {
  return {
    id: factor.id,
    friendlyName: factor.friendly_name ?? null,
    factorType: factor.factor_type,
    status: factor.status,
    createdAt: factor.created_at
  };
}

async function verifyPasswordWithoutPersistingSession(email: string, password: string) {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();
  if (!url || !publishableKey) return false;

  const authClient = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false
    }
  });

  const { error } = await authClient.auth.signInWithPassword({ email, password });
  await authClient.auth.signOut();
  return !error;
}

export async function listMfaFactorsAction(): Promise<MfaFactorSummary[]> {
  await requirePlatformAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.mfa.listFactors();

  if (error) return [];
  return (data.all ?? []).filter((factor) => factor.factor_type === "totp").map(mapFactor);
}

export async function enrollMfaAction(): Promise<MfaEnrollmentResult> {
  await requirePlatformAdmin();
  const supabase = await createSupabaseServerClient();
  const factors = await supabase.auth.mfa.listFactors();

  if (factors.data?.totp?.length) {
    return { ok: false, error: "2FA ist für diesen Account bereits aktiv." };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "BauPro Authenticator",
    issuer: "BauPro"
  });

  if (error || !data || data.type !== "totp") {
    return { ok: false, error: "2FA konnte nicht vorbereitet werden. Ist TOTP in Supabase Auth aktiviert?" };
  }

  const qrCodeDataUrl = await QRCode.toDataURL(data.totp.uri, {
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 7
  });

  return {
    ok: true,
    factorId: data.id,
    otpauthUrl: data.totp.uri,
    qrCodeDataUrl,
    secret: data.totp.secret
  };
}

export async function verifyMfaEnrollmentAction(formData: FormData) {
  await requirePlatformAdmin();
  const supabase = await createSupabaseServerClient();

  try {
    const factorId = requiredString(formData, "factor_id");
    const code = normalizeTotpCode(formData);
    const challenge = await supabase.auth.mfa.challenge({ factorId });

    if (challenge.error || !challenge.data) {
      throw new SafeActionError("2FA-Prüfung konnte nicht gestartet werden.");
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code
    });

    if (verify.error) {
      throw new SafeActionError("Der 2FA-Code stimmt nicht oder ist abgelaufen.");
    }
  } catch (error) {
    redirectBack({ error: safeErrorMessage(error, "2FA konnte nicht bestätigt werden.") });
  }

  revalidatePath("/settings/security");
  revalidatePath("/dashboard");
  redirectBack({ success: "2FA wurde aktiviert." });
}

export async function verifyLoginMfaChallengeAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Bitte+melde+dich+erneut+an.");
  }

  try {
    const factorId = requiredString(formData, "factor_id");
    const code = normalizeTotpCode(formData);
    const factors = await supabase.auth.mfa.listFactors();
    const factor = factors.data?.totp?.find((entry) => entry.id === factorId);
    if (factors.error || !factor) {
      throw new SafeActionError("2FA-Faktor wurde nicht gefunden.");
    }

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      throw new SafeActionError("2FA-Prüfung konnte nicht gestartet werden.");
    }

    const verify = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code
    });

    if (verify.error) {
      throw new SafeActionError("Der 2FA-Code stimmt nicht oder ist abgelaufen.");
    }
  } catch (error) {
    redirect(`/login/mfa-challenge?error=${toQuery(safeErrorMessage(error, "2FA-Code konnte nicht geprüft werden."))}`);
  }

  await supabase.rpc("bootstrap_my_profile");
  const {
    data: { user: verifiedUser }
  } = await supabase.auth.getUser();

  if (!verifiedUser) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("company_id, role").eq("id", verifiedUser.id).maybeSingle();
  if (profile?.role === "admin" || profile?.role === "chef") {
    const { data: company } = await supabase
      .from("companies")
      .select("onboarding_completed_at")
      .eq("id", profile.company_id)
      .maybeSingle();

    if (!company?.onboarding_completed_at) {
      redirect("/onboarding");
    }
  }

  redirect("/dashboard");
}

export async function unenrollMfaAction(formData: FormData) {
  await requirePlatformAdmin();
  const supabase = await createSupabaseServerClient();

  try {
    const factorId = requiredString(formData, "factor_id");
    const password = requiredString(formData, "password");
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user?.email) {
      throw new SafeActionError("Aktuelle Sitzung konnte nicht bestätigt werden.");
    }

    const passwordValid = await verifyPasswordWithoutPersistingSession(user.email, password);
    if (!passwordValid) {
      throw new SafeActionError("Passwort-Bestätigung fehlgeschlagen.");
    }

    const factors = await supabase.auth.mfa.listFactors();
    const factor = factors.data?.all?.find((entry) => entry.id === factorId && entry.factor_type === "totp");
    if (factors.error || !factor) {
      throw new SafeActionError("2FA-Faktor wurde nicht gefunden.");
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      throw new SafeActionError("2FA konnte nicht entfernt werden.");
    }
  } catch (error) {
    redirectBack({ error: safeErrorMessage(error, "2FA konnte nicht entfernt werden.") });
  }

  revalidatePath("/settings/security");
  revalidatePath("/dashboard");
  redirectBack({ success: "2FA wurde entfernt." });
}
