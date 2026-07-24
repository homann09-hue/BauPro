"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireManager } from "@/lib/auth";
import { SafeActionError, safeErrorMessage, toQuery } from "@/lib/security/errors";
import { requiredFormUuid } from "@/lib/security/form-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Invoice, InvoiceItem, InvoiceStatus, InvoiceType, JobMaterialRequirement, Order } from "@/types/app";

const invoiceSchema = z.object({
  type: z.enum(["angebot", "rechnung", "gutschrift"]),
  customer_id: z.string().uuid(),
  order_id: z.string().uuid().nullable(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  tax_rate_percent: z.coerce.number().refine((value) => [0, 7, 19].includes(value), "MwSt. muss 0, 7 oder 19 Prozent sein."),
  notes: z.string().trim().max(4000).nullable()
});

type InvoiceInput = z.infer<typeof invoiceSchema>;
type InvoiceItemInput = ReturnType<typeof parseItems>[number];
type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function formString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function nullableFormString(formData: FormData, key: string) {
  const value = formString(formData, key);
  return value || null;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function parseInvoiceInput(formData: FormData): InvoiceInput {
  const type = formString(formData, "type") || "rechnung";
  return invoiceSchema.parse({
    type,
    customer_id: formString(formData, "customer_id"),
    order_id: nullableFormString(formData, "order_id"),
    issue_date: formString(formData, "issue_date") || todayIsoDate(),
    due_date: nullableFormString(formData, "due_date") ?? (type === "rechnung" ? addDays(14) : null),
    tax_rate_percent: formString(formData, "tax_rate_percent") || "19",
    notes: nullableFormString(formData, "notes")
  });
}

function parseItems(formData: FormData) {
  const descriptions = formData.getAll("item_description");
  const quantities = formData.getAll("item_quantity");
  const units = formData.getAll("item_unit");
  const unitPrices = formData.getAll("item_unit_price_eur");

  const items = descriptions
    .map((value, index) => ({
      description: typeof value === "string" ? value.trim() : "",
      quantity: Number(String(quantities[index] ?? "1").replace(",", ".")),
      unit: typeof units[index] === "string" && String(units[index]).trim() ? String(units[index]).trim() : "Stueck",
      unit_price_eur: Number(String(unitPrices[index] ?? "0").replace(",", ".")),
      position: index + 1
    }))
    .filter((item) => item.description.length > 0);

  if (items.length === 0) throw new SafeActionError("Bitte mindestens eine Position erfassen.");

  for (const item of items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) throw new SafeActionError("Mengen müssen größer als 0 sein.");
    if (!Number.isFinite(item.unit_price_eur) || item.unit_price_eur < 0) throw new SafeActionError("Einzelpreise duerfen nicht negativ sein.");
  }

  return items;
}

function assertInvoiceRpcId(data: unknown, message: string) {
  if (typeof data !== "string" || !data) throw new SafeActionError(message);
  return data;
}

async function createInvoiceWithItems({
  supabase,
  context,
  input,
  items
}: {
  supabase: SupabaseServerClient;
  context: Awaited<ReturnType<typeof requireManager>>;
  input: InvoiceInput;
  items: InvoiceItemInput[];
}) {
  const { data, error } = await supabase.rpc("create_invoice_with_items", {
    p_company_id: context.companyId,
    p_customer_id: input.customer_id,
    p_order_id: input.order_id,
    p_type: input.type,
    p_issue_date: input.issue_date,
    p_due_date: input.due_date,
    p_tax_rate_percent: input.tax_rate_percent,
    p_notes: input.notes,
    p_created_by: context.userId,
    p_items: items
  });

  if (error) throw new SafeActionError("Beleg konnte nicht angelegt werden.");
  return assertInvoiceRpcId(data, "Beleg konnte nicht angelegt werden.");
}

async function updateInvoiceWithItems({
  supabase,
  context,
  invoiceId,
  input,
  items
}: {
  supabase: SupabaseServerClient;
  context: Awaited<ReturnType<typeof requireManager>>;
  invoiceId: string;
  input: InvoiceInput;
  items: InvoiceItemInput[];
}) {
  const { data, error } = await supabase.rpc("update_invoice_with_items", {
    p_invoice_id: invoiceId,
    p_company_id: context.companyId,
    p_customer_id: input.customer_id,
    p_order_id: input.order_id,
    p_type: input.type,
    p_issue_date: input.issue_date,
    p_due_date: input.due_date,
    p_tax_rate_percent: input.tax_rate_percent,
    p_notes: input.notes,
    p_items: items
  });

  if (error) throw new SafeActionError("Beleg konnte nicht aktualisiert werden.");
  return assertInvoiceRpcId(data, "Beleg konnte nicht aktualisiert werden.");
}

function invoiceErrorTarget(path: string, error: unknown) {
  return `${path}?error=${toQuery(safeErrorMessage(error, "Beleg konnte nicht gespeichert werden."))}`;
}

async function assertCustomerAndOrder(input: InvoiceInput, companyId: string) {
  const supabase = await createSupabaseServerClient();
  const [customerResult, orderResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id")
      .eq("id", input.customer_id)
      .eq("company_id", companyId)
      .maybeSingle(),
    input.order_id
      ? supabase
          .from("orders")
          .select("id, customer_id")
          .eq("id", input.order_id)
          .eq("company_id", companyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  if (customerResult.error || !customerResult.data) throw new SafeActionError("Kunde wurde nicht gefunden.");
  if (input.order_id) {
    if (orderResult.error || !orderResult.data) throw new SafeActionError("Auftrag wurde nicht gefunden.");
    if (orderResult.data.customer_id !== input.customer_id) {
      throw new SafeActionError("Der ausgewaehlte Auftrag gehoert nicht zu diesem Kunden.");
    }
  }
}

export async function createInvoiceAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  let target = "/invoices/new";

  try {
    const input = parseInvoiceInput(formData);
    const items = parseItems(formData);
    await assertCustomerAndOrder(input, context.companyId);
    const invoiceId = await createInvoiceWithItems({ supabase, context, input, items });
    revalidatePath("/invoices");
    target = `/invoices/${invoiceId}?success=${toQuery("Beleg wurde angelegt.")}`;
  } catch (error) {
    target = invoiceErrorTarget("/invoices/new", error);
  }

  redirect(target);
}

export async function updateInvoiceAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const invoiceId = requiredFormUuid(formData, "invoice_id", "Beleg");
  let target = `/invoices/${invoiceId}/edit`;

  try {
    const input = parseInvoiceInput(formData);
    const items = parseItems(formData);
    await assertCustomerAndOrder(input, context.companyId);
    await updateInvoiceWithItems({ supabase, context, invoiceId, input, items });
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    target = `/invoices/${invoiceId}?success=${toQuery("Beleg wurde aktualisiert.")}`;
  } catch (error) {
    target = invoiceErrorTarget(`/invoices/${invoiceId}/edit`, error);
  }

  redirect(target);
}

function canChangeStatus(current: InvoiceStatus, next: InvoiceStatus) {
  if (current === next) return true;
  if (next === "storniert") return current !== "storniert";
  if (current === "entwurf") return next === "gesendet";
  if (current === "gesendet") return next === "bezahlt";
  return false;
}

export async function updateInvoiceStatusAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const invoiceId = requiredFormUuid(formData, "invoice_id", "Beleg");
  const nextStatus = formString(formData, "status") as InvoiceStatus;
  let target = `/invoices/${invoiceId}`;

  try {
    if (!["entwurf", "gesendet", "bezahlt", "storniert"].includes(nextStatus)) {
      throw new SafeActionError("Ungueltiger Status.");
    }

    const currentResult = await supabase
      .from("invoices")
      .select("id, status")
      .eq("id", invoiceId)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .maybeSingle();
    const current = currentResult.data as Pick<Invoice, "id" | "status"> | null;
    if (currentResult.error || !current) throw new SafeActionError("Beleg wurde nicht gefunden.");
    if (!canChangeStatus(current.status, nextStatus)) throw new SafeActionError("Dieser Statuswechsel ist nicht erlaubt.");

    const { error } = await supabase.from("invoices").update({ status: nextStatus }).eq("id", invoiceId).eq("company_id", context.companyId);
    if (error) throw new SafeActionError("Status konnte nicht gespeichert werden.");

    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
    target = `/invoices/${invoiceId}?success=${toQuery("Status wurde gespeichert.")}`;
  } catch (error) {
    target = `/invoices/${invoiceId}?error=${toQuery(safeErrorMessage(error, "Status konnte nicht gespeichert werden."))}`;
  }

  redirect(target);
}

