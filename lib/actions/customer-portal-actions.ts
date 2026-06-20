"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import {
  contentHash,
  createCustomerPortalToken,
  customerPortalExpiresAt,
  customerPortalUrl,
  hashCustomerPortalToken,
  publicWorkOrderSnapshot
} from "@/lib/customer-portal/tokens";
import {
  customerPortalTokenActionSelect,
  reportPhotoSelect,
  workOrderActionSelect
} from "@/lib/data/selects";
import { SafeActionError, safeErrorMessage } from "@/lib/security/errors";
import { optionalFormString, requiredFormString, requiredFormUuid } from "@/lib/security/form-data";
import { publicAppOrigin } from "@/lib/security/origin";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { sanitizeUploadFileName, validateCustomerDocument } from "@/lib/security/uploads";
import { validateSignatureDataUrl } from "@/lib/signatures/signature";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { CustomerPortalEventType, CustomerPortalToken, Order, Report, ReportPhoto, WorkOrder } from "@/types/app";

function redirectBack(path: string, message: { success?: string; error?: string; portalToken?: string }) {
  const params = new URLSearchParams();
  if (message.success) params.set("success", message.success);
  if (message.error) params.set("error", message.error);
  if (message.portalToken) params.set("portal_token", message.portalToken);
  redirect(`${path}?${params.toString()}`);
}

function positiveDays(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 45;
  return Math.min(Math.max(Math.trunc(parsed), 1), 180);
}

function customerPortalEventType(value: string | null): CustomerPortalEventType {
  if (value === "status" || value === "photo" || value === "document" || value === "appointment" || value === "work_order") {
    return value;
  }

  return "update";
}

function workOrderDecision(value: string) {
  if (value === "sign" || value === "reject") return value;
  throw new SafeActionError("Ungueltige Rueckmeldung.");
}

function boundedText(value: string | null, label: string, maxLength: number) {
  if (!value) return null;
  if (value.length > maxLength) throw new SafeActionError(`${label} ist zu lang.`);
  return value;
}

function boundedEmail(value: string | null) {
  const email = boundedText(value, "E-Mail", 180);
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new SafeActionError("Bitte eine gueltige E-Mail-Adresse angeben.");
  return email;
}

async function requestOrigin() {
  const headerStore = await headers();
  return publicAppOrigin(headerStore.get("origin"));
}

async function audit({
  companyId,
  actorId,
  entityType,
  entityId,
  action,
  oldValues,
  newValues
}: {
  companyId: string;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  try {
    const supabase = createSupabaseAdminClient();
    await supabase.from("company_audit_log").insert({
      company_id: companyId,
      actor_id: actorId,
      entity_type: entityType,
      entity_id: entityId,
      action,
      old_values: oldValues ?? null,
      new_values: newValues ?? null
    });
  } catch (error) {
    console.warn("audit-log-write-failed", error);
  }
}

async function loadManagedOrder(orderId: string) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, company_id, customer_id, jobsite_id, order_number, title, description, status")
    .eq("id", orderId)
    .eq("company_id", context.companyId)
    .single();

  if (error || !data) throw new SafeActionError("Auftrag wurde nicht gefunden.");
  return { context, supabase, order: data as Pick<Order, "id" | "company_id" | "customer_id" | "jobsite_id" | "order_number" | "title" | "description" | "status"> };
}

export async function createCustomerPortalLinkAction(formData: FormData) {
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const backPath = `/orders/${orderId}`;
  let result: { success?: string; error?: string; portalToken?: string };

  try {
    const { context, supabase, order } = await loadManagedOrder(orderId);
    assertRateLimit(`customer-portal-link:${context.companyId}:${context.userId}`, 10, 60_000);

    const token = createCustomerPortalToken();
    const label = optionalFormString(formData, "label") ?? `Kundenlink ${order.order_number}`;
    const expiresAt = customerPortalExpiresAt(positiveDays(optionalFormString(formData, "expires_days")));

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

    await supabase.from("customer_portal_events").insert({
      company_id: context.companyId,
      customer_id: order.customer_id,
      jobsite_id: order.jobsite_id,
      event_type: "status",
      title: "Kundenportal freigeschaltet",
      body: "Der sichere Kundenbereich wurde fuer diesen Auftrag vorbereitet.",
      visible_to_customer: true,
      created_by: context.userId
    });

    await audit({
      companyId: context.companyId,
      actorId: context.userId,
      entityType: "customer_portal_token",
      entityId: data.id,
      action: "create",
      newValues: { order_id: order.id, expires_at: expiresAt }
    });

    revalidatePath(backPath);
    result = {
      success: `Kundenlink erstellt: ${customerPortalUrl(await requestOrigin(), token)}`,
      portalToken: token
    };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Kundenportal-Link konnte nicht erstellt werden.") };
  }

  redirectBack(backPath, result);
}

