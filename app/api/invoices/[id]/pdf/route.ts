import { getOptionalAppContext } from "@/lib/auth";
import { loadInvoiceDetail } from "@/lib/data/invoices";
import { buildInvoicePdf, invoicePdfFilename, type InvoicePdfData } from "@/lib/invoices/invoice-pdf";
import { downloadHeaders } from "@/lib/security/downloads";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Company } from "@/types/app";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getOptionalAppContext();
  if (!context || !context.canManage) return new Response("Keine Berechtigung", { status: 403 });

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: companyData }, detail] = await Promise.all([
    supabase
      .from("companies")
      .select("id, name, address, contact_email, phone, tax_id, payment_terms, logo_path")
      .eq("id", context.companyId)
      .maybeSingle(),
    loadInvoiceDetail({ supabase, companyId: context.companyId, id })
  ]);

  if (!detail.invoice) return new Response("Beleg wurde nicht gefunden.", { status: 404 });

  const company = (companyData as Pick<Company, "id" | "name" | "address" | "contact_email" | "phone" | "tax_id" | "payment_terms" | "logo_path"> | null) ?? {
    id: context.companyId,
    name: context.companyName,
    address: null,
    contact_email: null,
    phone: null,
    tax_id: null,
    payment_terms: null,
    logo_path: null
  };
  let logoUrl: string | null = null;

  if (company.logo_path) {
    const signedLogo = await supabase.storage.from("company-logos").createSignedUrl(company.logo_path, 60);
    logoUrl = signedLogo.data?.signedUrl ?? null;
  }

  const data: InvoicePdfData = {
    company,
    invoice: detail.invoice,
    items: detail.items,
    logoUrl,
    generatedAt: new Date().toISOString()
  };
  const pdf = await buildInvoicePdf(data);

  return new Response(new Uint8Array(pdf), {
    headers: downloadHeaders("application/pdf", invoicePdfFilename(data))
  });
}
