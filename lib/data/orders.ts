import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { pageParam, pageRange, searchOrFilter, stringParam, totalPages, type SearchParamsRecord } from "@/lib/data/shared";
import type { Order, OrderStatus, PublicOrder } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export const orderPageSize = 12;
export const orderStatusFilters: Array<{ value: "alle" | OrderStatus; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "anfrage", label: "Anfrage" },
  { value: "angebot", label: "Angebot" },
  { value: "geplant", label: "Geplant" },
  { value: "in_arbeit", label: "In Arbeit" },
  { value: "fertig", label: "Fertig" }
];

const orderManagerSelect =
  "id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, priority, jobsite_address, start_date, end_date, description, internal_notes, assigned_employee_ids, has_dimensions, created_by, created_at, updated_at, customers(id, company, first_name, last_name, contact_person)";
const orderPublicSelect =
  "id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, priority, jobsite_address, start_date, end_date, description, assigned_employee_ids, has_dimensions, created_by, created_at, updated_at, customer_name";

export function parseOrderListParams(params: SearchParamsRecord) {
  const rawStatus = stringParam(params, "status");
  const selectedStatus: "alle" | OrderStatus = ["anfrage", "angebot", "geplant", "in_arbeit", "fertig", "abgerechnet"].includes(rawStatus)
    ? (rawStatus as OrderStatus)
    : "alle";
  const page = pageParam(params);
  const { from, to } = pageRange(page, orderPageSize);

  return {
    search: stringParam(params, "q").slice(0, 80),
    selectedStatus,
    page,
    from,
    to
  };
}

export function orderHref({
  q,
  status,
  page
}: {
  q?: string;
  status?: "alle" | OrderStatus;
  page?: number;
}) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (status && status !== "alle") params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/orders?${query}` : "/orders";
}

export async function loadOrderList({
  supabase,
  canManage,
  params
}: {
  supabase: SupabaseServerClient;
  canManage: boolean;
  params: SearchParamsRecord;
}) {
  const parsed = parseOrderListParams(params);
  const source = canManage ? "orders" : "orders_public";
  let ordersQuery = supabase
    .from(source)
    .select(canManage ? orderManagerSelect : orderPublicSelect, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(parsed.from, parsed.to);

  if (parsed.selectedStatus !== "alle") ordersQuery = ordersQuery.eq("status", parsed.selectedStatus);
  if (parsed.search) {
    ordersQuery = ordersQuery.or(searchOrFilter(["order_number", "title", "jobsite_address", "description"], parsed.search));
  }

  const [ordersResult, openCountResult, plannedCountResult, activeCountResult, finishedCountResult] = await Promise.all([
    ordersQuery,
    supabase.from(source).select("id", { count: "exact", head: true }).in("status", ["anfrage", "angebot"]),
    supabase.from(source).select("id", { count: "exact", head: true }).eq("status", "geplant"),
    supabase.from(source).select("id", { count: "exact", head: true }).eq("status", "in_arbeit"),
    supabase.from(source).select("id", { count: "exact", head: true }).in("status", ["fertig", "abgerechnet"])
  ]);
  const orders = (ordersResult.data ?? []) as unknown as Array<Order | PublicOrder>;
  const totalCount = ordersResult.count ?? orders.length;

  return {
    ...parsed,
    orders,
    totalCount,
    totalPages: totalPages(totalCount, orderPageSize),
    error: ordersResult.error,
    counts: {
      open: openCountResult.count ?? 0,
      planned: plannedCountResult.count ?? 0,
      active: activeCountResult.count ?? 0,
      finished: finishedCountResult.count ?? 0
    }
  };
}
