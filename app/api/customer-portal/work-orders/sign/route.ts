import { NextResponse, type NextRequest } from "next/server";
import {
  contentHash,
  hashCustomerPortalToken,
  publicWorkOrderSnapshot
} from "@/lib/customer-portal/tokens";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { validateSignatureDataUrl } from "@/lib/signatures/signature";
import { isMissingSchemaError } from "@/lib/supabase/errors";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { CustomerPortalToken, WorkOrder } from "@/types/app";

const customerPortalTokenSelect = "id, company_id, customer_id, jobsite_id, label, expires_at, revoked_at, created_by, created_at, last_used_at";
const workOrderSelect =
  "id, company_id, customer_id, jobsite_id, order_id, title, description, scope_of_work, price_note, status, version, content_hash, sent_at, viewed_at, signed_at, rejected_at, signer_name, signer_ip, signer_user_agent, signature_data_url, rejection_reason, created_by, created_at, updated_at";

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

function decisionValue(value: string) {
  if (value === "sign" || value === "reject") return value;
  throw new SafeActionError("Ungültige Entscheidung.");
}

function clientIp(request: NextRequest) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? null;
}

function bestEffortError(result: PromiseSettledResult<{ error: unknown }>) {
  if (result.status === "rejected") return result.reason;
  return result.value.error;
}

