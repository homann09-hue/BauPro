"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/auth";
import { helpTipByKey, type HelpFeatureKey } from "@/lib/help/help-content";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { safeReturnPath } from "@/lib/security/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function featureKeyFromForm(formData: FormData) {
  const featureKey = String(formData.get("feature_key") ?? "") as HelpFeatureKey;
  if (!helpTipByKey(featureKey)) throw new SafeActionError("Unbekannter Hinweis.");
  return featureKey;
}

export async function dismissHelpTipAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"));

  try {
    const featureKey = featureKeyFromForm(formData);
    const now = new Date().toISOString();
    const { error } = await supabase.from("user_help_state").upsert(
      {
        user_id: context.userId,
        company_id: context.companyId,
        feature_key: featureKey,
        first_seen_at: now,
        dismissed_at: now
      },
      { onConflict: "user_id,feature_key" }
    );

    if (error) throw new SafeActionError("Hinweis konnte nicht gespeichert werden. Ist die Help-Migration eingespielt?");
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Hinweis konnte nicht gespeichert werden."))}`);
  }

  revalidatePath(returnTo.split("?")[0] || "/dashboard");
  redirect(returnTo);
}

export async function showHelpTipAgainAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"));

  try {
    const featureKey = featureKeyFromForm(formData);
    await supabase
      .from("user_help_state")
      .update({ dismissed_at: null })
      .eq("user_id", context.userId)
      .eq("company_id", context.companyId)
      .eq("feature_key", featureKey);
  } catch (error) {
    redirect(`${returnTo}?error=${toQuery(safeErrorMessage(error, "Hinweis konnte nicht erneut aktiviert werden."))}`);
  }

  revalidatePath(returnTo.split("?")[0] || "/hilfe");
  redirect(`${returnTo}?success=${toQuery("Tipp wird wieder angezeigt.")}`);
}

export async function resetHelpTipsAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const returnTo = safeReturnPath(formData.get("return_to"));

  const { error } = await supabase.from("user_help_state").delete().eq("user_id", context.userId).eq("company_id", context.companyId);
  if (error) redirect(`${returnTo}?error=${toQuery("Tipps konnten nicht zurueckgesetzt werden.")}`);

  revalidatePath(returnTo.split("?")[0] || "/hilfe");
  redirect(`${returnTo}?success=${toQuery("Alle Tipps wurden zurueckgesetzt.")}`);
}
