"use server";

import { redirect } from "next/navigation";
import { createCheckoutSession, createPortalSession, type BillingInterval } from "@/lib/billing/stripe";
import { requirePlatformAdmin } from "@/lib/auth";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function billingReturnUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return new URL("/billing", appUrl).toString();
}

function normalizeInterval(interval: string): BillingInterval {
  return interval === "yearly" ? "yearly" : "monthly";
}

export async function createCheckoutSessionAction(planId: string, interval: string) {
  const context = await requirePlatformAdmin();
  let target = "/billing";

  try {
    const checkoutUrl = await createCheckoutSession(context.companyId, planId, normalizeInterval(interval), billingReturnUrl());
    target = checkoutUrl;
  } catch (error) {
    target = `/billing?error=${toQuery(safeErrorMessage(error, "Stripe Checkout konnte nicht gestartet werden."))}`;
  }

  redirect(target);
}

export async function createPortalSessionAction() {
  const context = await requirePlatformAdmin();
  const supabase = await createSupabaseServerClient();
  let target = "/billing";

  try {
    const { data, error } = await supabase
      .from("companies")
      .select("stripe_customer_id")
      .eq("id", context.companyId)
      .maybeSingle();

    if (error) throw new SafeActionError("Abonnement konnte nicht geladen werden.");
    if (!data?.stripe_customer_id) throw new SafeActionError("Noch kein Stripe-Kundenkonto vorhanden.");

    target = await createPortalSession(data.stripe_customer_id, billingReturnUrl());
  } catch (error) {
    target = `/billing?error=${toQuery(safeErrorMessage(error, "Stripe Portal konnte nicht geoeffnet werden."))}`;
  }

  redirect(target);
}