function logBestEffort(label: string, result: PromiseSettledResult<{ error: unknown }>) {
  const error = bestEffortError(result);
  if (error && !isMissingSchemaError(error)) {
    console.warn(`Arbeitsauftrag wurde signiert, aber ${label} konnte nicht vollständig geschrieben werden.`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const token = requiredString(payload.token, "Portal-Link", 500);
    const workOrderId = requiredString(payload.workOrderId, "Arbeitsauftrag", 80);
    const decision = decisionValue(requiredString(payload.decision, "Entscheidung", 20));
    const signerName = requiredString(payload.signerName, "Name", 120);
    const signatureDataUrl = validateSignatureDataUrl(optionalString(payload.signatureDataUrl, 2_000_000), {
      required: decision === "sign"
    });
    const rejectionReason = optionalString(payload.rejectionReason, 1000);
    if (decision === "reject" && !rejectionReason) {
      throw new SafeActionError("Bitte bei Ablehnung kurz angeben, was angepasst werden soll.");
    }

    const tokenHash = hashCustomerPortalToken(token);
    await checkRateLimit(`portal-sign:${tokenHash}`, 8, 60_000);

    const supabase = createSupabaseAdminClient();
    const { data: tokenRow } = await supabase
      .from("customer_portal_tokens")
      .select(customerPortalTokenSelect)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    const portalToken = tokenRow as unknown as CustomerPortalToken | null;
    if (!portalToken || portalToken.revoked_at || new Date(portalToken.expires_at).getTime() <= Date.now()) {
      throw new SafeActionError("Portal-Link ist abgelaufen oder wurde gesperrt.");
    }

    let workOrderQuery = supabase
      .from("work_orders")
      .select(workOrderSelect)
      .eq("id", workOrderId)
      .eq("company_id", portalToken.company_id)
      .eq("customer_id", portalToken.customer_id);
    if (portalToken.jobsite_id) workOrderQuery = workOrderQuery.eq("jobsite_id", portalToken.jobsite_id);
    const { data: workOrderRow } = await workOrderQuery.maybeSingle();

    const workOrder = workOrderRow as unknown as WorkOrder | null;
    if (!workOrder) throw new SafeActionError("Arbeitsauftrag wurde nicht gefunden.");
    if (workOrder.status !== "sent" && workOrder.status !== "viewed") {
      throw new SafeActionError("Dieser Arbeitsauftrag ist bereits finalisiert.");
    }

    const now = new Date().toISOString();
    const status = decision === "reject" ? "rejected" : "signed";
    const signerIp = clientIp(request);
    const signerUserAgent = request.headers.get("user-agent");
    const updates: Partial<WorkOrder> = {
      status,
      signer_name: signerName,
      signer_ip: signerIp,
      signer_user_agent: signerUserAgent,
      signature_data_url: signatureDataUrl,
      rejection_reason: status === "rejected" ? rejectionReason : null,
      signed_at: status === "signed" ? now : null,
      rejected_at: status === "rejected" ? now : null
    };
    const snapshot = publicWorkOrderSnapshot(workOrder, { ...updates, signature_role: "kunde" });
    const hash = contentHash(snapshot);

    let updateQuery = supabase
      .from("work_orders")
      .update({ ...updates, content_hash: hash })
      .eq("id", workOrder.id)
      .eq("company_id", portalToken.company_id)
      .eq("customer_id", portalToken.customer_id)
      .in("status", ["sent", "viewed"]);
    if (portalToken.jobsite_id) updateQuery = updateQuery.eq("jobsite_id", portalToken.jobsite_id);
    const { data: signedWorkOrder, error: updateError } = await updateQuery.select("id").maybeSingle();

    if (updateError || !signedWorkOrder) throw new SafeActionError("Arbeitsauftrag konnte nicht verarbeitet werden.");

    const [workOrderVersionResult, documentVersionResult, signatureResult, eventResult, auditResult] = await Promise.allSettled([
      supabase.from("work_order_versions").insert({
        company_id: workOrder.company_id,
        work_order_id: workOrder.id,
        version: workOrder.version,
        snapshot,
        content_hash: hash,
        created_by: null
      }),
      supabase.from("digital_document_versions").insert({
        company_id: workOrder.company_id,
        document_type: "work_order",
        document_id: workOrder.id,
        version: workOrder.version,
        snapshot,
        content_hash: hash,
        created_by: null
      }),
      supabase.from("digital_signatures").insert({
        company_id: workOrder.company_id,
        document_type: "work_order",
        document_id: workOrder.id,
        document_version: workOrder.version,
        jobsite_id: workOrder.jobsite_id,
        status,
        signer_name: signerName,
        signer_role: "kunde",
        signer_user_id: null,
        signer_ip: signerIp,
        signer_user_agent: signerUserAgent,
        signature_data_url: signatureDataUrl,
        signed_at: status === "signed" ? now : null,
        rejected_at: status === "rejected" ? now : null,
        rejection_reason: status === "rejected" ? rejectionReason : null,
        content_hash: hash,
        metadata: {
          portal_token_id: portalToken.id,
          customer_id: portalToken.customer_id
        }
      }),
      supabase.from("customer_portal_events").insert({
        company_id: workOrder.company_id,
        customer_id: workOrder.customer_id,
        jobsite_id: workOrder.jobsite_id,
        event_type: "work_order",
        title: status === "signed" ? "Arbeitsauftrag unterschrieben" : "Arbeitsauftrag abgelehnt",
        body: status === "signed" ? signerName : rejectionReason,
        visible_to_customer: true,
        created_by: null
      }),
      supabase.from("company_audit_log").insert({
        company_id: workOrder.company_id,
        actor_id: null,
        entity_type: "work_order",
        entity_id: workOrder.id,
        action: status,
        old_values: { status: workOrder.status },
        new_values: { status, signer_name: signerName, signer_role: "kunde", content_hash: hash }
      })
    ]);

    logBestEffort("die Arbeitsauftrag-Version", workOrderVersionResult);
    logBestEffort("die Dokumentversion", documentVersionResult);
    logBestEffort("der Signatur-Nachweis", signatureResult);
    logBestEffort("das Kundenportal-Event", eventResult);
    logBestEffort("der Audit-Log", auditResult);

    return NextResponse.json({
      success: status === "signed" ? "Arbeitsauftrag wurde unterschrieben." : "Rückmeldung wurde gespeichert."
    });
  } catch (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error, "Arbeitsauftrag konnte nicht verarbeitet werden.") },
      { status: error instanceof SafeActionError ? 400 : 500 }
    );
  }
}
