import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { postgrestTimeoutResponse, withQueryTimeout } from "@/lib/performance/observability";
import { pageParam, pageRange, searchOrFilter, stringParam, totalPages, type SearchParamsRecord } from "@/lib/data/shared";
import type { Customer, CustomerStatus, CustomerType } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const customerPageSize = 12;
export const customerStatusFilters: Array<{ value: "alle" | CustomerStatus; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "aktiv", label: "Aktiv" },
  { value: "inaktiv", label: "Inaktiv" }
];
export const customerTypeFilters: Array<{ value: "alle" | CustomerType; label: string }> = [
  { value: "alle", label: "Alle Typen" },
  { value: "privatkunde", label: "Privat" },
  { value: "gewerbekunde", label: "Gewerbe" },
  { value: "hausverwaltung", label: "Verwaltung" },
  { value: "architekt", label: "Architekt" },
  { value: "versicherung", label: "Versicherung" }
];

const customerSelect =
  "id, company_id, customer_type, company, first_name, last_name, contact_person, phone, email, billing_address, jobsite_address, notes, tax_id, payment_terms, status, created_by, created_at, updated_at";

export function parseCustomerListParams(params: SearchParamsRecord) {
  const rawStatus = stringParam(params, "status");
  const rawType = stringParam(params, "type");
  const selectedStatus: "alle" | CustomerStatus = rawStatus === "aktiv" || rawStatus === "inaktiv" ? rawStatus : "alle";
  const selectedType: "alle" | CustomerType = ["privatkunde", "gewerbekunde", "hausverwaltung", "architekt", "versicherung"].includes(rawType)
    ? (rawType as CustomerType)
    : "alle";
  const page = pageParam(params);
  const { from, to } = pageRange(page, customerPageSize);

  return {
    search: stringParam(params, "q").slice(0, 80),
    selectedStatus,
    selectedType,
    page,
    from,
    to
  };
}

export function customerHref({
  q,
  status,
  type,
  page
}: {
  q?: string;
  status?: "alle" | CustomerStatus;
  type?: "alle" | CustomerType;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status && status !== "alle") params.set("status", status);
  if (type && type !== "alle") params.set("type", type);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/customers?${query}` : "/customers";
}

export async function loadCustomerList({
  supabase,
  companyId,
  params
}: {
  supabase: SupabaseServerClient;
  companyId: string;
  params: SearchParamsRecord;
}) {
  const parsed = parseCustomerListParams(params);
  let customersQuery = supabase
    .from("customers")
    .select(customerSelect, { count: "exact" })
    .eq("company_id", companyId)
    .order("updated_at", { ascending: false })
    .range(parsed.from, parsed.to);

  if (parsed.selectedStatus !== "alle") customersQuery = customersQuery.eq("status", parsed.selectedStatus);
  if (parsed.selectedType !== "alle") customersQuery = customersQuery.eq("customer_type", parsed.selectedType);
  if (parsed.search) {
    customersQuery = customersQuery.or(
      searchOrFilter(["company", "first_name", "last_name", "contact_person", "phone", "email", "billing_address", "jobsite_address"], parsed.search)
    );
  }

  const [customersResult, activeCountResult, commercialCountResult, privateCountResult] = await Promise.all([
    withQueryTimeout(() => customersQuery, {
      route: "customers",
      action: "customers.page",
      timeoutMs: 4_500,
      fallback: () => postgrestTimeoutResponse("Timeout bei customer.list")
    }),
    withQueryTimeout(() => supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "aktiv"), {
      route: "customers",
      action: "customers.count.active",
      timeoutMs: 1_900,
      fallback: () => postgrestTimeoutResponse("Timeout bei customer.count.active")
    }),
    withQueryTimeout(
      () => supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("customer_type", "gewerbekunde"),
      {
        route: "customers",
        action: "customers.count.gewerbekunde",
        timeoutMs: 1_900,
        fallback: () => postgrestTimeoutResponse("Timeout bei customer.count.gewerkegkunde")
      }
    ),
    withQueryTimeout(
      () => supabase.from("customers").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("customer_type", "privatkunde"),
      {
        route: "customers",
        action: "customers.count.privatkunde",
        timeoutMs: 1_900,
        fallback: () => postgrestTimeoutResponse("Timeout bei customer.count.privatkunde")
      }
    )
  ]);

  const customers = (customersResult.data ?? []) as unknown as Customer[];
  const totalCount = customersResult.count ?? customers.length;

  return {
    ...parsed,
    customers,
    totalCount,
    totalPages: totalPages(totalCount, customerPageSize),
    error: customersResult.error,
    counts: {
      active: activeCountResult.count ?? 0,
      commercial: commercialCountResult.count ?? 0,
      private: privateCountResult.count ?? 0
    }
  };
}
