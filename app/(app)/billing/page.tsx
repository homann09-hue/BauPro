import { CheckCircle2, CreditCard, Crown, LockKeyhole, Sparkles, Users } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { createCheckoutSessionAction, createPortalSessionAction } from "@/lib/actions/billing-actions";
import { PLAN_LIMITS, getMonthlyAiUsage, getPlanLimits, isFeatureEnabled, type PlanId } from "@/lib/billing/plans";
import { requirePlatformAdmin } from "@/lib/auth";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, searchParamMessage } from "@/lib/utils";

type BillingCompany = {
  id: string;
  name: string;
  plan_id: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

const planOrder: PlanId[] = ["starter", "professional", "business"];

const featureText: Record<PlanId, string[]> = {
  starter: ["1 Nutzer", "Basis-Baustellen", "Material und Berichte ohne KI"],
  professional: ["Bis 10 Nutzer", "KI-Assistent", "Kundenportal", "PDF-Stundenzettel"],
  business: ["Unbegrenzte Nutzer", "Mehr KI-Kontingent", "Online-Preise", "Kundenportal und Exporte"]
};

function statusLabel(status?: string | null) {
  if (!status || status === "free") return "Kostenlos";
  if (status === "active") return "Aktiv";
  if (status === "trialing") return "Testphase";
  if (status === "past_due") return "Zahlung offen";
  if (status === "canceled") return "Gekuendigt";
  return status;
}

function envPriceConfigured(planId: PlanId, interval: "monthly" | "yearly") {
  if (planId === "starter") return Boolean(process.env.STRIPE_STARTER_MONTHLY_PRICE_ID);
  const prefix = `STRIPE_${planId.toUpperCase()}_${interval === "yearly" ? "YEARLY" : "MONTHLY"}_PRICE_ID`;
  return Boolean(process.env[prefix]);
}

export default async function BillingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requirePlatformAdmin();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const [companyResult, usersResult, aiUsage] = await Promise.all([
    supabase
      .from("companies")
      .select(
        "id, name, plan_id, stripe_customer_id, stripe_subscription_id, subscription_status, trial_ends_at, current_period_end"
      )
      .eq("id", context.companyId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("company_id", context.companyId)
      .eq("active", true),
    getMonthlyAiUsage(supabase, context.companyId).catch(() => 0)
  ]);

  const company = (companyResult.data ?? {
    id: context.companyId,
    name: context.companyName,
    plan_id: "starter",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    subscription_status: "free",
    trial_ends_at: null,
    current_period_end: null
  }) as BillingCompany;
  const currentPlan = getPlanLimits(company.plan_id);
  const userCount = usersResult.count ?? 0;
  const queryError = safeQueryErrorMessage(companyResult.error) || safeQueryErrorMessage(usersResult.error);

  return (
    <>
      <PageHeader
        title="Abo und Billing"
        description="Tarif, Nutzerlimit und KI-Kontingent für deine BauPro-Firma verwalten."
      />
      <MessageBox error={error || queryError} success={success} />

      <section className="surface-strong mb-5 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-5 sm:p-7">
            <div className="mb-3 inline-flex items-center gap-2 rounded-md bg-mint px-3 py-1.5 text-xs font-black text-moss">
              <Crown className="h-4 w-4" aria-hidden="true" />
              Aktueller Tarif
            </div>
            <h2 className="text-2xl font-black text-ink">{currentPlan.name}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Status: <span className="font-black text-ink">{statusLabel(company.subscription_status)}</span>
              {company.current_period_end ? ` · Zeitraum bis ${formatDate(company.current_period_end.slice(0, 10))}` : ""}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-line bg-white p-4">
                <Users className="mb-2 h-5 w-5 text-moss" aria-hidden="true" />
                <p className="meta-label">Nutzer</p>
                <p className="mt-1 text-xl font-black text-ink">
                  {userCount}/{currentPlan.maxUsers ?? "∞"}
                </p>
              </div>
              <div className="rounded-md border border-line bg-white p-4">
                <Sparkles className="mb-2 h-5 w-5 text-moss" aria-hidden="true" />
                <p className="meta-label">KI diesen Monat</p>
                <p className="mt-1 text-xl font-black text-ink">
                  {aiUsage}/{currentPlan.maxAiCallsPerMonth || 0}
                </p>
              </div>
              <div className="rounded-md border border-line bg-white p-4">
                <CreditCard className="mb-2 h-5 w-5 text-moss" aria-hidden="true" />
                <p className="meta-label">Preis</p>
                <p className="mt-1 text-xl font-black text-ink">{formatMoney(currentPlan.priceMonthlyEur)}/Monat</p>
              </div>
            </div>
          </div>
          <aside className="border-t border-line bg-fog p-5 sm:p-7 lg:border-l lg:border-t-0">
            <h3 className="font-black text-ink">Freigeschaltete Funktionen</h3>
            <div className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">
              {[
                ["KI", isFeatureEnabled(company, "ai")],
                ["Kundenportal", isFeatureEnabled(company, "customer_portal")],
                ["Stundenzettel", isFeatureEnabled(company, "time_reports")],
                ["Online-Preise", isFeatureEnabled(company, "online_prices")]
              ].map(([label, enabled]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                  <span>{label}</span>
                  {enabled ? (
                    <CheckCircle2 className="h-4 w-4 text-moss" aria-hidden="true" />
                  ) : (
                    <LockKeyhole className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
            {company.stripe_customer_id ? (
              <form action={createPortalSessionAction} className="mt-5">
                <button className="btn-secondary w-full" type="submit">
                  Abonnement verwalten
                </button>
              </form>
            ) : null}
          </aside>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {planOrder.map((planId) => {
          const plan = PLAN_LIMITS[planId];
          const isCurrent = currentPlan.id === plan.id;
          const monthlyConfigured = envPriceConfigured(planId, "monthly");
          const yearlyConfigured = envPriceConfigured(planId, "yearly");

          return (
            <article key={plan.id} className={`surface p-5 ${isCurrent ? "ring-2 ring-moss" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-ink">{plan.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {plan.maxUsers === null ? "Unbegrenzte Nutzer" : `${plan.maxUsers} Nutzer`}
                  </p>
                </div>
                {isCurrent ? <span className="rounded-md bg-mint px-2 py-1 text-xs font-black text-moss">Aktuell</span> : null}
              </div>

              <p className="mt-5 text-3xl font-black text-ink">
                {formatMoney(plan.priceMonthlyEur)}
                <span className="text-sm font-bold text-slate-500"> / Monat</span>
              </p>
              <p className="mt-2 text-sm text-slate-500">{plan.maxAiCallsPerMonth} KI-Aufrufe pro Monat</p>

              <div className="mt-5 space-y-2">
                {featureText[plan.id].map((feature) => (
                  <p key={feature} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="h-4 w-4 text-moss" aria-hidden="true" />
                    {feature}
                  </p>
                ))}
              </div>

              <div className="mt-6 grid gap-2">
                {isCurrent ? (
                  <button className="btn-secondary w-full" type="button" disabled>
                    Aktueller Tarif
                  </button>
                ) : (
                  <>
                    <form action={createCheckoutSessionAction.bind(null, plan.id, "monthly")}>
                      <button className="btn-primary w-full" type="submit" disabled={!monthlyConfigured}>
                        Monatlich wählen
                      </button>
                    </form>
                    <form action={createCheckoutSessionAction.bind(null, plan.id, "yearly")}>
                      <button className="btn-secondary w-full" type="submit" disabled={!yearlyConfigured}>
                        Jaehrlich wählen
                      </button>
                    </form>
                    {!monthlyConfigured && !yearlyConfigured ? (
                      <p className="text-xs font-semibold text-slate-500">
                        Stripe Price ID fehlt in den Umgebungsvariablen.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