export async function deleteInvoiceAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const invoiceId = requiredFormUuid(formData, "invoice_id", "Beleg");
  const { data, error } = await supabase
    .from("invoices")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", invoiceId)
    .eq("company_id", context.companyId)
    .eq("status", "entwurf")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirect(`/invoices/${invoiceId}?error=${toQuery("Nur Entwuerfe koennen archiviert werden.")}`);
  }

  revalidatePath("/invoices");
  redirect(`/invoices?success=${toQuery("Entwurf wurde archiviert.")}`);
}

export async function duplicateInvoiceAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const invoiceId = requiredFormUuid(formData, "invoice_id", "Beleg");
  let target = `/invoices/${invoiceId}`;

  try {
    const [invoiceResult, itemsResult] = await Promise.all([
      supabase
        .from("invoices")
        .select("id, company_id, customer_id, order_id, type, status, invoice_number, issue_date, due_date, subtotal_eur, tax_rate_percent, tax_eur, total_eur, notes, created_by, created_at, updated_at, archived_at")
        .eq("id", invoiceId)
        .eq("company_id", context.companyId)
        .is("archived_at", null)
        .maybeSingle(),
      supabase
        .from("invoice_items")
        .select("description, quantity, unit, unit_price_eur, position")
        .eq("invoice_id", invoiceId)
        .is("archived_at", null)
        .order("position")
    ]);
    const invoice = invoiceResult.data as unknown as Invoice | null;
    const items = (itemsResult.data ?? []) as unknown as Array<Pick<InvoiceItem, "description" | "quantity" | "unit" | "unit_price_eur" | "position">>;
    if (invoiceResult.error || itemsResult.error || !invoice) throw new SafeActionError("Beleg wurde nicht gefunden.");

    const invoiceItems: InvoiceItemInput[] =
      items.length > 0
        ? items.map((item, index) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unit: item.unit,
            unit_price_eur: Number(item.unit_price_eur),
            position: item.position ?? index + 1
          }))
        : [
            {
              description: "Pauschalposition",
              quantity: 1,
              unit: "Pauschal",
              unit_price_eur: 0,
              position: 1
            }
          ];

    const copyId = await createInvoiceWithItems({
      supabase,
      context,
      input: {
        type: invoice.type,
        customer_id: invoice.customer_id,
        order_id: invoice.order_id,
        issue_date: todayIsoDate(),
        due_date: invoice.type === "rechnung" ? addDays(14) : invoice.due_date,
        tax_rate_percent: invoice.tax_rate_percent,
        notes: invoice.notes
      },
      items: invoiceItems
    });

    revalidatePath("/invoices");
    target = `/invoices/${copyId}/edit?success=${toQuery("Beleg wurde dupliziert.")}`;
  } catch (error) {
    target = `/invoices/${invoiceId}?error=${toQuery(safeErrorMessage(error, "Beleg konnte nicht dupliziert werden."))}`;
  }

  redirect(target);
}

