"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireManager } from "@/lib/auth";
import { commercialDocumentListSelect } from "@/lib/data/selects";
import { customerDisplayName } from "@/lib/order-labels";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { requiredFormUuid } from "@/lib/security/form-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { optionalDate, optionalNumber, optionalString } from "@/lib/utils";
import type { CommercialDocumentStatus, CommercialDocumentType, Customer, JobMaterialRequirement, Order } from "@/types/app";

type CustomerSnapshot = {
  name: string;
  email: string | null;
  phone: string | null;
  billing_address: string | null;
  jobsite_address: string | null;
};

type InsertedDocument = {
  id: string;
  document_type: CommercialDocumentType;
};

function documentTypeValue(value: FormDataEntryValue | null): CommercialDocumentType {
  return value === "invoice" ? "invoice" : "quote";
}

function statusValue(value: FormDataEntryValue | null): CommercialDocumentStatus {
  const status = String(value ?? "draft");
  return ["draft", "sent", "accepted", "rejected", "paid", "cancelled"].includes(status)
    ? (status as CommercialDocumentStatus)
    : "draft";
}

async function nextDocumentNumber(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  companyId: string,
  type: CommercialDocumentType
) {
  const year = new Date().getFullYear();
  const prefix = type === "invoice" ? `RE-${year}-` : `AG-${year}-`;
  const { data } = await supabase
    .from("commercial_documents")
    .select("document_number")
    .eq("company_id", companyId)
    .like("document_number", `${prefix}%`)
    .order("document_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const lastNumber = Number(String(data?.document_number ?? "").replace(prefix, "")) || 0;
  return `${prefix}${String(lastNumber + 1).padStart(4, "0")}`;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function customerSnapshot(customer: Customer): CustomerSnapshot {
  return {
    name: customerDisplayName(customer),
    email: customer.email,
    phone: customer.phone,
    billing_address: customer.billing_address,
    jobsite_address: customer.jobsite_address
  };
}

function itemRowsFromRequirements({
  documentId,
  companyId,
  requirements
}: {
  documentId: string;
  companyId: string;
  requirements: JobMaterialRequirement[];
}) {
  return requirements.map((item, index) => ({
    company_id: companyId,
    document_id: documentId,
    source_requirement_id: item.id,
    position: index + 1,
    title: item.material_name,
    description: item.location_name ? `Lagerort: ${item.location_name}` : null,
    quantity: item.total_quantity,
    unit: item.unit,
    unit_price_net: Number(item.sales_price ?? 0),
    discount_percent: 0
  }));
}

export async function createCommercialDocumentFromOrderAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const type = documentTypeValue(formData.get("document_type"));

  try {
    const orderSelect =
      "id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, priority, jobsite_address, start_date, end_date, description, internal_notes, assigned_employee_ids, has_dimensions, created_by, created_at, updated_at, customers(id, company, first_name, last_name, contact_person, phone, email, billing_address, jobsite_address, notes, tax_id, payment_terms, status, customer_type, created_by, created_at, updated_at)";
    const [orderResult, requirementsResult] = await Promise.all([
      supabase.from("orders").select(orderSelect).eq("id", orderId).eq("company_id", context.companyId).single(),
      supabase
        .from("job_material_requirements")
        .select(
          "id, company_id, order_id, dimension_id, jobsite_id, rule_id, catalog_item_id, inventory_item_id, material_name, unit, base_quantity, waste_percent, waste_quantity, total_quantity, purchase_price, sales_price, purchase_total, sales_total, margin_total, location_name, stock, minimum_stock, archived_at, created_at"
        )
        .eq("order_id", orderId)
        .eq("company_id", context.companyId)
        .is("archived_at", null)
        .order("created_at", { ascending: true })
    ]);

    if (orderResult.error || !orderResult.data) throw new SafeActionError("Auftrag wurde nicht gefunden.");
    const order = orderResult.data as unknown as Order & { customers: Customer | null };
    if (!order.customers) throw new SafeActionError("Zum Auftrag fehlt der Kunde.");

    const documentNumber = await nextDocumentNumber(supabase, context.companyId, type);
    const issueDate = new Date().toISOString().slice(0, 10);
    const documentResult = await supabase
      .from("commercial_documents")
      .insert({
        company_id: context.companyId,
        order_id: order.id,
        customer_id: order.customer_id,
        jobsite_id: order.jobsite_id,
        document_type: type,
        document_number: documentNumber,
        status: "draft",
        subject: optionalString(formData, "subject") ?? `${type === "invoice" ? "Rechnung" : "Angebot"} ${order.title}`,
        customer_snapshot: customerSnapshot(order.customers),
        issue_date: optionalDate(formData, "issue_date") ?? issueDate,
        due_date: type === "invoice" ? (optionalDate(formData, "due_date") ?? addDays(14)) : null,
        valid_until: type === "quote" ? (optionalDate(formData, "valid_until") ?? addDays(30)) : null,
        tax_rate: optionalNumber(formData, "tax_rate") ?? 19,
        notes: optionalString(formData, "notes"),
        payment_terms: optionalString(formData, "payment_terms") ?? order.customers.payment_terms,
        created_by: context.userId
      })
      .select("id, document_type")
      .single();

    if (documentResult.error || !documentResult.data) throw new SafeActionError("Dokument konnte nicht angelegt werden.");
    const document = documentResult.data as InsertedDocument;
    const requirements = (requirementsResult.data ?? []) as unknown as JobMaterialRequirement[];
    const rows = itemRowsFromRequirements({
      documentId: document.id,
      companyId: context.companyId,
      requirements
    });

    if (rows.length > 0) {
      const { error } = await supabase.from("commercial_document_items").insert(rows);
      if (error) throw new SafeActionError("Dokument wurde angelegt, aber Positionen konnten nicht uebernommen werden.");
    } else {
      const { error } = await supabase.from("commercial_document_items").insert({
        company_id: context.companyId,
        document_id: document.id,
        position: 1,
        title: order.title,
        description: "Pauschalposition aus Auftrag. Bitte Preis und Leistungsbeschreibung pruefen.",
        quantity: 1,
        unit: "Pauschal",
        unit_price_net: 0,
        discount_percent: 0
      });
      if (error) throw new SafeActionError("Dokument wurde angelegt, aber die Pauschalposition konnte nicht erstellt werden.");
    }

    await supabase.rpc("recalculate_commercial_document_totals", { p_document_id: document.id });
    if (type === "quote") {
      await supabase.from("orders").update({ status: "angebot" }).eq("id", order.id).eq("company_id", context.companyId);
    }

    revalidatePath("/angebote-rechnungen");
    revalidatePath(`/orders/${order.id}`);
    redirect(`/angebote-rechnungen/${document.id}?success=${toQuery(type === "invoice" ? "Rechnung wurde vorbereitet." : "Angebot wurde vorbereitet.")}`);
  } catch (error) {
    redirect(`/orders/${orderId}?error=${toQuery(safeErrorMessage(error, "Dokument konnte nicht vorbereitet werden."))}`);
  }
}

export async function updateCommercialDocumentStatusAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const documentId = requiredFormUuid(formData, "document_id", "Dokument");
  const status = statusValue(formData.get("status"));
  const now = new Date().toISOString();
  const timestampPatch = {
    sent_at: status === "sent" ? now : undefined,
    accepted_at: status === "accepted" ? now : undefined,
    paid_at: status === "paid" ? now : undefined
  };
  const patch = Object.fromEntries(Object.entries({ status, ...timestampPatch }).filter(([, value]) => value !== undefined));

  const { data, error } = await supabase
    .from("commercial_documents")
    .update(patch)
    .eq("id", documentId)
    .eq("company_id", context.companyId)
    .select(commercialDocumentListSelect)
    .single();

  if (error || !data) {
    redirect(`/angebote-rechnungen/${documentId}?error=${toQuery("Status konnte nicht gespeichert werden.")}`);
  }

  revalidatePath("/angebote-rechnungen");
  revalidatePath(`/angebote-rechnungen/${documentId}`);
  redirect(`/angebote-rechnungen/${documentId}?success=${toQuery("Dokumentstatus gespeichert.")}`);
}

export async function archiveCommercialDocumentAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const documentId = requiredFormUuid(formData, "document_id", "Dokument");
  const { error } = await supabase
    .from("commercial_documents")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("company_id", context.companyId);

  if (error) {
    redirect(`/angebote-rechnungen/${documentId}?error=${toQuery("Dokument konnte nicht archiviert werden.")}`);
  }

  revalidatePath("/angebote-rechnungen");
  redirect(`/angebote-rechnungen?success=${toQuery("Dokument wurde archiviert.")}`);
}
