"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppContext } from "@/lib/auth";
import { requireAppContext } from "@/lib/auth";
import { contentHash } from "@/lib/customer-portal/tokens";
import { jobsiteDocumentSelect } from "@/lib/data/selects";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { optionalFormString, requiredFormString, requiredFormUuid } from "@/lib/security/form-data";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { sanitizeUploadFileName, validateCustomerDocument } from "@/lib/security/uploads";
import { signerRole, validateSignatureDataUrl } from "@/lib/signatures/signature";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isForeman } from "@/lib/utils";
import type { Jobsite, JobsiteDocument, JobsiteDocumentCategory } from "@/types/app";

const documentCategories = [
  "angebot",
  "rechnung",
  "lieferschein",
  "aufmass",
  "abnahmeprotokoll",
  "regiebericht",
  "sicherheitsunterweisung",
  "sonstiges"
] as const satisfies readonly JobsiteDocumentCategory[];

const documentCategoryLabels: Record<JobsiteDocumentCategory, string> = {
  angebot: "Angebot",
  rechnung: "Rechnung",
  lieferschein: "Lieferschein",
  aufmass: "Aufmaß",
  abnahmeprotokoll: "Abnahmeprotokoll",
  regiebericht: "Regiebericht",
  sicherheitsunterweisung: "Sicherheitsunterweisung",
  sonstiges: "Dokument"
};

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type JobsiteAccess = Pick<Jobsite, "id" | "company_id" | "name" | "customer" | "address" | "assigned_employee_ids">;

function boolFromForm(formData: FormData, key: string) {
  const value = formData.get(key);
  return value === "on" || value === "true";
}

function documentCategory(value: string | null): JobsiteDocumentCategory {
  return documentCategories.includes(value as JobsiteDocumentCategory) ? (value as JobsiteDocumentCategory) : "sonstiges";
}

function cleanTitle(value: string | null, fallback: string) {
  const title = (value ?? "").trim();
  if (!title) return fallback;
  if (title.length > 140) throw new SafeActionError("Dokumenttitel ist zu lang.");
  return title;
}

function redirectBack(jobsiteId: string, params: { success?: string; error?: string }): never {
  const key = params.error ? "error" : "success";
  const message = params.error ?? params.success ?? "";
  redirect(`/baustellen/${jobsiteId}?${key}=${toQuery(message)}`);
}

function hasAssignedAccess(context: AppContext, jobsite: JobsiteAccess) {
  return context.canManage || jobsite.assigned_employee_ids.includes(context.userId);
}

async function loadAccessibleJobsite({
  supabase,
  context,
  jobsiteId
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  jobsiteId: string;
}) {
  const { data, error } = await supabase
    .from("jobsites")
    .select("id, company_id, name, customer, address, assigned_employee_ids")
    .eq("company_id", context.companyId)
    .eq("id", jobsiteId)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Baustelle wurde nicht gefunden.");

  const jobsite = data as JobsiteAccess;
  if (!hasAssignedAccess(context, jobsite)) throw new SafeActionError("Keine Berechtigung fuer diese Baustelle.");
  return jobsite;
}

async function loadManagedDocument({
  supabase,
  context,
  documentId,
  jobsiteId
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  documentId: string;
  jobsiteId: string;
}) {
  if (!context.canManage) throw new SafeActionError("Nur Chef/Admin darf dieses Dokument bearbeiten.");

  const { data, error } = await supabase
    .from("jobsite_documents")
    .select(jobsiteDocumentSelect)
    .eq("company_id", context.companyId)
    .eq("jobsite_id", jobsiteId)
    .eq("id", documentId)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !data) throw new SafeActionError("Dokument wurde nicht gefunden.");
  return data as JobsiteDocument;
}

async function writeActivity({
  supabase,
  context,
  jobsiteId,
  title,
  body,
  eventType,
  visibility = "internal",
  sourceTable,
  sourceId
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  jobsiteId: string;
  title: string;
  body?: string | null;
  eventType: string;
  visibility?: "internal" | "customer";
  sourceTable?: string;
  sourceId?: string;
}) {
  const { error } = await supabase.from("jobsite_activity_events").insert({
    company_id: context.companyId,
    jobsite_id: jobsiteId,
    event_type: eventType,
    title,
    body: body ?? null,
    visibility,
    actor_id: context.userId,
    source_table: sourceTable ?? null,
    source_id: sourceId ?? null
  });

  if (error) throw new SafeActionError("Baustellenverlauf konnte nicht gespeichert werden.");
}

