import Link from "next/link";
import { CalendarDays, ClipboardList, Clock, CloudSun, Plus } from "lucide-react";
import { StatCard } from "@/components/construction-ui";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { Report } from "@/types/app";

export default async function ReportsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const { data } = await supabase
    .from("reports")
    .select("*, jobsites(id, name, customer, address)")
    .order("report_date", { ascending: false });

  const reports = (data ?? []) as Report[];
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const reportsThisWeek = reports.filter((report) => report.report_date && new Date(report.report_date) >= weekStart).length;
  const reportsWithWeather = reports.filter((report) => Boolean(report.weather)).length;

  return (
    <>
      <PageHeader
        title="Tagesberichte"
        description="Arbeitszeiten, Tätigkeiten, Material, Besonderheiten und Fotos."
        actionHref="/berichte/neu"
        actionLabel="Neuer Tagesbericht"
        actionIcon={Plus}
      />
      <MessageBox error={error} success={success} />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon={ClipboardList} label="Gesamt" value={reports.length} tone="green" />
        <StatCard icon={CalendarDays} label="Diese Woche" value={reportsThisWeek} tone="info" />
        <StatCard icon={CloudSun} label="Mit Wetter" value={reportsWithWeather} tone="neutral" />
      </section>

      {reports.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Noch keine Berichte"
          description="Erstelle den ersten Tagesbericht direkt von der Baustelle oder aus dem Büro."
          actionHref="/berichte/neu"
          actionLabel="Bericht erstellen"
        />
      ) : (
        <section>
          <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Dokumentation</p>
              <h2 className="section-title">Letzte Tagesberichte</h2>
            </div>
            <p className="text-sm font-semibold text-slate-500">Neueste zuerst</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {reports.map((report) => (
              <Link href={`/berichte/${report.id}`} key={report.id} className="work-card construction-rail block p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-black text-ink">
                      {report.jobsites?.name ?? "Ohne Baustelle"}
                    </h2>
                    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <CalendarDays className="h-4 w-4 text-moss" aria-hidden="true" />
                      {formatDate(report.report_date)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ClipboardList className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-slate-600">{report.activities}</p>
                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <span className="flex items-center gap-2 rounded-md border border-line bg-fog px-3 py-2">
                    <CloudSun className="h-4 w-4 text-info" aria-hidden="true" />
                    {report.weather || "Keine Angabe"}
                  </span>
                  <span className="flex items-center gap-2 rounded-md border border-line bg-fog px-3 py-2">
                    <Clock className="h-4 w-4 text-info" aria-hidden="true" />
                    {report.work_start?.slice(0, 5) || "--:--"} - {report.work_end?.slice(0, 5) || "--:--"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
