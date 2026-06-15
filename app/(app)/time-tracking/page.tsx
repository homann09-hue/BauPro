import Link from "next/link";
import { CalendarDays, Clock3, Download, FileText, Plus, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { setTimeEntryStatusAction } from "@/lib/actions/time-tracking-actions";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMinutesAsHours, formatTime, sumNetMinutes, timeEntryStatusLabels } from "@/lib/time-tracking";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { TimeEntry } from "@/types/app";

export default async function TimeTrackingPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const { data, error: queryError } = await supabase
    .from("time_entries")
    .select("*, profiles!time_entries_employee_id_fkey(id, full_name, email), jobsites(id, name, address, customer)")
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })
    .limit(80);

  const entries = (data ?? []) as TimeEntry[];
  const totalMinutes = sumNetMinutes(entries);
  const submittedCount = entries.filter((entry) => entry.status === "submitted").length;

  return (
    <>
      <PageHeader
        title="Zeiten"
        description="Arbeitszeiten erfassen, pruefen und freigeben."
        actionHref="/time-tracking/new"
        actionLabel="Arbeitszeit eintragen"
        actionIcon={Plus}
      />
      <MessageBox error={error || queryError?.message} success={success} />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="surface p-4">
          <p className="meta-label">Eintraege</p>
          <p className="mt-1 text-2xl font-black text-ink">{entries.length}</p>
        </div>
        <div className="surface p-4">
          <p className="meta-label">Netto gesamt</p>
          <p className="mt-1 text-2xl font-black text-ink">{formatMinutesAsHours(totalMinutes)}</p>
        </div>
        <div className="surface p-4">
          <p className="meta-label">Eingereicht</p>
          <p className="mt-1 text-2xl font-black text-ink">{submittedCount}</p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/time-tracking/new" className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Arbeitszeit eintragen
        </Link>
        {context.canManage ? (
          <Link href="/time-tracking/reports" className="btn-secondary">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Stundenzettel
          </Link>
        ) : null}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="Noch keine Zeiten"
          description="Erfasse deine Arbeitszeit direkt nach dem Einsatz auf der Baustelle."
          actionHref="/time-tracking/new"
          actionLabel="Zeit eintragen"
        />
      ) : (
        <div className="grid gap-4">
          {entries.map((entry) => {
            const canEdit = context.canManage || entry.status !== "approved";
            return (
              <article key={entry.id} className="interactive-surface overflow-hidden p-0">
                <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="meta-label">{entry.profiles?.full_name || entry.profiles?.email || "Mitarbeiter"}</p>
                      <h2 className="mt-1 text-lg font-black text-ink">{entry.jobsites?.name ?? entry.work_location}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{entry.work_address}</p>
                    </div>
                    <StatusBadge value={entry.status} label={timeEntryStatusLabels[entry.status]} />
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    <div className="rounded-md bg-fog p-3">
                      <p className="meta-label">Datum</p>
                      <p className="mt-1 flex items-center gap-2 font-black text-ink">
                        <CalendarDays className="h-4 w-4 text-moss" aria-hidden="true" />
                        {formatDate(entry.date)}
                      </p>
                    </div>
                    <div className="rounded-md bg-fog p-3">
                      <p className="meta-label">Arbeitszeit</p>
                      <p className="mt-1 font-black text-ink">
                        {formatTime(entry.start_time)} - {formatTime(entry.end_time)}
                      </p>
                    </div>
                    <div className="rounded-md bg-fog p-3">
                      <p className="meta-label">Pause</p>
                      <p className="mt-1 font-black text-ink">{entry.break_minutes} Min.</p>
                    </div>
                    <div className="rounded-md bg-fog p-3">
                      <p className="meta-label">Netto</p>
                      <p className="mt-1 font-black text-ink">{formatMinutesAsHours(entry.net_minutes)}</p>
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 rounded-md border border-line bg-white p-3 text-sm text-slate-600">
                    {entry.activity}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canEdit ? (
                      <Link href={`/time-tracking/${entry.id}/edit`} className="btn-secondary">
                        Bearbeiten
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        Gesperrt
                      </span>
                    )}
                    {context.canManage && entry.status !== "approved" ? (
                      <form action={setTimeEntryStatusAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <input type="hidden" name="status" value="approved" />
                        <input type="hidden" name="change_reason" value="Zeit freigegeben" />
                        <button className="btn-primary" type="submit">
                          Freigeben
                        </button>
                      </form>
                    ) : null}
                    {context.canManage && entry.status !== "rejected" ? (
                      <form action={setTimeEntryStatusAction}>
                        <input type="hidden" name="id" value={entry.id} />
                        <input type="hidden" name="status" value="rejected" />
                        <input type="hidden" name="change_reason" value="Zeit abgelehnt" />
                        <button className="btn-secondary" type="submit">
                          Ablehnen
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {context.canManage ? (
        <div className="mt-6">
          <Link href="/time-tracking/reports" className="btn-secondary">
            <Download className="h-4 w-4" aria-hidden="true" />
            Stundenzettel und Exporte
          </Link>
        </div>
      ) : null}
    </>
  );
}