function generatedDocumentTitle(jobsite: JobsiteAccess, category: JobsiteDocumentCategory, safeName: string) {
  const date = new Date().toISOString().slice(0, 10);
  const extension = safeName.includes(".") ? `.${safeName.split(".").pop()}` : "";
  return `${documentCategoryLabels[category]} ${jobsite.name} ${date}${extension}`;
}

export async function uploadJobsiteDocumentAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const jobsiteId = requiredFormUuid(formData, "jobsite_id", "Baustelle");

  try {
    const jobsite = await loadAccessibleJobsite({ supabase, context, jobsiteId });
    if (!context.canManage && !isForeman(context.profile.role)) {
      throw new SafeActionError("Nur Chef/Admin oder Vorarbeiter duerfen Baustellendokumente hochladen.");
    }

    const file = formData.get("document");
    if (!(file instanceof File) || file.size === 0) throw new SafeActionError("Bitte ein Dokument auswaehlen.");

    await checkRateLimit(`jobsite-document-upload:${context.companyId}:${context.userId}`, 20, 60_000);
    await validateCustomerDocument(file);

    const category = documentCategory(optionalFormString(formData, "category"));
    const safeName = sanitizeUploadFileName(file.name);
    const title = cleanTitle(optionalFormString(formData, "title"), generatedDocumentTitle(jobsite, category, safeName));
    const visibleToCustomer = context.canManage ? boolFromForm(formData, "visible_to_customer") : false;
    const storagePath = `${context.companyId}/jobsites/${jobsite.id}/${Date.now()}-${safeName}`;

    const { error: uploadError } = await supabase.storage.from("jobsite-documents").upload(storagePath, file, {
      contentType: file.type || undefined,
      upsert: false
    });

    if (uploadError) throw new SafeActionError("Dokument konnte nicht hochgeladen werden.");

    const { data, error } = await supabase
      .from("jobsite_documents")
      .insert({
        company_id: context.companyId,
        jobsite_id: jobsite.id,
        category,
        title,
        storage_path: storagePath,
        file_name: safeName,
        content_type: file.type || null,
        size_bytes: file.size,
        visible_to_customer: visibleToCustomer,
        uploaded_by: context.userId
      })
      .select("id")
      .single();

    if (error || !data) {
      await supabase.storage.from("jobsite-documents").remove([storagePath]);
      throw new SafeActionError("Dokument-Metadaten konnten nicht gespeichert werden.");
    }

    await writeActivity({
      supabase,
      context,
      jobsiteId: jobsite.id,
      eventType: "document",
      title: "Dokument hochgeladen",
      body: `${documentCategoryLabels[category]}: ${title}`,
      visibility: visibleToCustomer ? "customer" : "internal",
      sourceTable: "jobsite_documents",
      sourceId: data.id
    });

    revalidatePath(`/baustellen/${jobsite.id}`);
    redirectBack(jobsite.id, { success: "Dokument wurde in der Baustellenakte gespeichert." });
  } catch (error) {
    redirectBack(jobsiteId, { error: safeErrorMessage(error, "Dokument konnte nicht gespeichert werden.") });
  }
}

export async function archiveJobsiteDocumentAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const jobsiteId = requiredFormUuid(formData, "jobsite_id", "Baustelle");
  const documentId = requiredFormUuid(formData, "document_id", "Dokument");

  try {
    const document = await loadManagedDocument({ supabase, context, documentId, jobsiteId });
    const { data, error } = await supabase
      .from("jobsite_documents")
      .update({ archived_at: new Date().toISOString() })
      .eq("company_id", context.companyId)
      .eq("jobsite_id", jobsiteId)
      .eq("id", documentId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Dokument konnte nicht archiviert werden.");

    await writeActivity({
      supabase,
      context,
      jobsiteId,
      eventType: "document",
      title: "Dokument archiviert",
      body: document.title,
      sourceTable: "jobsite_documents",
      sourceId: documentId
    });

    revalidatePath(`/baustellen/${jobsiteId}`);
    redirectBack(jobsiteId, { success: "Dokument wurde archiviert." });
  } catch (error) {
    redirectBack(jobsiteId, { error: safeErrorMessage(error, "Dokument konnte nicht archiviert werden.") });
  }
}

