import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireManager } from "@/lib/auth";
import { contentHash, publicWorkOrderSnapshot } from "@/lib/customer-portal/tokens";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { createScopedSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkOrder } from "@/types/app";

const sendWorkOrderSelect =
  "id, company_id, customer_id, jobsite_id, order_id, title, description, scope_of_work, price_note, status, version, content_hash, sent_at, viewed_at, signed_at, rejected_at, signer_name, rejection_reason, created_by, created_at, updated_at";

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) throw new SafeActionError(`${label} fehlt.`);
  return value.trim();
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireManager();
    const payload = (await request.json()) as Record<string, unknown>;
    const orderId = requiredString(payload.orderId, "Auftrag");
    const workOrderId = requiredString(payload.workOrderId, "Arbeitsauftrag");
    const supabase = await createSupabaseServerClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, company_id, customer_id, jobsite_id")
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .single();

    if (orderError || !order) throw new SafeActionError("Auftrag wurde nicht gefunden.");

    const { data: workOrder, error: loadError } = await supabase
      .from("work_orders")
      .select(sendWorkOrderSelect)
      .eq("id", workOrderId)
      .eq("order_id", orderId)
      .eq("company_id", context.companyId)
      .single();

    if (loadError || !workOrder) throw new SafeActionError("Arbeitsauftrag wurde nicht gefunden.");
    const current = workOrder as unknown as WorkOrder;
    if (current.status !== "draft") throw new SafeActionError("Nur Entwürfe können an den Kunden gesendet werden.");

    const sentAt = new Date().toISOString();
    const sentSnapshot = publicWorkOrderSnapshot(current, { status: "sent", sent_at: sentAt });
    const hash = contentHash(sentSnapshot);

    const { data: sentWorkOrder, error } = await supabase
      .from("work_orders")
      .update({ status: "sent", sent_at: sentAt, content_hash: hash })
      .eq("id", workOrderId)
      .eq("company_id", context.companyId)
      .eq("order_id", orderId)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();

    if (error || !sentWorkOrder) throw new SafeActionError("Arbeitsauftrag konnte nicht gesendet werden.");

    const [eventResult, auditResult] = await Promise.allSettled([
      supabase.from("customer_portal_events").insert({
        company_id: context.companyId,
        customer_id: current.customer_id,
        jobsite_id: current.jobsite_id,
        event_type: "work_order",
        title: "Arbeitsauftrag zur Freigabe",
        body: current.title,
        visible_to_customer: true,
        created_by: context.userId
      }),
      createScopedSupabaseAdminClient({
        caller: "api.customer-portal.work-orders.send.audit",
        reason: "Audit-Log für gesendeten Arbeitsauftrag wird unabhängig von Nutzer-RLS geschrieben."
      }).from("company_audit_log").insert({
        company_id: context.companyId,
        actor_id: context.userId,
        entity_type: "work_order",
        entity_id: workOrderId,
        action: "send",
        old_values: { status: current.status },
        new_values: { status: "sent", content_hash: hash }
      })
    ]);

    if (eventResult.status === "rejected" || auditResult.status === "rejected") {
      console.warn("Arbeitsauftrag wurde gesendet, aber Begleitprotokolle konnten nicht vollständig geschrieben werden.");
    }

    revalidatePath(`/orders/${orderId}`);
    return NextResponse.json({ success: "Arbeitsauftrag ist jetzt im Kundenportal sichtbar." });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Arbeitsauftrag konnte nicht gesendet werden.") },
      { status: error instanceof SafeActionError ? 400 : 500 }
    );
  }
}
