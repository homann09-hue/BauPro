import Link from "next/link";
import { Archive, CalendarDays, ChevronLeft, ChevronRight, Plus, TriangleAlert, Wrench } from "lucide-react";
import { FormSection, StatCard } from "@/components/construction-ui";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { PlanningBoard } from "@/components/planning/planning-board";
import { SubmitButton } from "@/components/submit-button";
import { archivePlanningAssignmentAction, createPlanningAssignmentAction, createPlanningResourceAction } from "@/lib/actions/planning-actions";
import { requireAppContext } from "@/lib/auth";
import { planningAssignmentSelect, planningResourceSelect } from "@/lib/data/selects";
import {
  addDaysIso,
  buildPlanningRows,
  detectPlanningConflicts,
  getPlanningPeriod,
  isoDate,
  parseIsoDate,
  planningStatusLabels
} from "@/lib/planning";
import { resourceKindLabels, resourceKinds, resourceStatusLabels, resourceStatuses } from "@/lib/resources";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { canOperate, cn, formatDate, searchParamMessage } from "@/lib/utils";
import { loadPlanningWeatherRisks } from "@/lib/weather/planning-weather";
import type {
  Jobsite,
  MaterialAlert,
  PlanningAssignment,
  PlanningAssignmentStatus,
  PlanningResource,
  PlanningView,
  Profile,
  Vehicle
} from "@/types/app";

type SearchParams = Record<string, string | string[] | undefined>;

const statusOptions = Object.keys(planningStatusLabels) as PlanningAssignmentStatus[];

function singleParam(params: SearchParams, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : null;
}

function todayIso() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function parseView(value: string | null): PlanningView {
  return value === "month" ? "month" : "week";
}

function parseAnchor(value: string | null) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return todayIso();
}

function shiftAnchor(anchor: string, view: PlanningView, direction: -1 | 1) {
  if (view === "week") return addDaysIso(anchor, direction * 7);
  const date = parseIsoDate(anchor);
  date.setUTCMonth(date.getUTCMonth() + direction);
  return isoDate(date);
}

function boardHref({ view, date }: { view: PlanningView; date: string }) {
  return `/plantafel?view=${view}&date=${date}`;
}

function planningSetupMessage(
  error?: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null
) {
  if (!error) return null;
  const text = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" ");
  if (text.includes("planning_assignments") || text.includes("planning_resources")) {
    return "Datenbank-Update fehlt: Bitte `supabase/migrations/20260628_planning_board.sql` im Supabase SQL Editor ausfuehren.";
  }
  return safeQueryErrorMessage(error);
}

function employeeLabel(employee: Pick<Profile, "full_name" | "email">) {
  return employee.full_name || employee.email || "Mitarbeiter";
}

function assignmentMeta(assignment: PlanningAssignment) {
  if (assignment.resource_type === "employee") {
    return assignment.profiles?.full_name || assignment.profiles?.email || "Mitarbeiter";
  }
  if (assignment.resource_type === "vehicle") return assignment.vehicles?.name || "Fahrzeug";
  return assignment.planning_resources?.name || "Gerät";
}

