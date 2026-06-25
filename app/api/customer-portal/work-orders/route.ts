import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { requireManager } from "@/lib/auth";
import { contentHash } from "@/lib/customer-portal/tokens";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";

function requiredString(value: unknown, label: string, maxLength = 5000) {
  if (typeof value !== "string" || !value.trim()) throw new SafeActionError(`${label} fehlt.`);
  const text = value.trim();
  if (text.length > maxLength) throw new SafeActionError(`${label} ist zu lang.`);
  return text;
}

function optionalString(value: unknown, maxLength = 5000) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxLength) throw new SafeActionError("Eingabe ist zu lang.");
  return text;
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireManager();
    const payload = (await request.json()) as Record<string, unknown>;
    const orderId = requiredString(payload.orderId, "Auftrag", 80);
    const title = requiredString(payload.title, "Titel", 160);
    const description = optionalString(payload.description, 500);
    const scopeOfWork = requiredString(payload.scopeOfWork, "Leistungsbeschreibung", 8000);
    const priceNote = optionalString(payload.priceNote, 500);
    const supabase = await createSupabaseServerClient();

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id, company_id, customer_id, jobsite_id")
      .eq("id", orderId)
      .eq("company_id", context.companyId)
      .single();

    if (orderError || !order) throw new SafeActionError("Auftrag wurde nicht gefunden.");

    const initialSnapshot = {
      order_id: order.id,
      title,
      description,
      scope_of_work: scopeOfWork,
      price_note: priceNote,
      status: "draft",
      version: 1
    };

    const { data, error } = await supabase
      .from("work_orders")
      .insert({
        company_id: context.companyId,
        customer_id: order.customer_id,
        jobsite_id: order.jobsite_id,
        order_id: order.id,
        title,
        description,
        scope_of_work: scopeOfWork,
        price_note: priceNote,
        status: "draft",
        version: 1,
        content_hash: contentHash(initialSnapshot),
        created_by: context.userId
      })
      .select("id")
      .single();

    if (error || !data) throw new SafeActionError("Arbeitsauftrag konnte nicht erstellt werden.");

    const auditResult = await createSupabaseAdminClient()
      .from("company_audit_log")
      .insert({
        company_id: context.companyId,
        actor_id: context.userId,
        entity_type: "work_order",
        entity_id: data.id,
        action: "create",
        new_values: { order_id: order.id, title }
      });

    if (auditResult.error) {
      console.warn("Arbeitsauftrag wurde erstellt, aber der Audit-Log konnte nicht geschrieben werden.");
    }

    revalidatePath(`/orders/${orderId}`);
    return NextResponse.json({ success: "Arbeitsauftrag wurde als Entwurf angelegt." });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Arbeitsauftrag konnte nicht erstellt werden.") },
      { status: error instanceof SafeActionError ? 400 : 500 }
    );
  }
}
