import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getPlanLimits, isFeatureEnabled } from "@/lib/billing/plans";

const root = path.resolve(__dirname, "../..");

function source(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("Stripe billing", () => {
  it("defines BauPro plan limits", () => {
    expect(getPlanLimits("starter")).toMatchObject({
      name: "Starter",
      priceMonthlyEur: 0,
      maxUsers: 1,
      hasAiFeatures: false
    });
    expect(getPlanLimits("professional")).toMatchObject({
      priceMonthlyEur: 29,
      maxUsers: 10,
      hasAiFeatures: true,
      hasCustomerPortal: true,
      hasTimeReports: true
    });
    expect(getPlanLimits("business")).toMatchObject({
      priceMonthlyEur: 79,
      maxUsers: null,
      hasOnlinePrices: true
    });
  });

  it("keeps feature gates tied to active paid plans", () => {
    expect(isFeatureEnabled({ plan_id: "starter", subscription_status: "free" }, "ai")).toBe(false);
    expect(isFeatureEnabled({ plan_id: "professional", subscription_status: "active" }, "time_reports")).toBe(true);
    expect(isFeatureEnabled({ plan_id: "business", subscription_status: "active" }, "online_prices")).toBe(true);
    expect(isFeatureEnabled({ plan_id: "business", subscription_status: "past_due" }, "online_prices")).toBe(false);
  });

  it("adds the Stripe billing schema and idempotent webhook table", () => {
    const migration = source("supabase/migrations/20260619_stripe_billing.sql");
    const schema = source("supabase/schema.sql");

    for (const sql of [migration, schema]) {
      expect(sql).toContain("create table if not exists public.plans");
      expect(sql).toContain("stripe_customer_id");
      expect(sql).toContain("stripe_subscription_id");
      expect(sql).toContain("create table if not exists public.stripe_webhook_events");
      expect(sql).toContain("plans are publicly readable");
    }
  });

  it("wires checkout, portal and webhook processing through server-side Stripe only", () => {
    const stripe = source("lib/billing/stripe.ts");
    const actions = source("lib/actions/billing-actions.ts");
    const webhook = source("app/api/stripe/webhook/route.ts");
    const billingPage = source("app/(app)/billing/page.tsx");

    expect(stripe).toContain("process.env.STRIPE_SECRET_KEY");
    expect(stripe).toContain("constructWebhookEvent");
    expect(actions).toContain("requireManager");
    expect(actions).toContain("createCheckoutSession");
    expect(actions).toContain("createPortalSession");
    expect(webhook).toContain("checkout.session.completed");
    expect(webhook).toContain("customer.subscription.updated");
    expect(webhook).toContain("customer.subscription.deleted");
    expect(webhook).toContain("invoice.payment_failed");
    expect(webhook).toContain("stripe_webhook_events");
    expect(billingPage).toContain("Abonnement verwalten");
  });

  it("guards AI usage through billing limits before the in-memory rate limit", () => {
    const aiActions = source("lib/actions/ai-actions.ts");
    const plans = source("lib/billing/plans.ts");
    const checkIndex = aiActions.indexOf("await checkAiLimit(supabase, context.companyId)");
    const rateIndex = aiActions.indexOf("assertRateLimit(`ai:${feature}");

    expect(checkIndex).toBeGreaterThan(0);
    expect(rateIndex).toBeGreaterThan(checkIndex);
    expect(plans).toContain("isLocalBillingBypassEnabled");
    expect(plans).toContain('process.env.NODE_ENV === "development"');
    expect(plans).toContain("!process.env.STRIPE_SECRET_KEY");
  });

  it("documents all required Stripe environment variables", () => {
    const env = source(".env.example");

    for (const key of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "STRIPE_STARTER_MONTHLY_PRICE_ID",
      "STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID",
      "STRIPE_PROFESSIONAL_YEARLY_PRICE_ID",
      "STRIPE_BUSINESS_MONTHLY_PRICE_ID",
      "STRIPE_BUSINESS_YEARLY_PRICE_ID",
      "NEXT_PUBLIC_APP_URL"
    ]) {
      expect(env).toContain(`${key}=`);
    }
  });
});
