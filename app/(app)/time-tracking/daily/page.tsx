import Link from "next/link";
import {
  CalendarDays,
  CloudSun,
  Clock3,
  Download,
  FileDown,
  FileSpreadsheet,
  Pencil,
  Plus,
  ShieldCheck,
  UserMinus,
  Users
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { StatCard } from "@/components/construction-ui";
import { TimeEntryStatusControls } from "@/components/time-tracking/time-entry-status-controls";
import { requirePermission } from "@/lib/auth";
import { timeEntryAuditSelect } from "@/lib/data/selects";
import { selectTimeEntriesWithWeatherFallback } from "@/lib/data/time-entries";
import { hasAppPermission } from "@/lib/permissions";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseDailyTimeFilters } from "@/lib/time-daily";
import {
  formatMinutesAsHours,
  formatTime,
  groupTimeEntriesByDateAndEmployee,
  sumGrossMinutes,
  sumNetMinutes,
  timeEntryStatusLabels
} from "@/lib/time-tracking";
import { formatDate, formatDateTime, searchParamMessage } from "@/lib/utils";
import { weatherDetailsLine, weatherSummary } from "@/lib/weather/display";
import type { Jobsite, Profile, TimeEntry, TimeEntryAuditLog } from "@/types/app";

type SearchParams = Record<string, string | string[] | undefined>;
type DailyTimeEntry = TimeEntry & {
  approved_profile?: Pick<Profile, "id" | "full_name" | "email"> | null;
  audits?: TimeEntryAuditLog[];
};

const dailyTimeEntryLimit = 200;
const dailyOptionLimit = 250;
const dailyAuditLimit = 500;

function buildFilterParams(filters: ReturnType<typeof parseDailyTimeFilters>) {
  const params = new URLSearchParams({
    range: filters.preset,
    date: filters.selectedDate
  });

  if (filters.employeeId) params.set("employee_id", filters.employeeId);
  if (filters.jobId) params.set("job_id", filters.jobId);
  if (filters.status !== "all") params.set("status", filters.status);

  return params;
}

function employeeName(profile?: Pick<Profile, "full_name" | "email"> | null) {
  return profile?.full_name || profile?.email || "Mitarbeiter";
}

