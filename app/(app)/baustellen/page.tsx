import { HardHat, MapPin, Plus } from "lucide-react";
import { JobsiteCard, StatCard } from "@/components/construction-ui";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
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
        <StatCard icon={HardHat} label="Aktiv" value={activeCount} tone="green" />
        <StatCard icon={MapPin} label="Geplant" value={plannedCount} tone="info" />
        <StatCard icon={HardHat} label="Abgeschlossen" value={doneCount} tone="neutral" />
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
              <JobsiteCard key={jobsite.id} jobsite={jobsite} canManage={context.canManage} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
