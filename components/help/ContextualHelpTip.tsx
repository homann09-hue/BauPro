import { Lightbulb, X } from "lucide-react";
import { dismissHelpTipAction } from "@/lib/actions/help-actions";
import { getOptionalAppContext } from "@/lib/auth";
import { canSeeHelpTip, helpTipByKey, type HelpFeatureKey } from "@/lib/help/help-content";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { postgrestTimeoutResponse, withQueryTimeout } from "@/lib/performance/observability";

export async function ContextualHelpTip({
  featureKey,
  returnTo
}: {
  featureKey: HelpFeatureKey;
  returnTo: string;
}) {
  const context = await getOptionalAppContext();
  if (!context) return null;

  const tip = helpTipByKey(featureKey);
  if (!tip || !canSeeHelpTip(context.profile.role, tip.audience)) return null;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await withQueryTimeout(
    () =>
      supabase
        .from("user_help_state")
        .select("dismissed_at")
        .eq("user_id", context.userId)
        .eq("company_id", context.companyId)
        .eq("feature_key", featureKey)
        .maybeSingle(),
    {
      route: "help-tip",
      action: `user-help-state.${featureKey}`,
      timeoutMs: 1_400,
      fallback: () => postgrestTimeoutResponse("Timeout bei User-Help-Status")
    }
  );

  if (error) return null;

  if ((data as { dismissed_at?: string | null } | null)?.dismissed_at) return null;

  return (
    <aside className="mb-4 rounded-lg border border-primary/20 bg-mint p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white">
          <Lightbulb className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="meta-label">Kurzer Tipp</p>
          <h2 className="mt-1 text-base font-black text-ink">{tip.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-700">{tip.body}</p>
        </div>
        <form action={dismissHelpTipAction}>
          <input type="hidden" name="feature_key" value={tip.featureKey} />
          <input type="hidden" name="return_to" value={returnTo} />
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md border border-primary/20 bg-white text-slate-600 hover:bg-fog"
            type="submit"
            aria-label="Tipp schließen"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </form>
      </div>
      <form action={dismissHelpTipAction} className="mt-3 flex justify-end">
        <input type="hidden" name="feature_key" value={tip.featureKey} />
        <input type="hidden" name="return_to" value={returnTo} />
        <button className="btn-primary min-h-10 px-4 py-2 text-sm" type="submit">
          Verstanden
        </button>
      </form>
    </aside>
  );
}