export async function revokeCustomerPortalLinkAction(formData: FormData) {
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const tokenId = requiredFormUuid(formData, "token_id", "Kundenlink");
  const backPath = `/orders/${orderId}`;
  let result: { success?: string; error?: string };

  try {
    const context = await requireManager();
    const supabase = await createSupabaseServerClient();
    const { data: token } = await supabase
      .from("customer_portal_tokens")
      .select(customerPortalTokenActionSelect)
      .eq("id", tokenId)
      .eq("company_id", context.companyId)
      .maybeSingle();

    if (!token) throw new SafeActionError("Kundenlink wurde nicht gefunden.");
    const currentToken = token as unknown as Pick<CustomerPortalToken, "revoked_at">;

    const revokedAt = new Date().toISOString();
    const { data: revokedToken, error } = await supabase
      .from("customer_portal_tokens")
      .update({ revoked_at: revokedAt })
      .eq("id", tokenId)
      .eq("company_id", context.companyId)
      .select("id")
      .maybeSingle();

    if (error || !revokedToken) throw new SafeActionError("Kundenlink konnte nicht gesperrt werden.");

    await audit({
      companyId: context.companyId,
      actorId: context.userId,
      entityType: "customer_portal_token",
      entityId: tokenId,
      action: "revoke",
      oldValues: { revoked_at: currentToken.revoked_at },
      newValues: { revoked_at: revokedAt }
    });

    revalidatePath(backPath);
    result = { success: "Kundenlink wurde gesperrt." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Kundenlink konnte nicht gesperrt werden.") };
  }

  redirectBack(backPath, result);
}

export async function createWorkOrderAction(formData: FormData) {
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const backPath = `/orders/${orderId}`;
  let result: { success?: string; error?: string };

  try {
    const { context, supabase, order } = await loadManagedOrder(orderId);
    const title = requiredFormString(formData, "title", "Titel");
    const description = optionalFormString(formData, "description");
    const scopeOfWork = requiredFormString(formData, "scope_of_work", "Leistungsbeschreibung");
    const priceNote = optionalFormString(formData, "price_note");
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

    await audit({
      companyId: context.companyId,
      actorId: context.userId,
      entityType: "work_order",
      entityId: data.id,
      action: "create",
      newValues: { order_id: order.id, title }
    });

    revalidatePath(backPath);
    result = { success: "Arbeitsauftrag wurde als Entwurf angelegt." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Arbeitsauftrag konnte nicht erstellt werden.") };
  }

  redirectBack(backPath, result);
}

export async function sendWorkOrderAction(formData: FormData) {
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const workOrderId = requiredFormUuid(formData, "work_order_id", "Arbeitsauftrag");
  const backPath = `/orders/${orderId}`;
  let result: { success?: string; error?: string };

  try {
    const { context, supabase } = await loadManagedOrder(orderId);
    const { data: workOrder, error: loadError } = await supabase
      .from("work_orders")
      .select(workOrderActionSelect)
      .eq("id", workOrderId)
      .eq("order_id", orderId)
      .eq("company_id", context.companyId)
      .single();

    if (loadError || !workOrder) throw new SafeActionError("Arbeitsauftrag wurde nicht gefunden.");
    const current = workOrder as unknown as WorkOrder;
    if (current.status !== "draft") throw new SafeActionError("Nur Entwuerfe koennen an den Kunden gesendet werden.");

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

    await supabase.from("customer_portal_events").insert({
      company_id: context.companyId,
      customer_id: current.customer_id,
      jobsite_id: current.jobsite_id,
      event_type: "work_order",
      title: "Arbeitsauftrag zur Freigabe",
      body: current.title,
      visible_to_customer: true,
      created_by: context.userId
    });

    await audit({
      companyId: context.companyId,
      actorId: context.userId,
      entityType: "work_order",
      entityId: workOrderId,
      action: "send",
      oldValues: { status: current.status },
      newValues: { status: "sent", content_hash: hash }
    });

    revalidatePath(backPath);
    result = { success: "Arbeitsauftrag ist jetzt im Kundenportal sichtbar." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Arbeitsauftrag konnte nicht gesendet werden.") };
  }

  redirectBack(backPath, result);
}

export async function createCustomerPortalEventAction(formData: FormData) {
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const backPath = `/orders/${orderId}`;
  let result: { success?: string; error?: string };

  try {
    const { context, supabase, order } = await loadManagedOrder(orderId);
    assertRateLimit(`customer-portal-event:${context.companyId}:${context.userId}`, 30, 60_000);
    const title = requiredFormString(formData, "title", "Titel");
    const body = optionalFormString(formData, "body");
    const eventType = customerPortalEventType(optionalFormString(formData, "event_type"));

    const { data, error } = await supabase
      .from("customer_portal_events")
      .insert({
        company_id: context.companyId,
        customer_id: order.customer_id,
        jobsite_id: order.jobsite_id,
        event_type: eventType,
        title,
        body,
        visible_to_customer: true,
        created_by: context.userId
      })
      .select("id")
      .single();

    if (error || !data) throw new SafeActionError("Kundenupdate konnte nicht gespeichert werden.");

    await audit({
      companyId: context.companyId,
      actorId: context.userId,
      entityType: "customer_portal_event",
      entityId: data.id,
      action: "create",
      newValues: { order_id: order.id, event_type: eventType, title }
    });

    revalidatePath(backPath);
    result = { success: "Kundenupdate ist im Portal sichtbar." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Kundenupdate konnte nicht gespeichert werden.") };
  }

  redirectBack(backPath, result);
}

export async function uploadCustomerDocumentAction(formData: FormData) {
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const backPath = `/orders/${orderId}`;
  let result: { success?: string; error?: string };

  try {
    const { context, supabase, order } = await loadManagedOrder(orderId);
    assertRateLimit(`customer-document-upload:${context.companyId}:${context.userId}`, 12, 60_000);

    const file = formData.get("document");
    if (!(file instanceof File) || file.size <= 0) throw new SafeActionError("Bitte ein Dokument auswaehlen.");

    await validateCustomerDocument(file);
    const title = optionalFormString(formData, "title") ?? sanitizeUploadFileName(file.name).replace(/\.[^.]+$/, "");
    const safeName = sanitizeUploadFileName(file.name);
    const jobsiteSegment = order.jobsite_id ?? "ohne-baustelle";
    const storagePath = `${context.companyId}/customers/${order.customer_id}/jobsites/${jobsiteSegment}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("customer-documents").upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false
    });

    if (uploadError) throw new SafeActionError("Dokument konnte nicht hochgeladen werden.");

    const { data, error } = await supabase
      .from("customer_documents")
      .insert({
        company_id: context.companyId,
        customer_id: order.customer_id,
        jobsite_id: order.jobsite_id,
        title,
        storage_path: storagePath,
        file_name: safeName,
        content_type: file.type || null,
        visible_to_customer: true,
        uploaded_by: context.userId
      })
      .select("id")
      .single();

    if (error || !data) {
      await supabase.storage.from("customer-documents").remove([storagePath]);
      throw new SafeActionError("Dokument-Metadaten konnten nicht gespeichert werden.");
    }

    await supabase.from("customer_portal_events").insert({
      company_id: context.companyId,
      customer_id: order.customer_id,
      jobsite_id: order.jobsite_id,
      event_type: "document",
      title: "Dokument freigegeben",
      body: title,
      visible_to_customer: true,
      created_by: context.userId
    });

    await audit({
      companyId: context.companyId,
      actorId: context.userId,
      entityType: "customer_document",
      entityId: data.id,
      action: "upload",
      newValues: { order_id: order.id, title, content_type: file.type, size: file.size }
    });

    revalidatePath(backPath);
    result = { success: "Dokument ist im Kundenportal sichtbar." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Dokument konnte nicht freigegeben werden.") };
  }

  redirectBack(backPath, result);
}

export async function signWorkOrderFromPortalAction(formData: FormData) {
  const token = requiredFormString(formData, "token", "Portal-Link");
  const workOrderId = requiredFormUuid(formData, "work_order_id", "Arbeitsauftrag");
  const decision = requiredFormString(formData, "decision", "Entscheidung");
  const backPath = `/portal/${encodeURIComponent(token)}`;
  let result: { success?: string; error?: string };

  try {
    assertRateLimit(`portal-sign:${hashCustomerPortalToken(token)}`, 8, 60_000);
    const decisionValue = workOrderDecision(decision);
    const signerName = boundedText(requiredFormString(formData, "signer_name", "Name"), "Name", 120) as string;
    const signatureDataUrl = validateSignatureDataUrl(optionalFormString(formData, "signature_data_url"), {
      required: decisionValue === "sign"
    });
    const rejectionReason = boundedText(optionalFormString(formData, "rejection_reason"), "Rueckmeldung", 1000);
    if (decisionValue === "reject" && !rejectionReason) {
      throw new SafeActionError("Bitte bei Ablehnung kurz angeben, was angepasst werden soll.");
    }
    const supabase = createSupabaseAdminClient();
    const tokenHash = hashCustomerPortalToken(token);

    const { data: tokenRow } = await supabase
      .from("customer_portal_tokens")
      .select(customerPortalTokenActionSelect)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    const portalToken = tokenRow as unknown as CustomerPortalToken | null;
    if (!portalToken || portalToken.revoked_at || new Date(portalToken.expires_at).getTime() <= Date.now()) {
      throw new SafeActionError("Portal-Link ist abgelaufen oder wurde gesperrt.");
    }

    let workOrderQuery = supabase
      .from("work_orders")
      .select(workOrderActionSelect)
      .eq("id", workOrderId)
      .eq("company_id", portalToken.company_id)
      .eq("customer_id", portalToken.customer_id);
    if (portalToken.jobsite_id) workOrderQuery = workOrderQuery.eq("jobsite_id", portalToken.jobsite_id);
    const { data: workOrderRow } = await workOrderQuery.maybeSingle();

    const workOrder = workOrderRow as unknown as WorkOrder | null;
    if (!workOrder) {
      throw new SafeActionError("Arbeitsauftrag wurde nicht gefunden.");
    }
    if (workOrder.status !== "sent" && workOrder.status !== "viewed") {
      throw new SafeActionError("Dieser Arbeitsauftrag ist bereits finalisiert.");
    }

    const headerStore = await headers();
    const now = new Date().toISOString();
    const signerIp = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const signerUserAgent = headerStore.get("user-agent") ?? null;
    const status = decisionValue === "reject" ? "rejected" : "signed";
    const updates: Partial<WorkOrder> = {
      status,
      signer_name: signerName,
      signer_ip: signerIp,
      signer_user_agent: signerUserAgent,
      signature_data_url: signatureDataUrl,
      signature_role: "kunde",
      rejection_reason: status === "rejected" ? rejectionReason : null,
      signed_at: status === "signed" ? now : null,
      rejected_at: status === "rejected" ? now : null
    };
    const snapshot = publicWorkOrderSnapshot(workOrder, updates);
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

    await supabase.from("work_order_versions").insert({
      company_id: workOrder.company_id,
      work_order_id: workOrder.id,
      version: workOrder.version,
      snapshot,
      content_hash: hash,
      created_by: null
    });

    const { error: versionError } = await supabase.from("digital_document_versions").insert({
      company_id: workOrder.company_id,
      document_type: "work_order",
      document_id: workOrder.id,
      version: workOrder.version,
      snapshot,
      content_hash: hash,
      created_by: null
    });
    if (versionError) throw new SafeActionError("Signatur-Version konnte nicht gespeichert werden.");

    const { error: signatureError } = await supabase.from("digital_signatures").insert({
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
    });
    if (signatureError) throw new SafeActionError("Signatur-Nachweis konnte nicht gespeichert werden.");

    await supabase.from("customer_portal_events").insert({
      company_id: workOrder.company_id,
      customer_id: workOrder.customer_id,
      jobsite_id: workOrder.jobsite_id,
      event_type: "work_order",
      title: status === "signed" ? "Arbeitsauftrag unterschrieben" : "Arbeitsauftrag abgelehnt",
      body: status === "signed" ? signerName : rejectionReason,
      visible_to_customer: true,
      created_by: null
    });

    await audit({
      companyId: workOrder.company_id,
      actorId: null,
      entityType: "work_order",
      entityId: workOrder.id,
      action: status,
      oldValues: { status: workOrder.status },
      newValues: { status, signer_name: signerName, signer_role: "kunde", content_hash: hash }
    });

    result = {
      success: status === "signed" ? "Arbeitsauftrag wurde unterschrieben." : "Rueckmeldung wurde gespeichert."
    };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Arbeitsauftrag konnte nicht verarbeitet werden.") };
  }

  redirectBack(backPath, result);
}

export async function sendCustomerPortalMessageAction(formData: FormData) {
  const token = requiredFormString(formData, "token", "Portal-Link");
  const backPath = `/portal/${encodeURIComponent(token)}`;
  let result: { success?: string; error?: string };

  try {
    assertRateLimit(`portal-message:${hashCustomerPortalToken(token)}`, 6, 60_000);
    requiredFormString(formData, "privacy_ack", "Datenschutzhinweis");
    const senderName = boundedText(requiredFormString(formData, "sender_name", "Name"), "Name", 120) as string;
    const senderEmail = boundedEmail(optionalFormString(formData, "sender_email"));
    const message = boundedText(requiredFormString(formData, "message", "Nachricht"), "Nachricht", 2000) as string;
    const supabase = createSupabaseAdminClient();
    const tokenHash = hashCustomerPortalToken(token);

    const { data: tokenRow } = await supabase
      .from("customer_portal_tokens")
      .select(customerPortalTokenActionSelect)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    const portalToken = tokenRow as unknown as CustomerPortalToken | null;
    if (!portalToken || portalToken.revoked_at || new Date(portalToken.expires_at).getTime() <= Date.now()) {
      throw new SafeActionError("Portal-Link ist abgelaufen oder wurde gesperrt.");
    }

    const { data: insertedMessage, error } = await supabase
      .from("customer_portal_messages")
      .insert({
        company_id: portalToken.company_id,
        customer_id: portalToken.customer_id,
        jobsite_id: portalToken.jobsite_id,
        portal_token_id: portalToken.id,
        sender_name: senderName,
        sender_email: senderEmail,
        message,
        status: "open"
      })
      .select("id")
      .maybeSingle();

    if (error || !insertedMessage) throw new SafeActionError("Nachricht konnte nicht gespeichert werden. Ist die Kundenportal-Migration eingespielt?");

    await supabase.from("customer_portal_events").insert({
      company_id: portalToken.company_id,
      customer_id: portalToken.customer_id,
      jobsite_id: portalToken.jobsite_id,
      event_type: "update",
      title: "Nachricht gesendet",
      body: "Ihre Frage wurde an den Betrieb uebermittelt.",
      visible_to_customer: true,
      created_by: null
    });

    await audit({
      companyId: portalToken.company_id,
      actorId: null,
      entityType: "customer_portal_message",
      entityId: insertedMessage.id,
      action: "create",
      newValues: { customer_id: portalToken.customer_id, jobsite_id: portalToken.jobsite_id }
    });

    result = { success: "Nachricht wurde gesendet. Der Betrieb meldet sich bei Ihnen." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Nachricht konnte nicht gesendet werden.") };
  }

  redirectBack(backPath, result);
}

export async function toggleReportCustomerReleaseAction(formData: FormData) {
  const reportId = requiredFormUuid(formData, "report_id", "Bericht");
  const backPath = `/berichte/${reportId}`;
  let result: { success?: string; error?: string };

  try {
    const context = await requireManager();
    const supabase = await createSupabaseServerClient();
    const mode = requiredFormString(formData, "mode", "Aktion");
    const release = mode === "release";
    if (!release && mode !== "hide") throw new SafeActionError("Ungueltige Freigabe-Aktion.");

    const { data: reportRow } = await supabase
      .from("reports")
      .select("id, company_id, jobsite_id, report_date, activities, weather_summary, report_status, visible_to_customer, customer_summary")
      .eq("id", reportId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();

    if (!reportRow) throw new SafeActionError("Bericht wurde nicht gefunden.");
    const report = reportRow as Pick<
      Report,
      "id" | "company_id" | "jobsite_id" | "report_date" | "activities" | "weather_summary" | "report_status" | "visible_to_customer" | "customer_summary"
    >;
    if (!report.jobsite_id) throw new SafeActionError("Bericht ist keiner Baustelle zugeordnet.");
    if (release && report.report_status !== "approved") {
      throw new SafeActionError("Nur freigegebene Bautagesberichte koennen im Kundenportal angezeigt werden.");
    }

    const customerSummary =
      boundedText(optionalFormString(formData, "customer_summary"), "Kundenzusammenfassung", 1200) ??
      report.customer_summary ??
      report.activities.slice(0, 1200);
    const now = new Date().toISOString();
    const { data: updatedReport, error } = await supabase
      .from("reports")
      .update({
        visible_to_customer: release,
        customer_summary: release ? customerSummary : report.customer_summary,
        customer_released_at: release ? now : null,
        customer_released_by: release ? context.userId : null
      })
      .eq("id", reportId)
      .eq("company_id", context.companyId)
      .select("id")
      .maybeSingle();

    if (error || !updatedReport) throw new SafeActionError("Kundenfreigabe konnte nicht gespeichert werden. Ist die Kundenportal-Migration eingespielt?");

    if (release) {
      const { data: tokens } = await supabase
        .from("customer_portal_tokens")
        .select("customer_id")
        .eq("company_id", context.companyId)
        .eq("jobsite_id", report.jobsite_id)
        .is("revoked_at", null);
      const customerIds = Array.from(new Set((tokens ?? []).map((row) => row.customer_id).filter(Boolean)));
      if (customerIds.length > 0) {
        await supabase.from("customer_portal_events").insert(
          customerIds.map((customerId) => ({
            company_id: context.companyId,
            customer_id: customerId,
            jobsite_id: report.jobsite_id,
            event_type: "status" as CustomerPortalEventType,
            title: "Bautagesbericht freigegeben",
            body: report.weather_summary ? `${customerSummary}\n\nWetter: ${report.weather_summary}` : customerSummary,
            visible_to_customer: true,
            created_by: context.userId
          }))
        );
      }
    }

    await audit({
      companyId: context.companyId,
      actorId: context.userId,
      entityType: "report",
      entityId: reportId,
      action: release ? "release_to_customer_portal" : "hide_from_customer_portal",
      oldValues: { visible_to_customer: report.visible_to_customer },
      newValues: { visible_to_customer: release }
    });

    revalidatePath(backPath);
    result = { success: release ? "Bautagesbericht ist im Kundenportal sichtbar." : "Bautagesbericht ist im Kundenportal ausgeblendet." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Kundenfreigabe konnte nicht gespeichert werden.") };
  }

  redirectBack(backPath, result);
}

export async function toggleReportPhotoCustomerVisibilityAction(formData: FormData) {
  const reportId = requiredFormUuid(formData, "report_id", "Bericht");
  const photoId = requiredFormUuid(formData, "photo_id", "Foto");
  const backPath = `/berichte/${reportId}`;
  let result: { success?: string; error?: string };

  try {
    const context = await requireManager();
    const supabase = await createSupabaseServerClient();
    const { data: photo } = await supabase
      .from("report_photos")
      .select(reportPhotoSelect)
      .eq("id", photoId)
      .eq("report_id", reportId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();

    if (!photo) throw new SafeActionError("Foto wurde nicht gefunden.");
    const current = photo as unknown as ReportPhoto;
    const nextVisible = !current.visible_to_customer;
    const { data: updatedPhoto, error } = await supabase
      .from("report_photos")
      .update({
        visible_to_customer: nextVisible,
        approved_by: nextVisible ? context.userId : null,
        approved_at: nextVisible ? new Date().toISOString() : null
      })
      .eq("id", photoId)
      .eq("report_id", reportId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !updatedPhoto) throw new SafeActionError("Foto-Freigabe konnte nicht gespeichert werden.");

    await audit({
      companyId: context.companyId,
      actorId: context.userId,
      entityType: "report_photo",
      entityId: photoId,
      action: nextVisible ? "release_to_customer" : "hide_from_customer",
      oldValues: { visible_to_customer: current.visible_to_customer },
      newValues: { visible_to_customer: nextVisible }
    });

    revalidatePath(backPath);
    result = { success: nextVisible ? "Foto ist im Kundenportal sichtbar." : "Foto ist im Kundenportal ausgeblendet." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Foto-Freigabe konnte nicht gespeichert werden.") };
  }

  redirectBack(backPath, result);
}
