import { NextResponse } from "next/server";
import {
  constructWebhookEvent,
  getStripeClient,
  planIdFromPriceId
} from "@/lib/billing/stripe";
import { normalizePlanId } from "@/lib/billing/plans";
import { logServerError } from "@/lib/security/logging";
import { createScopedSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function isoFromUnix(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function stripeId(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function subscriptionPeriodEnd(subscription: Record<string, unknown>) {
  const direct = isoFromUnix(subscription.current_period_end);
  if (direct) return direct;

  const items = subscription.items as { data?: Array<Record<string, unknown>> } | undefined;
  return isoFromUnix(items?.data?.[0]?.current_period_end);
}

function subscriptionPriceId(subscription: Record<string, unknown>) {
  const items = subscription.items as { data?: Array<{ price?: { id?: string | null } | null }> } | undefined;
  return items?.data?.[0]?.price?.id ?? null;
}

function stripeWebhookAdminClient(caller: string) {
  return createScopedSupabaseAdminClient({
    caller,
    reason: "Stripe Webhooks laufen ohne eingeloggten Nutzer und muessen Abonnementdaten synchronisieren."
  });
}

async function markProcessed(eventId: string) {
  const supabase = stripeWebhookAdminClient("stripe.webhook.markProcessed");
  await supabase.from("stripe_webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", eventId);
}

async function rememberEvent(event: { id: string; type: string }) {
  const supabase = stripeWebhookAdminClient("stripe.webhook.rememberEvent");
  const { error } = await supabase.from("stripe_webhook_events").insert({
    id: event.id,
    event_type: event.type,
    payload: JSON.parse(JSON.stringify(event))
  });

  if (!error) return { shouldProcess: true };

  if (error.code !== "23505") throw error;

  const { data } = await supabase
    .from("stripe_webhook_events")
    .select("processed_at")
    .eq("id", event.id)
    .maybeSingle();

  return { shouldProcess: !data?.processed_at };
}

async function updateCompanyFromSubscription(subscription: Record<string, unknown>, fallbackPlanId?: string | null) {
  const supabase = stripeWebhookAdminClient("stripe.webhook.updateCompanyFromSubscription");
  const metadata = (subscription.metadata ?? {}) as Record<string, string | undefined>;
  const companyId = metadata.company_id ?? null;
  const customerId = stripeId(subscription.customer);
  const subscriptionId = stripeId(subscription);
  const pricePlanId = planIdFromPriceId(subscriptionPriceId(subscription));
  const planId = normalizePlanId(metadata.plan_id ?? fallbackPlanId ?? pricePlanId);
  const status = typeof subscription.status === "string" ? subscription.status : "active";
  const currentPeriodEnd = subscriptionPeriodEnd(subscription);
  const trialEndsAt = isoFromUnix(subscription.trial_end);

  let query = supabase.from("companies").update({
    plan_id: status === "canceled" ? "starter" : planId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscriptionId,
    subscription_status: status,
    trial_ends_at: trialEndsAt,
    current_period_end: currentPeriodEnd
  });

  if (companyId) {
    query = query.eq("id", companyId);
  } else if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    return;
  }

  await query;
}

async function handleCheckoutCompleted(session: Record<string, unknown>) {
  const stripe = getStripeClient();
  const supabase = stripeWebhookAdminClient("stripe.webhook.handleCheckoutCompleted");
  const metadata = (session.metadata ?? {}) as Record<string, string | undefined>;
  const companyId = metadata.company_id ?? (typeof session.client_reference_id === "string" ? session.client_reference_id : null);
  const planId = normalizePlanId(metadata.plan_id);
  const customerId = stripeId(session.customer);
  const subscriptionId = stripeId(session.subscription);

  if (!companyId) return;

  if (subscriptionId) {
    const subscription = (await stripe.subscriptions.retrieve(subscriptionId)) as unknown as Record<string, unknown>;
    await updateCompanyFromSubscription(subscription, planId);
    return;
  }

  await supabase
    .from("companies")
    .update({
      plan_id: planId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      subscription_status: "active"
    })
    .eq("id", companyId);
}

async function handleSubscriptionDeleted(subscription: Record<string, unknown>) {
  const supabase = stripeWebhookAdminClient("stripe.webhook.handleSubscriptionDeleted");
  const metadata = (subscription.metadata ?? {}) as Record<string, string | undefined>;
  const companyId = metadata.company_id ?? null;
  const subscriptionId = stripeId(subscription);
  const customerId = stripeId(subscription.customer);

  let query = supabase.from("companies").update({
    plan_id: "starter",
    subscription_status: "canceled",
    stripe_subscription_id: subscriptionId,
    stripe_customer_id: customerId,
    current_period_end: subscriptionPeriodEnd(subscription)
  });

  if (companyId) {
    query = query.eq("id", companyId);
  } else if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    return;
  }

  await query;
}

async function handleInvoicePaymentFailed(invoice: Record<string, unknown>) {
  const supabase = stripeWebhookAdminClient("stripe.webhook.handleInvoicePaymentFailed");
  const subscriptionId =
    stripeId(invoice.subscription) ??
    stripeId((invoice.parent as { subscription_details?: { subscription?: unknown } } | undefined)?.subscription_details?.subscription);
  const customerId = stripeId(invoice.customer);

  let query = supabase.from("companies").update({ subscription_status: "past_due" });
  if (subscriptionId) {
    query = query.eq("stripe_subscription_id", subscriptionId);
  } else if (customerId) {
    query = query.eq("stripe_customer_id", customerId);
  } else {
    return;
  }

  await query;
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = constructWebhookEvent(body, signature);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  try {
    const { shouldProcess } = await rememberEvent(event);
    if (!shouldProcess) return NextResponse.json({ received: true, duplicate: true });

    const payload = event.data.object as unknown as Record<string, unknown>;
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(payload);
    } else if (event.type === "customer.subscription.updated") {
      await updateCompanyFromSubscription(payload);
    } else if (event.type === "customer.subscription.deleted") {
      await handleSubscriptionDeleted(payload);
    } else if (event.type === "invoice.payment_failed") {
      await handleInvoicePaymentFailed(payload);
    }

    await markProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    logServerError("stripe-webhook-processing-failed", error);
    return NextResponse.json({ error: "Webhook konnte nicht verarbeitet werden." }, { status: 500 });
  }
}
