import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { SafeActionError } from "@/lib/security/errors";
import { isMissingSchemaError } from "@/lib/supabase/errors";

export type PlanId = "starter" | "professional" | "business";
export type BillingFeature = "ai" | "customer_portal" | "time_reports" | "online_prices";

export type PlanLimits = {
  id: PlanId;
  name: string;
  priceMonthlyEur: number;
  maxUsers: number | null;
  maxAiCallsPerMonth: number;
  maxAiTokensPerMonth: number;
  hasAiFeatures: boolean;
  hasCustomerPortal: boolean;
  hasTimeReports: boolean;
  hasOnlinePrices: boolean;
};

export type BillingCompany = {
  plan_id?: string | null;
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  current_period_end?: string | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceMonthlyEur: 0,
    maxUsers: 1,
    maxAiCallsPerMonth: 0,
    maxAiTokensPerMonth: 0,
    hasAiFeatures: false,
    hasCustomerPortal: false,
    hasTimeReports: false,
    hasOnlinePrices: false
  },
  professional: {
    id: "professional",
    name: "Professional",
    priceMonthlyEur: 29,
    maxUsers: 10,
    maxAiCallsPerMonth: 250,
    maxAiTokensPerMonth: 500_000,
    hasAiFeatures: true,
    hasCustomerPortal: true,
    hasTimeReports: true,
    hasOnlinePrices: false
  },
  business: {
    id: "business",
    name: "Business",
    priceMonthlyEur: 79,
    maxUsers: null,
    maxAiCallsPerMonth: 1500,
    maxAiTokensPerMonth: 3_000_000,
    hasAiFeatures: true,
    hasCustomerPortal: true,
    hasTimeReports: true,
    hasOnlinePrices: true
  }
};

export function normalizePlanId(planId?: string | null): PlanId {
  return planId === "professional" || planId === "business" ? planId : "starter";
}

export function getPlanLimits(planId?: string | null) {
  return PLAN_LIMITS[normalizePlanId(planId)];
}

function hasBillableStatus(company: BillingCompany) {
  const status = company.subscription_status ?? "free";
  if (normalizePlanId(company.plan_id) === "starter") return true;
  return ["active", "trialing"].includes(status);
}

export function isLocalBillingBypassEnabled() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isLocalUrl = appUrl.includes("localhost") || appUrl.includes("127.0.0.1") || appUrl.includes("::1");

  return process.env.NODE_ENV === "development" && isLocalUrl && !process.env.STRIPE_SECRET_KEY?.trim();
}

async function loadCompanyPlan(supabase: SupabaseServerClient, companyId: string) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, plan_id, subscription_status, trial_ends_at, current_period_end")
    .eq("id", companyId)
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) return { plan_id: "starter", subscription_status: "free" };
    throw new SafeActionError("Abonnement konnte nicht geprueft werden.");
  }

  return (data ?? { plan_id: "starter", subscription_status: "free" }) as BillingCompany;
}

export async function getMonthlyAiUsage(supabase: SupabaseServerClient, companyId: string) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("status", "success")
    .gte("created_at", monthStart.toISOString());

  if (error) {
    if (isMissingSchemaError(error)) return 0;
    throw new SafeActionError("KI-Nutzung konnte nicht geprueft werden.");
  }

  return count ?? 0;
}

export async function getMonthlyAiTokenUsage(supabase: SupabaseServerClient, companyId: string) {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("ai_usage_logs")
    .select("input_tokens, output_tokens")
    .eq("company_id", companyId)
    .eq("status", "success")
    .gte("created_at", monthStart.toISOString());

  if (error) {
    if (isMissingSchemaError(error)) return 0;
    throw new SafeActionError("KI-Token-Nutzung konnte nicht geprueft werden.");
  }

  return (data ?? []).reduce((sum, row) => {
    const usageRow = row as { input_tokens?: number | null; output_tokens?: number | null };
    return sum + (usageRow.input_tokens ?? 0) + (usageRow.output_tokens ?? 0);
  }, 0);
}

export async function checkUserLimit(supabase: SupabaseServerClient, companyId: string) {
  const company = await loadCompanyPlan(supabase, companyId);
  const plan = getPlanLimits(company.plan_id);
  const { count, error } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("active", true);

  if (error) throw new SafeActionError("Mitarbeiterlimit konnte nicht geprueft werden.");

  const currentUsers = count ?? 0;
  const allowed = plan.maxUsers === null || currentUsers < plan.maxUsers;

  if (!allowed) {
    throw new SafeActionError("Nutzerlimit erreicht. Bitte Tarif upgraden oder Nutzer deaktivieren.");
  }

  return { allowed, currentUsers, maxUsers: plan.maxUsers, plan };
}

export async function checkAiLimit(supabase: SupabaseServerClient, companyId: string) {
  const company = await loadCompanyPlan(supabase, companyId);
  const plan = getPlanLimits(company.plan_id);
  const localBillingBypass = isLocalBillingBypassEnabled();

  if (!hasBillableStatus(company) || !plan.hasAiFeatures || plan.maxAiCallsPerMonth <= 0) {
    if (localBillingBypass) {
      const localPlan = PLAN_LIMITS.professional;
      const [used, usedTokens] = await Promise.all([getMonthlyAiUsage(supabase, companyId), getMonthlyAiTokenUsage(supabase, companyId)]);
      if (used >= localPlan.maxAiCallsPerMonth) {
        throw new SafeActionError("Lokales KI-Demo-Limit fuer diesen Monat erreicht.");
      }

      if (usedTokens >= localPlan.maxAiTokensPerMonth) {
        throw new SafeActionError("Lokales KI-Token-Limit fuer diesen Monat erreicht.");
      }

      return { allowed: true, used, limit: localPlan.maxAiCallsPerMonth, usedTokens, tokenLimit: localPlan.maxAiTokensPerMonth, plan: localPlan };
    }

    throw new SafeActionError("KI-Limit fuer diesen Monat erreicht. Upgrade auf Professional.");
  }

  const [used, usedTokens] = await Promise.all([getMonthlyAiUsage(supabase, companyId), getMonthlyAiTokenUsage(supabase, companyId)]);
  const allowed = used < plan.maxAiCallsPerMonth;

  if (!allowed) {
    throw new SafeActionError("KI-Limit fuer diesen Monat erreicht. Upgrade auf Professional.");
  }

  if (usedTokens >= plan.maxAiTokensPerMonth) {
    throw new SafeActionError("KI-Token-Limit für diesen Monat erreicht. Bitte später erneut versuchen oder Tarif prüfen.");
  }

  return { allowed, used, limit: plan.maxAiCallsPerMonth, usedTokens, tokenLimit: plan.maxAiTokensPerMonth, plan };
}

export function isFeatureEnabled(company: BillingCompany, feature: BillingFeature) {
  if (!hasBillableStatus(company)) return false;

  const plan = getPlanLimits(company.plan_id);
  if (feature === "ai") return plan.hasAiFeatures;
  if (feature === "customer_portal") return plan.hasCustomerPortal;
  if (feature === "time_reports") return plan.hasTimeReports;
  return plan.hasOnlinePrices;
}
