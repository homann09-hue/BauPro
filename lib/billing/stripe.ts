import Stripe from "stripe";
import { SafeActionError } from "@/lib/security/errors";
import { createScopedSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPlanLimits, normalizePlanId, type PlanId } from "@/lib/billing/plans";

export type BillingInterval = "monthly" | "yearly";

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new SafeActionError("Stripe ist serverseitig noch nicht konfiguriert.");
  return new Stripe(secretKey);
}

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

function priceIdFor(planId: string, interval: BillingInterval) {
  const normalized = normalizePlanId(planId);
  const envKey =
    normalized === "starter"
      ? "STRIPE_STARTER_MONTHLY_PRICE_ID"
      : `STRIPE_${normalized.toUpperCase()}_${interval === "yearly" ? "YEARLY" : "MONTHLY"}_PRICE_ID`;
  return process.env[envKey] || null;
}

async function loadCompany(companyId: string) {
  const supabase = createScopedSupabaseAdminClient({
    caller: "billing.stripe.loadCompany",
    reason: "Stripe braucht Firmen- und Customer-Daten serverseitig ohne Nutzer-RLS."
  });
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, contact_email, stripe_customer_id")
    .eq("id", companyId)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Firma wurde fuer Stripe nicht gefunden.");
  return data as { id: string; name: string; contact_email: string | null; stripe_customer_id: string | null };
}

export async function createStripeCustomer(companyId: string, email: string | null, companyName: string) {
  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: email || undefined,
    name: companyName,
    metadata: {
      company_id: companyId
    }
  });

  return customer.id;
}

export async function createCheckoutSession(
  companyId: string,
  planId: string,
  interval: BillingInterval,
  returnUrl: string
) {
  const normalizedPlan = normalizePlanId(planId);
  const priceId = priceIdFor(normalizedPlan, interval);
  if (!priceId) {
    throw new SafeActionError("Fuer diesen Tarif fehlt die Stripe Price ID in den Umgebungsvariablen.");
  }

  const stripe = getStripeClient();
  const supabase = createScopedSupabaseAdminClient({
    caller: "billing.stripe.createCheckoutSession",
    reason: "Stripe Customer-ID wird nach erfolgreicher Erstellung an der Firma gespeichert."
  });
  const company = await loadCompany(companyId);
  const customerId =
    company.stripe_customer_id ?? (await createStripeCustomer(companyId, company.contact_email, company.name));

  if (!company.stripe_customer_id) {
    await supabase.from("companies").update({ stripe_customer_id: customerId }).eq("id", companyId);
  }

  const successUrl = new URL(returnUrl || "/billing", appUrl());
  successUrl.searchParams.set("success", "Abonnement wurde vorbereitet.");
  const cancelUrl = new URL(returnUrl || "/billing", appUrl());
  cancelUrl.searchParams.set("error", "Checkout wurde abgebrochen.");

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: companyId,
    success_url: successUrl.toString(),
    cancel_url: cancelUrl.toString(),
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      company_id: companyId,
      plan_id: normalizedPlan,
      billing_interval: interval
    },
    subscription_data: {
      metadata: {
        company_id: companyId,
        plan_id: normalizedPlan,
        billing_interval: interval
      }
    },
    allow_promotion_codes: true
  });

  if (!session.url) throw new SafeActionError("Stripe Checkout konnte nicht gestartet werden.");
  return session.url;
}

export async function createPortalSession(stripeCustomerId: string, returnUrl: string) {
  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: new URL(returnUrl || "/billing", appUrl()).toString()
  });

  return session.url;
}

export function constructWebhookEvent(body: string, signature: string | null) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET fehlt.");
  if (!signature) throw new Error("Stripe-Signatur fehlt.");
  return getStripeClient().webhooks.constructEvent(body, signature, webhookSecret);
}

export function planIdFromPriceId(priceId?: string | null): PlanId {
  if (!priceId) return "starter";
  if (
    priceId === process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID ||
    priceId === process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID
  ) {
    return "business";
  }
  if (
    priceId === process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID ||
    priceId === process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID
  ) {
    return "professional";
  }
  if (priceId === process.env.STRIPE_STARTER_MONTHLY_PRICE_ID) return "starter";
  return "starter";
}

export function planName(planId: string) {
  return getPlanLimits(planId).name;
}
