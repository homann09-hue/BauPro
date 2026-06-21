import { getOptionalAppContext } from "@/lib/auth";
import { buildOrderQuotePdf, orderQuoteFilename, type OrderQuoteEstimate, type OrderQuotePdfData } from "@/lib/order-quote-export";
import { downloadHeaders } from "@/lib/security/downloads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Company, Customer, Order } from "@/types/app";

type QuoteOrderRow = Pick<
  Order,
  "id" | "order_number" | "title" | "jobsite_address" | "description" | "start_date" | "created_at"
> & {
  customers: Pick<
    Customer,
    "id" | "company" | "first_name" | "last_name" | "contact_person" | "phone" | "email" | "billing_address" | "jobsite_address" | "payment_terms"
  > | null;
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context || !context.canManage) return new Response("Keine Berechtigung", { status: 403 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const orderSelect =
    "id, order_number, title, jobsite_address, description, start_date, created_at, customers(id, company, first_name, last_name, contact_person, phone, email, billing_address, jobsite_address, payment_terms)";
  const estimateSelect =
    "id, company_id, job_id, material_vk_total, labor_total_net, subtotal_net, vat_rate, vat_total, total_gross, price_source_summary, job_estimate_items(id, description, quantity, unit, vk_total, notes)";

  const [{ data: companyData }, orderResult, estimateResult] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, address, contact_email, phone, tax_id, payment_terms")
      .eq("id", context.companyId)
      .single(),
    supabase
      .from("orders")
      .select(orderSelect)
      .eq("id", id)
      .eq("company_id", context.companyId)
      .single(),
    supabase
      .from("job_estimates")
      .select(estimateSelect)
      .eq("company_id", context.companyId)
      .eq("job_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (orderResult.error || !orderResult.data) return new Response("Auftrag wurde nicht gefunden.", { status: 404 });
  if (estimateResult.error || !estimateResult.data) {
    return new Response("Für diesen Auftrag ist noch keine Kalkulation gespeichert.", { status: 404 });
  }

  const data: OrderQuotePdfData = {
    company: (companyData as Pick<Company, "id" | "name" | "address" | "contact_email" | "phone" | "tax_id" | "payment_terms"> | null) ?? {
      id: context.companyId,
      name: context.companyName,
      address: null,
      contact_email: null,
      phone: null,
      tax_id: null,
      payment_terms: null
    },
    order: orderResult.data as unknown as QuoteOrderRow,
    estimate: estimateResult.data as unknown as OrderQuoteEstimate,
    generatedAt: new Date().toISOString()
  };
  const pdf = buildOrderQuotePdf(data);

  return new Response(new Uint8Array(pdf), {
    headers: downloadHeaders("application/pdf", orderQuoteFilename(data))
  });
}
