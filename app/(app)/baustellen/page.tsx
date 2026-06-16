import Link from "next/link";
import { CalendarDays, ClipboardList, MapPin, Plus, Users } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Jobsite } from "@/types/app";

export default async function JobsitesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const { data } = await supabase
    .from("jobsites")
    .select("*")
    .order("created_at", { ascending: false });

  const jobsites = (data ?? []) as Jobsite[];
  const activeCount = jobsites.filter((jobsite) => jobsite.status === "aktiv").length;
  const plannedCount = jobsites.filter((jobsite) => jobsite.status === "geplant").length;
  const doneCount = jobsites.filter((jobsite) => jobsite.status === "abgeschlossen").length;

  return (
    <>
      <PageHeader
        title="Baustellen"
        description="Kunden, Adressen, Status und zugeordnete Mitarbeiter."
        actionHref={context.canManage ? "/baustellen/neu" : undefined}
        actionLabel={context.canManage ? "Neue Baustelle" : undefined}
        actionIcon={Plus}
      />
      <MessageBox error={error} success={success} />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <JobsiteMetric label="Aktiv" value={activeCount} tone="green" />
        <JobsiteMetric label="Geplant" value={plannedCount} tone="blue" />
        <JobsiteMetric label="Abgeschlossen" value={doneCount} tone="neutral" />
      </section>

      {jobsites.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Noch keine Baustellen"
          description="Lege die erste Baustelle an, damit Berichte und Aufgaben sauber zugeordnet werden koennen."
          actionHref={context.canManage ? "/baustellen/neu" : undefined}
          actionLabel={context.canManage ? "Baustelle anlegen" : undefined}
        />
      ) : (
        <section>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Übersicht</p>
              <h2 className="section-title">Alle Baustellen</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">{jobsites.length} Einträge</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {jobsites.map((jobsite) => (
              <article key={jobsite.id} className="work-card overflow-hidden p-0">
                <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-ink">{jobsite.name}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-700">{jobsite.customer}</p>
                      <p className="mt-2 flex items-start gap-2 text-sm text-slate-500">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden="true" />
                        {jobsite.address}
                      </p>
                    </div>
                    <StatusBadge value={jobsite.status} />
                  </div>
                  <div className="mt-5 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <div className="rounded-md bg-fog p-3">
                      <p className="meta-label">Start</p>
                      <p className="mt-1 flex items-center gap-2 font-semibold text-ink">
                        <CalendarDays className="h-4 w-4 text-moss" aria-hidden="true" />
                        {formatDate(jobsite.start_date)}
                      </p>
                    </div>
                    <div className="rounded-md bg-fog p-3">
                      <p className="meta-label">Team</p>
                      <p className="mt-1 flex items-center gap-2 font-semibold text-ink">
                        <Users className="h-4 w-4 text-moss" aria-hidden="true" />
                        {jobsite.assigned_employee_ids?.length ?? 0} Mitarbeiter
                      </p>
                    </div>
                  </div>
                  {jobsite.notes ? (
                    <p className="mt-3 line-clamp-3 rounded-md border border-line bg-white p-3 text-sm text-slate-600">{jobsite.notes}</p>
                  ) : null}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Link href={`/baustellen/${jobsite.id}`} className="btn-primary w-full sm:w-auto">
                      Öffnen
                    </Link>
                    <Link href="/berichte/neu" className="btn-secondary w-full sm:w-auto">
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                      Tagesbericht
                    </Link>
                    {context.canManage ? (
                      <Link href={`/baustellen/${jobsite.id}/bearbeiten`} className="btn-secondary w-full sm:w-auto">
                        Bearbeiten
                      </Link>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function JobsiteMetric({ label, value, tone }: { label: string; value: number; tone: "green" | "blue" | "neutral" }) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
      : tone === "blue"
        ? "bg-steel/10 text-steel ring-steel/15"
        : "bg-white text-slate-700 ring-line";

  return (
    <div className={`rounded-lg p-4 shadow-sm ring-1 ${toneClass}`}>
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-sm font-bold">{label}</p>
    </div>
  );
}
