import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { pageParam, pageRange, searchOrFilter, stringParam, totalPages, type SearchParamsRecord } from "@/lib/data/shared";
import { commercialDocumentItemSelect, commercialDocumentListSelect } from "@/lib/data/selects";
import type { CommercialDocument, CommercialDocumentItem, CommercialDocumentStatus, CommercialDocumentType } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const commercialDocumentPageSize = 12;

export const commercialDocumentTypeLabels: Record<CommercialDocumentType, string> = {
  quote: "Angebot",
  invoice: "Rechnung"
};

export const commercialDocumentStatusLabels: Record<CommercialDocumentStatus, string> = {
  draft: "Entwurf",
  sent: "Gesendet",
  accepted: "Angenommen",
  rejected: "Abgelehnt",
  paid: "Bezahlt",
  cancelled: "Storniert"
};

export const commercialDocumentStatusFilters: Array<{ value: "alle" | CommercialDocumentStatus; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "draft", label: "Entwurf" },
  { value: "sent", label: "Gesendet" },
  { value: "accepted", label: "Angenommen" },
  { value: "paid", label: "Bezahlt" },
  { value: "rejected", label: "Abgelehnt" },
  { value: "cancelled", label: "Storniert" }
];

function parseType(value: string): "alle" | CommercialDocumentType {
  return value === "quote" || value === "invoice" ? value : "alle";
}

function parseStatus(value: string): "alle" | CommercialDocumentStatus {
  return ["draft", "sent", "accepted", "rejected", "paid", "cancelled"].includes(value)
    ? (value as CommercialDocumentStatus)
    : "alle";
}

export function parseCommercialDocumentListParams(params: SearchParamsRecord) {
  const page = pageParam(params);
  const { from, to } = pageRange(page, commercialDocumentPageSize);

  return {
    search: stringParam(params, "q").slice(0, 80),
    selectedType: parseType(stringParam(params, "type")),
    selectedStatus: parseStatus(stringParam(params, "status")),
    page,
    from,
    to
  };
}

export function commercialDocumentHref({
  q,
  type,
  status,
  page
}: {
  q?: string;
  type?: "alle" | CommercialDocumentType;
  status?: "alle" | CommercialDocumentStatus;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (type && type !== "alle") params.set("type", type);
  if (status && status !== "alle") params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/angebote-rechnungen?${query}` : "/angebote-rechnungen";
}

export async function loadCommercialDocumentList({
  supabase,
  companyId,
  params
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  params: SearchParamsRecord;
}) {
  const parsed = parseCommercialDocumentListParams(params);
  let query = supabase
    .from("commercial_documents")
    .select(commercialDocumentListSelect, { count: "exact" })
    .eq("company_id", companyId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .range(parsed.from, parsed.to);

  if (parsed.selectedType !== "alle") query = query.eq("document_type", parsed.selectedType);
  if (parsed.selectedStatus !== "alle") query = query.eq("status", parsed.selectedStatus);
  if (parsed.search) {
    query = query.or(searchOrFilter(["document_number", "subject"], parsed.search));
  }

  const [documentsResult, quoteCountResult, invoiceCountResult, openCountResult, paidCountResult] = await Promise.all([
    query,
    supabase
      .from("commercial_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("document_type", "quote")
      .is("archived_at", null),
    supabase
      .from("commercial_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("document_type", "invoice")
      .is("archived_at", null),
    supabase
      .from("commercial_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .in("status", ["draft", "sent"])
      .is("archived_at", null),
    supabase
      .from("commercial_documents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "paid")
      .is("archived_at", null)
  ]);

  const documents = (documentsResult.data ?? []) as unknown as CommercialDocument[];
  const totalCount = documentsResult.count ?? documents.length;

  return {
    ...parsed,
    documents,
    totalCount,
    totalPages: totalPages(totalCount, commercialDocumentPageSize),
    error: documentsResult.error,
    counts: {
      quotes: quoteCountResult.count ?? 0,
      invoices: invoiceCountResult.count ?? 0,
      open: openCountResult.count ?? 0,
      paid: paidCountResult.count ?? 0
    }
  };
}

export async function loadCommercialDocumentDetail({
  supabase,
  companyId,
  id
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  id: string;
}) {
  const [documentResult, itemResult] = await Promise.all([
    supabase
      .from("commercial_documents")
      .select(commercialDocumentListSelect)
      .eq("id", id)
      .eq("company_id", companyId)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("commercial_document_items")
      .select(commercialDocumentItemSelect)
      .eq("document_id", id)
      .eq("company_id", companyId)
      .order("position", { ascending: true })
  ]);

  return {
    document: documentResult.data as unknown as CommercialDocument | null,
    items: (itemResult.data ?? []) as unknown as CommercialDocumentItem[],
    error: documentResult.error || itemResult.error
  };
}
