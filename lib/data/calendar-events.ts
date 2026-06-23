import { customerDisplayName, orderStatusLabels } from "@/lib/order-labels";
import { SafeActionError } from "@/lib/security/errors";
import type { AppContext } from "@/lib/auth";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Jobsite, Order, TimeEntry } from "@/types/app";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type CalendarEventKind = "order" | "jobsite" | "time_entry";

export type BauProCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  url?: string;
  backgroundColor?: string;
  borderColor?: string;
  textColor?: string;
  editable?: boolean;
  extendedProps: {
    type: CalendarEventKind;
    sourceId: string;
    status?: string;
    subtitle?: string;
  };
};

export type CalendarEventSummary = {
  orders: number;
  jobsites: number;
  timeEntries: number;
};

export type CalendarEventsResult = {
  events: BauProCalendarEvent[];
  summary: CalendarEventSummary;
};

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function assertIsoDate(value: string, label: string) {
  if (!isoDatePattern.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    throw new SafeActionError(`Bitte ein gueltiges Datum fuer ${label} verwenden.`);
  }

  return value;
}

export function normalizeCalendarRange(from: string, to: string) {
  const start = assertIsoDate(from, "von");
  const end = assertIsoDate(to, "bis");

  if (start > end) {
    throw new SafeActionError("Der Kalenderzeitraum ist ungueltig.");
  }

  return { from: start, to: end };
}

export function calendarRangeAround(date = new Date()) {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0));

  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10)
  };
}

function addOneDay(date: string) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + 1);
  return parsed.toISOString().slice(0, 10);
}

function timeToIso(date: string, time?: string | null) {
  const normalizedTime = (time || "08:00").slice(0, 5);
  return `${date}T${normalizedTime}:00`;
}

function orderCustomer(order: Order) {
  return order.customers ? customerDisplayName(order.customers) : "Kunde";
}

function orderEvent(order: Order, canMove: boolean): BauProCalendarEvent | null {
  if (!order.start_date) return null;

  return {
    id: `order:${order.id}`,
    title: order.title,
    start: order.start_date,
    end: order.end_date ? addOneDay(order.end_date) : undefined,
    allDay: true,
    url: `/orders/${order.id}`,
    backgroundColor: "#2563EB",
    borderColor: "#2563EB",
    textColor: "#FFFFFF",
    editable: canMove,
    extendedProps: {
      type: "order",
      sourceId: order.id,
      status: orderStatusLabels[order.status] ?? order.status,
      subtitle: `${orderCustomer(order)} · ${order.jobsite_address}`
    }
  };
}

function jobsiteEvent(jobsite: Jobsite): BauProCalendarEvent | null {
  if (!jobsite.start_date) return null;

  return {
    id: `jobsite:${jobsite.id}`,
    title: jobsite.name,
    start: jobsite.start_date,
    allDay: true,
    url: `/baustellen/${jobsite.id}`,
    backgroundColor: "#1E1E1C",
    borderColor: "#D4580A",
    textColor: "#F0EBE0",
    editable: false,
    extendedProps: {
      type: "jobsite",
      sourceId: jobsite.id,
      status: jobsite.status,
      subtitle: `${jobsite.customer} · ${jobsite.address}`
    }
  };
}

function timeEntryEvent(entry: TimeEntry): BauProCalendarEvent {
  const person = entry.profiles?.full_name ?? entry.profiles?.email ?? "Mitarbeiter";
  const job = entry.jobsites?.name ?? entry.work_location;

  return {
    id: `time:${entry.id}`,
    title: `${person} · ${job}`,
    start: timeToIso(entry.date, entry.start_time),
    end: timeToIso(entry.date, entry.end_time),
    allDay: false,
    url: "/time-tracking",
    backgroundColor: "#6B7280",
    borderColor: "#6B7280",
    textColor: "#FFFFFF",
    editable: false,
    extendedProps: {
      type: "time_entry",
      sourceId: entry.id,
      status: entry.status,
      subtitle: entry.activity
    }
  };
}

export async function loadCalendarEvents(
  supabase: SupabaseServerClient,
  context: AppContext,
  from: string,
  to: string
): Promise<CalendarEventsResult> {
  const range = normalizeCalendarRange(from, to);

  let ordersQuery = supabase
    .from("orders")
    .select(
      "id, company_id, customer_id, jobsite_id, order_number, title, order_type, status, priority, jobsite_address, start_date, end_date, description, assigned_employee_ids, has_dimensions, created_by, created_at, updated_at, customers(id, company, first_name, last_name, contact_person)"
    )
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .lte("start_date", range.to)
    .or(`end_date.is.null,end_date.gte.${range.from}`)
    .order("start_date", { ascending: true });

  let jobsitesQuery = supabase
    .from("jobsites")
    .select("id, company_id, name, customer, address, start_date, status, notes, assigned_employee_ids, latitude, longitude, weather_last_checked_at, created_at")
    .eq("company_id", context.companyId)
    .in("status", ["geplant", "aktiv"])
    .gte("start_date", range.from)
    .lte("start_date", range.to)
    .order("start_date", { ascending: true, nullsFirst: false });

  let timeEntriesQuery = supabase
    .from("time_entries")
    .select(
      "id, company_id, employee_id, job_id, customer_id, date, work_location, work_address, start_time, end_time, break_minutes, gross_minutes, net_minutes, activity, weather, weather_summary, weather_temperature_c, weather_precipitation_mm, weather_wind_kmh, weather_source, weather_fetched_at, weather_lat, weather_lng, kilometers, notes, status, approved_by, approved_at, created_by, created_at, updated_at, jobsites(id, name, address, customer), profiles!time_entries_employee_id_fkey(id, full_name, email)"
    )
    .eq("company_id", context.companyId)
    .gte("date", range.from)
    .lte("date", range.to)
    .order("date", { ascending: true });

  if (!context.canManage) {
    ordersQuery = ordersQuery.contains("assigned_employee_ids", [context.userId]);
    jobsitesQuery = jobsitesQuery.contains("assigned_employee_ids", [context.userId]);
    timeEntriesQuery = timeEntriesQuery.eq("employee_id", context.userId);
  }

  const [ordersResult, jobsitesResult, timeEntriesResult] = await Promise.all([
    ordersQuery.limit(context.canManage ? 120 : 60),
    jobsitesQuery.limit(context.canManage ? 120 : 60),
    timeEntriesQuery.limit(context.canManage ? 240 : 90)
  ]);

  if (ordersResult.error || jobsitesResult.error || timeEntriesResult.error) {
    throw new SafeActionError("Kalenderdaten konnten nicht geladen werden.");
  }

  const orders = (ordersResult.data ?? []) as unknown as Order[];
  const jobsites = (jobsitesResult.data ?? []) as unknown as Jobsite[];
  const timeEntries = (timeEntriesResult.data ?? []) as unknown as TimeEntry[];

  const events = [
    ...orders.map((order) => orderEvent(order, context.canManage)),
    ...jobsites.map(jobsiteEvent),
    ...timeEntries.map(timeEntryEvent)
  ].filter((event): event is BauProCalendarEvent => Boolean(event));

  return {
    events,
    summary: {
      orders: orders.length,
      jobsites: jobsites.length,
      timeEntries: timeEntries.length
    }
  };
}