export default async function PlanningBoardPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(resolvedSearchParams);
  const view = parseView(singleParam(resolvedSearchParams, "view"));
  const anchor = parseAnchor(singleParam(resolvedSearchParams, "date"));
  const period = getPlanningPeriod(view, anchor);
  const returnTo = boardHref({ view, date: anchor });
  const canSeeOperationalBoard = context.canManage || canOperate(context.profile.role);

  const [employeesResult, vehiclesResult, resourcesResult, assignmentsResult, jobsitesResult, materialAlertsResult] = await Promise.all([
    canSeeOperationalBoard
      ? supabase
          .from("profiles")
          .select("id, company_id, email, full_name, role, active")
          .eq("company_id", context.companyId)
          .eq("active", true)
          .in("role", ["vorarbeiter", "mitarbeiter"])
          .order("full_name", { ascending: true })
          .limit(120)
      : supabase
          .from("profiles")
          .select("id, company_id, email, full_name, role, active")
          .eq("id", context.userId)
          .eq("company_id", context.companyId)
          .limit(1),
    canSeeOperationalBoard
      ? supabase
          .from("vehicles")
          .select("id, company_id, name, license_plate, tuv_date, notes, archived_at")
          .eq("company_id", context.companyId)
          .is("archived_at", null)
          .order("name", { ascending: true })
          .limit(80)
      : Promise.resolve({ data: [], error: null }),
    canSeeOperationalBoard
      ? supabase
          .from("planning_resources")
          .select(planningResourceSelect)
          .eq("company_id", context.companyId)
          .eq("active", true)
          .is("archived_at", null)
          .order("resource_kind", { ascending: true })
          .order("name", { ascending: true })
          .limit(120)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("planning_assignments")
      .select(planningAssignmentSelect)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .lte("start_date", period.end)
      .gte("end_date", period.start)
      .order("start_date", { ascending: true })
      .limit(view === "month" ? 900 : 500),
    context.canManage
      ? supabase
          .from("jobsites")
          .select("id, company_id, name, customer, address, start_date, status, notes, assigned_employee_ids, created_at")
          .eq("company_id", context.companyId)
          .is("archived_at", null)
          .in("status", ["geplant", "aktiv"])
          .order("start_date", { ascending: true })
          .limit(120)
      : Promise.resolve({ data: [], error: null }),
    canSeeOperationalBoard
      ? supabase
          .from("material_alerts")
          .select("id, company_id, material_id, inventory_item_id, job_id, bring_list_id, alert_type, severity, message, required_quantity, available_quantity, missing_quantity, unit, status, created_by_system, assigned_to_admin, created_at, acknowledged_at, resolved_at")
          .eq("company_id", context.companyId)
          .eq("status", "open")
          .limit(150)
      : Promise.resolve({ data: [], error: null })
  ]);

  const employees = ((employeesResult.data ?? []) as unknown) as Profile[];
  const vehicles = ((vehiclesResult.data ?? []) as unknown) as Vehicle[];
  const resources = ((resourcesResult.data ?? []) as unknown) as PlanningResource[];
  const assignments = ((assignmentsResult.data ?? []) as unknown) as PlanningAssignment[];
  const jobsites = ((jobsitesResult.data ?? []) as unknown) as Jobsite[];
  const materialAlerts = ((materialAlertsResult.data ?? []) as unknown) as MaterialAlert[];
  const weatherResult = context.canManage
    ? await loadPlanningWeatherRisks({ supabase, companyId: context.companyId, assignments })
    : { risks: {}, error: null };
  const { rows } = buildPlanningRows({ employees, vehicles, resources });
  const conflictMap = detectPlanningConflicts(assignments, materialAlerts);
  const conflicts = Object.fromEntries(conflictMap.entries());
  const criticalConflicts = [...conflictMap.values()].flat().filter((conflict) => conflict.severity === "critical").length;
  const warningConflicts = [...conflictMap.values()].flat().filter((conflict) => conflict.severity === "warning").length;
  const weatherRisks = Object.values(weatherResult.risks);
  const criticalWeatherRisks = weatherRisks.filter((risk) => risk.riskLevel === "red" && !risk.acknowledgedAction).length;
  const warningWeatherRisks = weatherRisks.filter((risk) => risk.riskLevel === "yellow" && !risk.acknowledgedAction).length;
  const activeAssignments = assignments.filter((assignment) => assignment.status === "aktiv").length;
  const queryError =
    planningSetupMessage(assignmentsResult.error) ||
    planningSetupMessage(resourcesResult.error) ||
    safeQueryErrorMessage(employeesResult.error) ||
    safeQueryErrorMessage(vehiclesResult.error) ||
    safeQueryErrorMessage(jobsitesResult.error) ||
    safeQueryErrorMessage(materialAlertsResult.error) ||
    weatherResult.error;
  const previousHref = boardHref({ view, date: shiftAnchor(anchor, view, -1) });
  const nextHref = boardHref({ view, date: shiftAnchor(anchor, view, 1) });
  const currentPeriodLabel =
    view === "week"
      ? `${formatDate(period.start)} bis ${formatDate(period.end)}`
      : new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric" }).format(parseIsoDate(anchor));

  return (
    <>
      <PageHeader
        title="Plantafel"
        description="Mitarbeiter, Fahrzeuge, Geräte und Baustellen im Wochen- oder Monatsraster planen."
        actionHref={context.canManage ? "/baustellen/neu" : undefined}
        actionLabel={context.canManage ? "Baustelle anlegen" : undefined}
        actionIcon={Plus}
      />
      <MessageBox error={error || queryError} success={success} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CalendarDays} label="Planungen im Zeitraum" value={assignments.length} tone="green" />
        <StatCard icon={Wrench} label="Aktive Einsaetze" value={activeAssignments} tone="info" />
        <StatCard icon={TriangleAlert} label="Kritische Risiken" value={criticalConflicts + criticalWeatherRisks} tone={criticalConflicts + criticalWeatherRisks > 0 ? "danger" : "green"} />
        <StatCard icon={TriangleAlert} label="Warnungen" value={warningConflicts + warningWeatherRisks} tone={warningConflicts + warningWeatherRisks > 0 ? "warning" : "neutral"} />
      </div>

      <section className="dashboard-band mb-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="section-title">Zeitraum</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{currentPeriodLabel}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={previousHref} className="btn-secondary">
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Zurück
            </Link>
            <Link href={boardHref({ view, date: todayIso() })} className="btn-secondary">
              Heute
            </Link>
            <Link href={nextHref} className="btn-secondary">
              Weiter
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-end">
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-white p-1">
            {(["week", "month"] as const).map((option) => (
              <Link
                key={option}
                href={boardHref({ view: option, date: anchor })}
                className={cn(
                  "rounded-md px-4 py-3 text-center text-sm font-black transition",
                  view === option ? "bg-primary text-white shadow-sm" : "text-slate-600 hover:bg-mint hover:text-primary"
                )}
              >
                {option === "week" ? "Wochenansicht" : "Monatsansicht"}
              </Link>
            ))}
          </div>
          <form action="/plantafel" className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input type="hidden" name="view" value={view} />
            <div>
              <label className="field-label" htmlFor="date">
                Startdatum
              </label>
              <input className="field-input" id="date" name="date" type="date" defaultValue={anchor} />
            </div>
            <button className="btn-primary self-end" type="submit">
              Anzeigen
            </button>
          </form>
          <p className="rounded-md border border-line bg-fog p-3 text-sm font-semibold text-slate-600">
            Desktop: Blöcke ziehen. Mobile: Planungen als Karten.
          </p>
        </div>
      </section>

      {context.canManage ? (
        <div className="mb-5 grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
          <FormSection title="Planung eintragen" description="Ressource wählen, Baustelle zuordnen und Zeitraum festlegen. Konflikte werden danach sichtbar markiert.">
            <form action={createPlanningAssignmentAction} className="grid gap-3 lg:grid-cols-2" data-testid="planning-assignment-form">
              <input type="hidden" name="return_to" value={returnTo} />
              <div>
                <label className="field-label" htmlFor="resource_key">
                  Ressource
                </label>
                <select className="field-input" id="resource_key" name="resource_key" required>
                  <option value="">Auswählen</option>
                  {employees.length > 0 ? (
                    <optgroup label="Mitarbeiter">
                      {employees.map((employee) => (
                        <option key={employee.id} value={`employee:${employee.id}`}>
                          {employeeLabel(employee)}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {vehicles.length > 0 ? (
                    <optgroup label="Fahrzeuge">
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={`vehicle:${vehicle.id}`}>
                          {vehicle.name}
                          {vehicle.license_plate ? ` (${vehicle.license_plate})` : ""}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                  {resources.length > 0 ? (
                    <optgroup label="Geräte & Ressourcen">
                      {resources.map((resource) => (
                        <option key={resource.id} value={`equipment:${resource.id}`}>
                          {resource.name} · {resourceKindLabels[resource.resource_kind]}
                        </option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="jobsite_id">
                  Baustelle
                </label>
                <select className="field-input" id="jobsite_id" name="jobsite_id">
                  <option value="">Ohne Baustelle / interner Blocker</option>
                  {jobsites.map((jobsite) => (
                    <option key={jobsite.id} value={jobsite.id}>
                      {jobsite.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="title">
                  Titel
                </label>
                <input className="field-input" id="title" name="title" placeholder="z. B. Baustelle Müller oder Werkstatt" />
              </div>
              <div>
                <label className="field-label" htmlFor="status">
                  Status
                </label>
                <select className="field-input" id="status" name="status" defaultValue="geplant">
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {planningStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="start_date">
                  Von
                </label>
                <input className="field-input" id="start_date" name="start_date" type="date" defaultValue={period.start} required />
              </div>
              <div>
                <label className="field-label" htmlFor="end_date">
                  Bis
                </label>
                <input className="field-input" id="end_date" name="end_date" type="date" defaultValue={period.start} required />
              </div>
              <div>
                <label className="field-label" htmlFor="color">
                  Farbe
                </label>
                <input className="field-input h-12" id="color" name="color" type="color" defaultValue="#2E7D32" />
              </div>
              <div className="lg:col-span-2">
                <label className="field-label" htmlFor="notes">
                  Notiz
                </label>
                <textarea className="field-input min-h-24" id="notes" name="notes" placeholder="Teamhinweis, Besonderheit, Materialrisiko ..." />
              </div>
              <div className="lg:col-span-2">
                <SubmitButton className="w-full sm:w-auto">Planung speichern</SubmitButton>
              </div>
            </form>
          </FormSection>

          <FormSection title="Gerät oder Ressource anlegen" description="Werkzeuge, Maschinen oder sonstige Ressourcen können danach eingeplant werden.">
            <form action={createPlanningResourceAction} className="grid gap-3" data-testid="planning-resource-form">
              <input type="hidden" name="return_to" value={returnTo} />
              <div>
                <label className="field-label" htmlFor="name">
                  Name
                </label>
                <input className="field-input" id="name" name="name" placeholder="z. B. Kran, Brenner, Geruest" required />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="resource_kind">
                    Art
                  </label>
                  <select className="field-input" id="resource_kind" name="resource_kind" defaultValue="maschine">
                    {resourceKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {resourceKindLabels[kind]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="resource_status">
                    Status
                  </label>
                  <select className="field-input" id="resource_status" name="status" defaultValue="verfuegbar">
                    {resourceStatuses
                      .filter((status) => status !== "archiviert")
                      .map((status) => (
                        <option key={status} value={status}>
                          {resourceStatusLabels[status]}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="resource_notes">
                  Notiz
                </label>
                <textarea className="field-input min-h-24" id="resource_notes" name="notes" />
              </div>
              <SubmitButton variant="secondary" className="w-full">
                Ressource anlegen
              </SubmitButton>
            </form>
          </FormSection>
        </div>
      ) : null}

      <PlanningBoard
        days={period.days}
        rows={rows}
        assignments={assignments}
        conflicts={conflicts}
        weatherRisks={weatherResult.risks}
        view={view}
        canManage={context.canManage}
        returnTo={returnTo}
      />

      {context.canManage ? (
        <section className="dashboard-band mt-5">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="section-title">Planungen im Zeitraum</h2>
              <p className="mt-1 text-sm text-slate-500">Archivieren entfernt den Block aus der Plantafel, loescht ihn aber nicht hart.</p>
            </div>
          </div>
          {assignments.length === 0 ? (
            <p className="rounded-md border border-dashed border-line bg-white p-4 text-sm font-semibold text-slate-500">
              Noch keine Planungen im gewaehlten Zeitraum.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {assignments.map((assignment) => (
                <article key={assignment.id} className="rounded-lg border border-line bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink">{assignment.title}</p>
                      <p className="mt-1 text-sm font-semibold text-slate-600">{assignmentMeta(assignment)}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {formatDate(assignment.start_date)} bis {formatDate(assignment.end_date)}
                      </p>
                    </div>
                    <span className="rounded-md bg-mint px-2 py-1 text-xs font-black text-primary">
                      {planningStatusLabels[assignment.status]}
                    </span>
                  </div>
                  {conflicts[assignment.id]?.length ? (
                    <div className="mt-3 space-y-1">
                      {conflicts[assignment.id].map((conflict, index) => (
                        <p key={`${conflict.type}:${index}`} className="rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-900">
                          {conflict.message}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <form action={archivePlanningAssignmentAction} className="mt-3">
                    <input type="hidden" name="return_to" value={returnTo} />
                    <input type="hidden" name="assignment_id" value={assignment.id} />
                    <SubmitButton variant="secondary" className="w-full">
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      Archivieren
                    </SubmitButton>
                  </form>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
