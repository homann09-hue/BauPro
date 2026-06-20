import Link from "next/link";
import { CalendarDays, Clock3, Hammer } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireAppContext } from "@/lib/auth";
import { calendarOrderSelect, calendarTimeEntrySelect, jobsiteFormSelect } from "@/lib/data/selects";
import { customerDisplayName, orderStatusLabels } from "@/lib/order-labels";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Jobsite, Order, TimeEntry } from "@/types/app";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function isoInDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function orderCustomer(order: Order) {
  return order.customers ? customerDisplayName(order.customers) : "Kunde";
}

export default async function CalendarPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const today = isoToday();
  const dateTo = isoInDays(21);
  const jobsitesPromise = (
    context.canManage
      ? supabase.from("jobsites").select(jobsiteFormSelect).eq("company_id", context.companyId)
      : supabase
          .from("jobsites")
          .select(jobsiteFormSelect)
          .eq("company_id", context.companyId)
          .contains("assigned_employee_ids", [context.userId])
  )
    .in("status", ["geplant", "aktiv"])
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(30);
  const timeEntriesPromise = (
    context.canManage
      ? supabase.from("time_entries").select(calendarTimeEntrySelect).eq("company_id", context.companyId)
      : supabase
          .from("time_entries")
          .select(calendarTimeEntrySelect)
          .eq("company_id", context.companyId)
          .eq("employee_id", context.userId)
  )
    .gte("date", today)
    .lte("date", dateTo)
    .order("date", { ascending: true })
    .limit(30);

  const [ordersResult, jobsitesResult, timeResult] = await Promise.all([
    context.canManage
      ? supabase
          .from("orders")
          .select(calendarOrderSelect)
          .eq("company_id", context.companyId)
          .gte("start_date", today)
          .lte("start_date", dateTo)
          .order("start_date", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    jobsitesPromise,
    timeEntriesPromise
  ]);

  const orders = (ordersResult.data ?? []) as unknown as Order[];
  const jobsites = (jobsitesResult.data ?? []) as Jobsite[];
  const timeEntries = (timeResult.data ?? []) as unknown as TimeEntry[];
  const hasContent = orders.length + jobsites.length + timeEntries.length > 0;

  return (
    <>
      <PageHeader title="Kalender" description="Die nächsten Einsätze, Starttermine und Zeitfreigaben im Überblick." />
      <MessageBox
        error={
          error ||
          safeQueryErrorMessage(ordersResult.error) ||
          safeQueryErrorMessage(jobsitesResult.error) ||
          safeQueryErrorMessage(timeResult.error)
        }
        success={success}
      />

      {!hasContent ? (
        <EmptyState
          icon={CalendarDays}
          title="Keine Termine in den nächsten 21 Tagen"
          description="Sobald Aufträge, Baustellen oder Arbeitszeiten geplant sind, erscheint hier die operative Tagesliste."
          actionHref={context.canManage ? "/orders/new" : undefined}
          actionLabel={context.canManage ? "Auftrag anlegen" : undefined}
        />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <section className="surface p-4 sm:p-5">
            <h2 className="section-title">Aufträge</h2>
            <div className="mt-4 grid gap-3">
              {orders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="rounded-lg border border-line bg-white p-4 transition hover:border-moss/30">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="meta-label">{formatDate(order.start_date)}</p>
                      <h3 className="mt-1 font-black text-ink">{order.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{orderCustomer(order)} · {order.jobsite_address}</p>
                    </div>
                    <StatusBadge value={order.status} label={orderStatusLabels[order.status]} />
                  </div>
                </Link>
              ))}
              {orders.length === 0 ? <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">Keine Auftragsstarts im Zeitraum.</p> : null}
            </div>
          </section>

          <section className="grid gap-5">
            <div className="surface p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <Hammer className="h-5 w-5 text-moss" aria-hidden="true" />
                <h2 className="section-title">Baustellen</h2>
              </div>
              <div className="grid gap-3">
                {jobsites.map((jobsite) => (
                  <Link key={jobsite.id} href={`/baustellen/${jobsite.id}`} className="rounded-lg border border-line bg-white p-3">
                    <p className="font-black text-ink">{jobsite.name}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatDate(jobsite.start_date)} · {jobsite.address}</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="surface p-4 sm:p-5">
              <div className="mb-4 flex items-center gap-2">
                <Clock3 className="h-5 w-5 text-moss" aria-hidden="true" />
                <h2 className="section-title">Zeiten</h2>
              </div>
              <div className="grid gap-3">
                {timeEntries.map((entry) => (
                  <Link key={entry.id} href="/time-tracking" className="rounded-lg border border-line bg-white p-3">
                    <p className="font-black text-ink">{entry.jobsites?.name ?? entry.work_location}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatDate(entry.date)} · {entry.profiles?.full_name ?? entry.profiles?.email ?? "Mitarbeiter"}</p>
                  </Link>
                ))}
                {timeEntries.length === 0 ? <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">Keine Zeiten im Zeitraum.</p> : null}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
