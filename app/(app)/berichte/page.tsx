import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardList, Clock, CloudSun, Plus, Search } from "lucide-react";
import { StatCard } from "@/components/construction-ui";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireAppContext } from "@/lib/auth";
import { loadReportList, reportHref, reportRangeFilters } from "@/lib/data/reports";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, formatDate, searchParamMessage } from "@/lib/utils";
import { weatherSummary } from "@/lib/weather/display";

export default async function ReportsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const { search, selectedRange, page, from, to, reports, totalCount, totalPages, error: queryError, counts } = await loadReportList({
    supabase,
    companyId: context.companyId,
    userId: context.userId,
    canManage: context.canManage,
    params
  });

  return (
    <>
      <PageHeader
        title="Tagesberichte"
        description="Arbeitszeiten, Tätigkeiten, Material, Besonderheiten und Fotos."
        actionHref="/berichte/neu"
        actionLabel="Neuer Tagesbericht"
        actionIcon={Plus}
      />
      <MessageBox error={error || safeQueryErrorMessage(queryError)} success={success} />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatCard icon={ClipboardList} label="Gesamt" value={counts.all} tone="green" />
        <StatCard icon={CalendarDays} label="Eingereicht" value={counts.submitted} tone="info" />
        <StatCard icon={CloudSun} label="Freigegeben" value={counts.approved} tone="neutral" />
      </section>

      <section className="surface mb-5 p-3 sm:p-4">
        <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/berichte">
          {selectedRange !== "alle" ? <input type="hidden" name="range" value={selectedRange} /> : null}
          <label className="sr-only" htmlFor="report-search">
            Tagesberichte suchen
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="report-search"
              className="field-input pl-9"
              name="q"
              defaultValue={search}
              placeholder="Suchen: Tätigkeit, Material, Wetter, Besonderheiten..."
            />
          </div>
          <button className="btn-primary" type="submit">
            <Search className="h-4 w-4" aria-hidden="true" />
            Suchen
          </button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {reportRangeFilters.map((filter) => (
            <Link
              key={filter.value}
              href={reportHref({ q: search, range: filter.value })}
              className={cn(
                "shrink-0 rounded-md border px-3 py-2 text-sm font-black",
                selectedRange === filter.value
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-white text-slate-700 hover:border-primary/40"
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
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
            <p className="text-sm font-semibold text-slate-500">
              {totalCount} Einträge · Seite {page} von {totalPages}
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {reports.map((report) => (
              <Link href={`/berichte/${report.id}`} key={report.id} className="work-card construction-rail group block p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="meta-label">{report.jobsites?.customer ?? "Dokumentation"}</p>
                    <h2 className="text-lg font-black text-ink">{report.jobsites?.name ?? "Ohne Baustelle"}</h2>
                    <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-600">
                      <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
                      {formatDate(report.report_date)}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <ClipboardList className="h-5 w-5" aria-hidden="true" />
                  </div>
                </div>
                <div className="mt-3">
                  <StatusBadge value={report.report_status ?? "draft"} label={reportStatusLabel(report.report_status ?? "draft")} />
                </div>
                <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">{report.activities}</p>
                <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                  <span className="flex items-center gap-2 rounded-md border border-line bg-fog px-3 py-2">
                    <CloudSun className="h-4 w-4 text-info" aria-hidden="true" />
                    {weatherSummary(report) || "Keine Angabe"}
                  </span>
                  <span className="flex items-center gap-2 rounded-md border border-line bg-fog px-3 py-2">
                    <Clock className="h-4 w-4 text-info" aria-hidden="true" />
                    {report.work_start?.slice(0, 5) || "--:--"} - {report.work_end?.slice(0, 5) || "--:--"}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm font-black text-primary">
                  <span>{report.employee_ids.length} Mitarbeiter</span>
                  <span className="inline-flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                    Öffnen
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
          {totalPages > 1 ? (
            <nav className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={reportHref({ q: search, range: selectedRange, page: Math.max(1, page - 1) })}
                className={cn("btn-secondary", page <= 1 && "pointer-events-none opacity-50")}
              >
                Zurück
              </Link>
              <span className="text-center text-sm font-bold text-slate-500">
                {from + 1}-{Math.min(to + 1, totalCount)} von {totalCount}
              </span>
              <Link
                href={reportHref({ q: search, range: selectedRange, page: Math.min(totalPages, page + 1) })}
                className={cn("btn-secondary", page >= totalPages && "pointer-events-none opacity-50")}
              >
                Weiter
              </Link>
            </nav>
          ) : null}
        </section>
      )}
    </>
  );
}

function reportStatusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Entwurf",
    submitted: "Eingereicht",
    reviewed: "Geprüft",
    approved: "Freigegeben"
  };

  return labels[status] ?? status;
}