export default async function DailyTimeTrackingPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const context = await requirePermission("time.team.view", "/time-tracking");
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = (await searchParams) ?? {};
  const filters = parseDailyTimeFilters(resolvedSearchParams);
  const { error, success } = searchParamMessage(resolvedSearchParams);
  const canEditTeamTimes = hasAppPermission(context.profile.role, context.permissions, "time.team.edit");
  const filterParams = buildFilterParams(filters);
  const filterQuery = filterParams.toString();
  const returnTo = `/time-tracking/daily${filterQuery ? `?${filterQuery}` : ""}`;

  const [entriesResult, employeesResult, jobsitesResult] = await Promise.all([
    selectTimeEntriesWithWeatherFallback((select) => {
      let entriesQuery = supabase
        .from("time_entries")
        .select(select)
        .eq("company_id", context.companyId)
        .gte("date", filters.dateFrom)
        .lte("date", filters.dateTo)
        .order("date", { ascending: false })
        .order("start_time", { ascending: true })
        .limit(dailyTimeEntryLimit);

      if (filters.employeeId) entriesQuery = entriesQuery.eq("employee_id", filters.employeeId);
      if (filters.jobId) entriesQuery = entriesQuery.eq("job_id", filters.jobId);
      if (filters.status !== "all") entriesQuery = entriesQuery.eq("status", filters.status);

      return entriesQuery;
    }),
    supabase
      .from("profiles")
      .select("id, company_id, email, full_name, role, active")
      .eq("company_id", context.companyId)
      .eq("active", true)
      .order("full_name")
      .limit(dailyOptionLimit),
    supabase
      .from("jobsites")
      .select("id, company_id, name, customer, address, start_date, status, notes, assigned_employee_ids, created_at")
      .eq("company_id", context.companyId)
      .order("name", { ascending: true })
      .limit(dailyOptionLimit)
  ]);

  const rawEntries = ((entriesResult.data ?? []) as unknown) as TimeEntry[];
  const employees = (employeesResult.data ?? []) as Profile[];
  const jobsites = (jobsitesResult.data ?? []) as Jobsite[];
  const profilesById = new Map(employees.map((employee) => [employee.id, employee]));
  const jobsitesById = new Map(jobsites.map((jobsite) => [jobsite.id, jobsite]));
  const entries = rawEntries.map((entry) => ({
    ...entry,
    profiles: profilesById.get(entry.employee_id) ?? null,
    approved_profile: entry.approved_by ? profilesById.get(entry.approved_by) ?? null : null,
    jobsites: jobsitesById.get(entry.job_id) ?? null
  })) as DailyTimeEntry[];
  const entryIds = entries.map((entry) => entry.id);
  const auditsResult =
    entryIds.length > 0
      ? await supabase
          .from("time_entry_audit_log")
          .select(timeEntryAuditSelect)
          .eq("company_id", context.companyId)
          .in("time_entry_id", entryIds)
          .order("created_at", { ascending: false })
          .limit(dailyAuditLimit)
      : { data: [], error: null };

  const auditMap = new Map<string, TimeEntryAuditLog[]>();
  ((auditsResult.data ?? []) as unknown as TimeEntryAuditLog[]).forEach((audit) => {
    const audits = auditMap.get(audit.time_entry_id) ?? [];
    audits.push(audit);
    auditMap.set(audit.time_entry_id, audits);
  });

  const entriesWithAudits = entries.map((entry) => ({
    ...entry,
    audits: auditMap.get(entry.id) ?? []
  }));

  const groups = groupTimeEntriesByDateAndEmployee(entriesWithAudits);
  const netMinutes = sumNetMinutes(entriesWithAudits);
  const grossMinutes = sumGrossMinutes(entriesWithAudits);
  const waitingForApproval = entriesWithAudits.filter((entry) => entry.status === "submitted").length;
  const selectedDateEntries = entriesWithAudits.filter((entry) => entry.date === filters.selectedDate);
  const employeesWithSelectedEntry = new Set(selectedDateEntries.map((entry) => entry.employee_id));
  const employeesWithoutSelectedEntry = employees.filter((employee) => !employeesWithSelectedEntry.has(employee.id));
  const exportHref = `/time-tracking/daily/export?${filterQuery ? `${filterQuery}&` : ""}`;
  const queryError =
    safeQueryErrorMessage(entriesResult.error) ||
    safeQueryErrorMessage(employeesResult.error) ||
    safeQueryErrorMessage(jobsitesResult.error) ||
    safeQueryErrorMessage(auditsResult.error);

  return (
    <>
      <PageHeader
        title="Tagesstunden"
        description="Tägliche Stunden pro Mitarbeiter prüfen, korrigieren, freigeben und exportieren."
        actionHref="/time/new"
        actionLabel="Arbeitszeit eintragen"
        actionIcon={Plus}
      />
      <MessageBox error={error || queryError} success={success} />
      {rawEntries.length >= dailyTimeEntryLimit ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
          Es werden die ersten {dailyTimeEntryLimit} Einträge angezeigt. Grenze den Zeitraum oder Mitarbeiter ein, um schneller und genauer zu prüfen.
        </p>
      ) : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Netto im Zeitraum" value={formatMinutesAsHours(netMinutes)} href={returnTo} tone="green" />
        <StatCard icon={CalendarDays} label="Brutto im Zeitraum" value={formatMinutesAsHours(grossMinutes)} tone="info" />
        <StatCard
          icon={ShieldCheck}
          label="Noch zu prüfen"
          value={waitingForApproval}
          tone={waitingForApproval > 0 ? "warning" : "green"}
        />
        <StatCard
          icon={UserMinus}
          label="Ohne Eintrag am Datum"
          value={employeesWithoutSelectedEntry.length}
          detail={filters.selectedDate ? formatDate(filters.selectedDate) : undefined}
          tone={employeesWithoutSelectedEntry.length > 0 ? "warning" : "neutral"}
        />
      </div>

      <section className="filter-bar mb-5">
        <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="section-title">Filter</h2>
            <p className="mt-1 text-sm text-slate-500">
              Zeitraum: {formatDate(filters.dateFrom)} bis {formatDate(filters.dateTo)}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <a href={`${exportHref}format=pdf`} className="btn-primary">
              <FileDown className="h-4 w-4" aria-hidden="true" />
              Tages-PDF
            </a>
            <a href={`${exportHref}format=csv`} className="btn-secondary">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              Tages-CSV
            </a>
          </div>
        </div>

        <form action="/time-tracking/daily" className="grid gap-3 lg:grid-cols-[1fr_1fr_1.3fr_1.3fr_1fr_auto]">
          <div>
            <label className="field-label" htmlFor="range">
              Zeitraum
            </label>
            <select className="field-input" id="range" name="range" defaultValue={filters.preset}>
              <option value="today">Heute</option>
              <option value="yesterday">Gestern</option>
              <option value="week">Woche</option>
              <option value="month">Monat</option>
              <option value="custom">Datum</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="date">
              Bezugstag
            </label>
            <input className="field-input" id="date" name="date" type="date" defaultValue={filters.selectedDate} />
          </div>
          <div>
            <label className="field-label" htmlFor="employee_id">
              Mitarbeiter
            </label>
            <select className="field-input" id="employee_id" name="employee_id" defaultValue={filters.employeeId}>
              <option value="">Alle Mitarbeiter</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.full_name || employee.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="job_id">
              Baustelle
            </label>
            <select className="field-input" id="job_id" name="job_id" defaultValue={filters.jobId}>
              <option value="">Alle Baustellen</option>
              {jobsites.map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {jobsite.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="status">
              Status
            </label>
            <select className="field-input" id="status" name="status" defaultValue={filters.status}>
              <option value="all">Alle Status</option>
              <option value="draft">Entwurf</option>
              <option value="submitted">Eingereicht</option>
              <option value="approved">Genehmigt</option>
              <option value="rejected">Abgelehnt</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button className="btn-primary min-h-12 w-full lg:w-auto" type="submit">
              Filtern
            </button>
            <Link href="/time-tracking/daily" className="btn-secondary min-h-12">
              Reset
            </Link>
          </div>
        </form>
      </section>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/time-tracking" className="btn-secondary">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
          Zeiterfassung
        </Link>
        <Link href="/time-tracking/reports" className="btn-secondary">
          <Download className="h-4 w-4" aria-hidden="true" />
          Monats-Stundenzettel
        </Link>
      </div>

      {entriesWithAudits.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="Keine Tagesstunden gefunden"
          description="Passe den Zeitraum oder Filter an. Neue Zeiten können direkt erfasst werden."
          actionHref="/time/new"
          actionLabel="Arbeitszeit eintragen"
        />
      ) : (
        <div className="space-y-5">
          {groups.map((day) => (
            <section key={day.date} className="dashboard-band">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="section-kicker">Tagesgruppe</p>
                  <h2 className="section-title">{formatDate(day.date)}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {day.entries.length} Einträge · Brutto {formatMinutesAsHours(day.grossMinutes)} · Netto{" "}
                    {formatMinutesAsHours(day.netMinutes)}
                  </p>
                </div>
                <StatusBadge value={day.entries.some((entry) => entry.status === "submitted") ? "submitted" : "approved"} label="Tagesstand" />
              </div>

              <div className="grid gap-4">
                {day.employees.map((employee) => (
                  <article key={`${day.date}-${employee.employeeId}`} className="rounded-lg border border-line bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="meta-label">Mitarbeiter</p>
                        <h3 className="mt-1 flex items-center gap-2 text-lg font-black text-ink">
                          <Users className="h-5 w-5 text-primary" aria-hidden="true" />
                          {employee.employeeName}
                        </h3>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-64">
                        <div className="rounded-md bg-fog p-3">
                          <p className="meta-label">Brutto</p>
                          <p className="mt-1 font-black text-ink">{formatMinutesAsHours(employee.grossMinutes)}</p>
                        </div>
                        <div className="rounded-md bg-fog p-3">
                          <p className="meta-label">Netto</p>
                          <p className="mt-1 font-black text-ink">{formatMinutesAsHours(employee.netMinutes)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {employee.entries.map((entry) => {
                        const latestAudit = entry.audits?.[0];
                        return (
                          <div key={entry.id} data-testid="daily-time-entry" className="rounded-lg border border-line bg-fog p-4">
                            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-black text-ink">{entry.jobsites?.name ?? entry.work_location}</h4>
                                  <StatusBadge value={entry.status} label={timeEntryStatusLabels[entry.status]} />
                                </div>
                                <p className="mt-1 text-sm font-semibold text-slate-600">{entry.work_address}</p>
                                <p className="mt-3 rounded-md border border-line bg-white p-3 text-sm leading-6 text-slate-700">
                                  {entry.activity}
                                </p>
                                {weatherSummary(entry) ? (
                                  <div className="mt-3 rounded-md border border-primary/20 bg-white p-3 text-sm">
                                    <p className="meta-label flex items-center gap-2">
                                      <CloudSun className="h-4 w-4 text-primary" aria-hidden="true" />
                                      Wetter
                                    </p>
                                    <p className="mt-1 font-semibold leading-6 text-ink">{weatherSummary(entry)}</p>
                                    <p className="mt-1 text-xs font-semibold text-slate-500">{weatherDetailsLine(entry) || "Manuell erfasst"}</p>
                                  </div>
                                ) : null}
                              </div>

                              <div className="grid min-w-full gap-2 text-sm sm:grid-cols-4 xl:min-w-[520px]">
                                <InfoTile label="Beginn" value={formatTime(entry.start_time)} />
                                <InfoTile label="Ende" value={formatTime(entry.end_time)} />
                                <InfoTile label="Pause" value={`${entry.break_minutes} Min.`} />
                                <InfoTile label="Netto" value={formatMinutesAsHours(entry.net_minutes)} strong />
                              </div>
                            </div>

                            <div className="mt-3 grid gap-2 text-sm lg:grid-cols-3">
                              <InfoTile label="Brutto" value={formatMinutesAsHours(entry.gross_minutes)} />
                              <InfoTile
                                label="Genehmigt von"
                                value={entry.approved_profile ? employeeName(entry.approved_profile) : entry.approved_at ? "Chef" : "-"}
                              />
                              <InfoTile
                                label="Audit"
                                value={
                                  latestAudit
                                    ? `${latestAudit.change_reason ?? "Aenderung"} · ${formatDateTime(latestAudit.created_at)}`
                                    : "Kein Änderungsverlauf"
                                }
                              />
                            </div>

                            <div className="mt-4 flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                              {canEditTeamTimes ? (
                                <Link href={`/time-tracking/${entry.id}/edit`} className="btn-secondary w-full xl:w-auto">
                                  <Pencil className="h-4 w-4" aria-hidden="true" />
                                  Bearbeiten / korrigieren
                                </Link>
                              ) : null}

                              {canEditTeamTimes ? <TimeEntryStatusControls entryId={entry.id} initialStatus={entry.status} returnTo={returnTo} /> : null}
                            </div>

                            {entry.audits && entry.audits.length > 1 ? (
                              <details className="mt-3 rounded-md border border-line bg-white p-3 text-sm">
                                <summary className="cursor-pointer font-black text-ink">Änderungsverlauf anzeigen</summary>
                                <div className="mt-3 space-y-2 text-slate-600">
                                  {entry.audits.slice(0, 5).map((audit) => (
                                    <p key={audit.id}>
                                      {formatDateTime(audit.created_at)} · {employeeName(audit.profiles)} ·{" "}
                                      {audit.change_reason ?? "Aenderung"}
                                    </p>
                                  ))}
                                </div>
                              </details>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function InfoTile({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-md border border-line bg-white p-3">
      <p className="meta-label">{label}</p>
      <p className={strong ? "mt-1 font-black text-ink" : "mt-1 font-semibold text-slate-700"}>{value}</p>
    </div>
  );
}