function invoiceTypeFromOrderForm(formData: FormData): InvoiceType {
  return formString(formData, "document_type") === "quote" ? "angebot" : "rechnung";
}

function orderRequirementItems(requirements: JobMaterialRequirement[], fallbackTitle: string): InvoiceItemInput[] {
  const items = requirements.map((item, index) => ({
    description: item.location_name ? `${item.material_name} (${item.location_name})` : item.material_name,
    quantity: Number(item.total_quantity ?? 0) > 0 ? Number(item.total_quantity) : 1,
    unit: item.unit || "Stueck",
    unit_price_eur: Number(item.sales_price ?? 0),
    position: index + 1
  }));

  return items.length > 0
    ? items
    : [
        {
          description: fallbackTitle,
          quantity: 1,
          unit: "Pauschal",
          unit_price_eur: 0,
          position: 1
        }
      ];
}

export async function createInvoiceFromOrderAction(formData: FormData) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const orderId = requiredFormUuid(formData, "order_id", "Auftrag");
  const type = invoiceTypeFromOrderForm(formData);

  try {
    const [orderResult, requirementsResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id, company_id, customer_id, title, status")
        .eq("id", orderId)
        .eq("company_id", context.companyId)
        .is("archived_at", null)
        .maybeSingle(),
      supabase
        .from("job_material_requirements")
        .select("id, material_name, unit, total_quantity, sales_price, location_name")
        .eq("order_id", orderId)
        .eq("company_id", context.companyId)
        .is("archived_at", null)
        .order("created_at", { ascending: true })
    ]);

    const order = orderResult.data as Pick<Order, "id" | "customer_id" | "title" | "status"> | null;
    const requirements = (requirementsResult.data ?? []) as unknown as JobMaterialRequirement[];
    if (orderResult.error || requirementsResult.error || !order) throw new SafeActionError("Auftrag wurde nicht gefunden.");

    const subject = formString(formData, "subject") || `${type === "angebot" ? "Angebot" : "Rechnung"} ${order.title}`;
    const invoiceId = await createInvoiceWithItems({
      supabase,
      context,
      input: {
        type,
        customer_id: order.customer_id,
        order_id: order.id,
        issue_date: todayIsoDate(),
        due_date: type === "rechnung" ? addDays(14) : null,
        tax_rate_percent: 19,
        notes: subject
      },
      items: orderRequirementItems(requirements, subject)
    });

    if (type === "angebot") {
      await supabase.from("orders").update({ status: "angebot" }).eq("id", order.id).eq("company_id", context.companyId);
    }

    revalidatePath("/invoices");
    revalidatePath(`/orders/${order.id}`);
    redirect(`/invoices/${invoiceId}?success=${toQuery(type === "rechnung" ? "Rechnung wurde vorbereitet." : "Angebot wurde vorbereitet.")}`);
  } catch (error) {
    redirect(`/orders/${orderId}?error=${toQuery(safeErrorMessage(error, "Beleg konnte nicht vorbereitet werden."))}`);
  }
}
