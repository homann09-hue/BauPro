import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireManager } from "@/lib/auth";
import { createCustomerPortalToken, customerPortalExpiresAt, hashCustomerPortalToken } from "@/lib/customer-portal/tokens";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { createScopedSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function requiredString(value: unknown, label: string, maxLength = 500) {
  if (typeof value !== "string" || !value.trim()) throw new SafeActionError(`${label} fehlt.`);
  const text = value.trim();
  if (text.length > maxLength) throw new SafeActionError(`${label} ist zu lang.`);
  return text;
}

function optionalString(value: unknown, maxLength = 500) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxLength) throw new SafeActionError("Eingabe ist zu lang.");
  return text;
}

function positiveDays(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 45;
  return Math.min(Math.max(Math.floor(parsed), 1), 180);
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireManager();
    await checkRateLimit(`customer-portal-link:${context.companyId}:${context.userId}`, 10, 60_000);

    const payload = (await request.json()) as Record<string, unknown>;
    const orderId = requiredString(payload.orderId, "Auftrag", 80);
    const supabase = await createSupabaseServerClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, company_id, customer_id, jobsite_id, order_number")
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .single();

    if (orderError || !order) throw new SafeActionError("Auftrag wurde nicht gefunden.");

    const token = createCustomerPortalToken();
    const label = optionalString(payload.label, 160) ?? `Kundenlink ${order.order_number}`;
    const expiresAt = customerPortalExpiresAt(positiveDays(payload.expiresDays));

    const { error, data } = await supabase
      .from("customer_portal_tokens")
      .insert({
        company_id: context.companyId,
        customer_id: order.customer_id,
        jobsite_id: order.jobsite_id,
        token_hash: hashCustomerPortalToken(token),
        label,
        expires_at: expiresAt,
        created_by: context.userId
      })
      .select("id")
      .single();

    if (error || !data) throw new SafeActionError("Kundenportal-Link konnte nicht erstellt werden.");

    const [eventResult, auditResult] = await Promise.allSettled([
      supabase.from("customer_portal_events").insert({
        company_id: context.companyId,
        customer_id: order.customer_id,
        jobsite_id: order.jobsite_id,
        event_type: "status",
        title: "Kundenportal freigeschaltet",
        body: "Der sichere Kundenbereich wurde für diesen Auftrag vorbereitet.",
        visible_to_customer: true,
        created_by: context.userId
      }),
      createScopedSupabaseAdminClient({
        caller: "api.customer-portal.links.create.audit",
        reason: "Audit-Log für Kundenportal-Link wird unabhängig von Nutzer-RLS geschrieben."
      }).from("company_audit_log").insert({
        company_id: context.companyId,
        actor_id: context.userId,
        entity_type: "customer_portal_token",
        entity_id: data.id,
        action: "create",
        new_values: { order_id: order.id, expires_at: expiresAt }
      })
    ]);

    if (eventResult.status === "rejected" || auditResult.status === "rejected") {
      console.warn("Kundenportal-Link wurde erstellt, aber Begleitprotokolle konnten nicht vollständig geschrieben werden.");
    }

    revalidatePath(`/orders/${orderId}`);
    return NextResponse.json({ success: "Kundenportal-Link wurde erstellt.", portalToken: token });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Kundenportal-Link konnte nicht erstellt werden.") },
      { status: error instanceof SafeActionError ? 400 : 500 }
    );
  }
}