export async function signJobsiteDocumentAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const jobsiteId = requiredFormUuid(formData, "jobsite_id", "Baustelle");
  const documentId = requiredFormUuid(formData, "document_id", "Dokument");
  let result: { success?: string; error?: string } = {};

  try {
    const document = await loadManagedDocument({ supabase, context, documentId, jobsiteId });
    if (document.signed_at) throw new SafeActionError("Dokument ist bereits bestaetigt.");

    const signatureName = requiredFormString(formData, "signature_name", "Name");
    if (signatureName.length > 120) throw new SafeActionError("Name ist zu lang.");
    const signatureDataUrl = validateSignatureDataUrl(optionalFormString(formData, "signature_data_url"), { required: true });

    const headerStore = await headers();
    const signedAt = new Date().toISOString();
    const role = signerRole(context.profile.role);
    const snapshot = {
      id: document.id,
      jobsite_id: document.jobsite_id,
      category: document.category,
      title: document.title,
      file_name: document.file_name,
      content_type: document.content_type,
      size_bytes: document.size_bytes,
      visible_to_customer: document.visible_to_customer,
      signed_by: context.userId,
      signed_at: signedAt,
      signature_name: signatureName,
      signature_role: role,
      signature_data_hash: contentHash(signatureDataUrl)
    };
    const hash = contentHash(snapshot);
    const signerIp = headerStore.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const signerUserAgent = headerStore.get("user-agent") ?? null;
    const documentType = document.category === "abnahmeprotokoll" ? "acceptance" : "jobsite_document";
    const { data, error } = await supabase
      .from("jobsite_documents")
      .update({
        signed_by: context.userId,
        signed_at: signedAt,
        signature_name: signatureName,
        signature_data_url: signatureDataUrl,
        signature_role: role,
        signature_content_hash: hash
      })
      .eq("company_id", context.companyId)
      .eq("jobsite_id", jobsiteId)
      .eq("id", documentId)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();

    if (error || !data) throw new SafeActionError("Dokument konnte nicht bestaetigt werden.");

    const { error: versionError } = await supabase.from("digital_document_versions").insert({
      company_id: context.companyId,
      document_type: documentType,
      document_id: documentId,
      version: 1,
      snapshot,
      content_hash: hash,
      created_by: context.userId
    });
    if (versionError) throw new SafeActionError("Signatur-Version konnte nicht gespeichert werden.");

    const { error: signatureError } = await supabase.from("digital_signatures").insert({
      company_id: context.companyId,
      document_type: documentType,
      document_id: documentId,
      document_version: 1,
      jobsite_id: jobsiteId,
      status: "signed",
      signer_name: signatureName,
      signer_role: role,
      signer_user_id: context.userId,
      signer_ip: signerIp,
      signer_user_agent: signerUserAgent,
      signature_data_url: signatureDataUrl,
      signed_at: signedAt,
      rejected_at: null,
      rejection_reason: null,
      content_hash: hash,
      metadata: {
        category: document.category,
        title: document.title
      }
    });
    if (signatureError) throw new SafeActionError("Signatur-Nachweis konnte nicht gespeichert werden.");

    await writeActivity({
      supabase,
      context,
      jobsiteId,
      eventType: "signature",
      title: "Dokument bestaetigt",
      body: `${document.title} wurde von ${signatureName} bestaetigt.`,
      sourceTable: "jobsite_documents",
      sourceId: documentId
    });

    revalidatePath(`/baustellen/${jobsiteId}`);
    result = { success: "Dokument wurde bestaetigt und signiert." };
  } catch (error) {
    result = { error: safeErrorMessage(error, "Dokument konnte nicht bestaetigt werden.") };
  }

  redirectBack(jobsiteId, result);
}

export async function createJobsiteActivityNoteAction(formData: FormData) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const jobsiteId = requiredFormUuid(formData, "jobsite_id", "Baustelle");

  try {
    await loadAccessibleJobsite({ supabase, context, jobsiteId });
    const title = requiredFormString(formData, "title", "Titel");
    const body = optionalFormString(formData, "body");
    if (title.length > 120) throw new SafeActionError("Titel ist zu lang.");
    if (body && body.length > 2000) throw new SafeActionError("Notiz ist zu lang.");

    await writeActivity({
      supabase,
      context,
      jobsiteId,
      eventType: "note",
      title,
      body,
      visibility: context.canManage && boolFromForm(formData, "visible_to_customer") ? "customer" : "internal"
    });

    revalidatePath(`/baustellen/${jobsiteId}`);
    redirectBack(jobsiteId, { success: "Notiz wurde im Verlauf gespeichert." });
  } catch (error) {
    redirectBack(jobsiteId, { error: safeErrorMessage(error, "Notiz konnte nicht gespeichert werden.") });
  }
}
