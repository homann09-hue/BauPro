import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { pageParam, pageRange, searchOrFilter, stringParam, totalPages, type SearchParamsRecord } from "@/lib/data/shared";
import { invoiceItemSelect, invoiceListSelect } from "@/lib/data/selects";
import type { Invoice, InvoiceItem, InvoiceStatus, InvoiceType } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const invoicePageSize = 12;

export const invoiceTypeLabels: Record<InvoiceType, string> = {
  angebot: "Angebot",
  rechnung: "Rechnung",
  gutschrift: "Gutschrift"
};

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  entwurf: "Entwurf",
  gesendet: "Gesendet",
  bezahlt: "Bezahlt",
  storniert: "Storniert"
};

export const invoiceTypeFilters: Array<{ value: "alle" | InvoiceType; label: string }> = [
  { value: "alle", label: "Alle Belege" },
  { value: "angebot", label: "Angebote" },
  { value: "rechnung", label: "Rechnungen" },
  { value: "gutschrift", label: "Gutschriften" }
];

export const invoiceStatusFilters: Array<{ value: "alle" | InvoiceStatus; label: string }> = [
  { value: "alle", label: "Alle Status" },
  { value: "entwurf", label: "Entwurf" },
  { value: "gesendet", label: "Gesendet" },
  { value: "bezahlt", label: "Bezahlt" },
  { value: "storniert", label: "Storniert" }
];

function parseInvoiceType(value: string): "alle" | InvoiceType {
  return value === "angebot" || value === "rechnung" || value === "gutschrift" ? value : "alle";
}

function parseInvoiceStatus(value: string): "alle" | InvoiceStatus {
  return value === "entwurf" || value === "gesendet" || value === "bezahlt" || value === "storniert" ? value : "alle";
}

export function parseInvoiceListParams(params: SearchParamsRecord) {
  const page = pageParam(params);
  const { from, to } = pageRange(page, invoicePageSize);

  return {
    search: stringParam(params, "q").slice(0, 80),
    selectedType: parseInvoiceType(stringParam(params, "type")),
    selectedStatus: parseInvoiceStatus(stringParam(params, "status")),
    page,
    from,
    to
  };
}

export function invoiceHref({
  q,
  type,
  status,
  page
}: {
  q?: string;
  type?: "alle" | InvoiceType;
  status?: "alle" | InvoiceStatus;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type && type !== "alle") params.set("type", type);
  if (status && status !== "alle") params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/invoices?${query}` : "/invoices";
}

function invoiceStatsFromRpc(data: unknown) {
  const value = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
  return {
    open: Number(value.open_count ?? 0),
    paid: Number(value.paid_count ?? 0),
    totalGross: Number(value.total_gross ?? 0)
  };
}

export async function loadInvoiceList({
  supabase,
  companyId,
  params
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  params: SearchParamsRecord;
}) {
  const parsed = parseInvoiceListParams(params);
  let query = supabase
    .from("invoices")
    .select(invoiceListSelect, { count: "exact" })
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("issue_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(parsed.from, parsed.to);

  if (parsed.selectedType !== "alle") query = query.eq("type", parsed.selectedType);
  if (parsed.selectedStatus !== "alle") query = query.eq("status", parsed.selectedStatus);
  if (parsed.search) query = query.or(searchOrFilter(["invoice_number", "notes"], parsed.search));

  const [invoicesResult, statsResult] = await Promise.all([
    query,
    supabase.rpc("get_invoice_stats", { p_company_id: companyId })
  ]);

  const invoices = (invoicesResult.data ?? []) as unknown as Invoice[];
  const totalCount = invoicesResult.count ?? invoices.length;
  const stats = invoiceStatsFromRpc(statsResult.data);

  return {
    ...parsed,
    invoices,
    totalCount,
    totalPages: totalPages(totalCount, invoicePageSize),
    error: invoicesResult.error || statsResult.error,
    counts: {
      open: stats.open,
      paid: stats.paid,
      totalGross: stats.totalGross
    }
  };
}

export async function loadInvoiceDetail({
  supabase,
  companyId,
  id
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  id: string;
}) {
  const [invoiceResult, itemsResult] = await Promise.all([
    supabase
      .from("invoices")
      .select(invoiceListSelect)
      .eq("id", id)
      .eq("company_id", companyId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("invoice_items")
      .select(invoiceItemSelect)
      .eq("invoice_id", id)
      .is("archived_at", null)
      .order("position", { ascending: true })
  ]);

  return {
    invoice: invoiceResult.data as unknown as Invoice | null,
    items: (itemsResult.data ?? []) as unknown as InvoiceItem[],
    error: invoiceResult.error || itemsResult.error
  };
}
