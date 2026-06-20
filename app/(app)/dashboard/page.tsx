import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BellPlus,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Clock3,
  Hammer,
  Layers3,
  ListChecks,
  Camera,
  ShoppingCart,
  Sparkles,
  TriangleAlert,
  UserMinus,
  Users
} from "lucide-react";
import {
  AlertCard,
  FormSection,
  QuickActionButton,
  ResponsiveTableCard,
  SectionHeader,
  StatCard,
  TodayJobsiteFocus
} from "@/components/construction-ui";
import { MessageBox } from "@/components/message-box";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { VoiceQuickAction } from "@/components/voice/VoiceQuickAction";
import { LiveWeatherCard } from "@/components/weather/LiveWeatherCard";
import { updatePurchaseSuggestionStatusAction } from "@/lib/actions/bring-list-actions";
import { createTaskAction, deleteTaskAction, updateTaskStatusAction } from "@/lib/actions/task-actions";
import { requireAppContext, type AppContext } from "@/lib/auth";
import { loadDashboardDetails, loadDashboardSummary, type DashboardSummary } from "@/lib/data/dashboard";
import { formatQuantity } from "@/lib/inventory";
import { materialStatusText } from "@/lib/inventory/material-intelligence";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMinutesAsHours } from "@/lib/time-tracking";
import { formatDate, searchParamMessage } from "@/lib/utils";
import { whyBauProSalesHighlights } from "@/lib/why-baupro";

type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function schemaSetupMessage(
  error?: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null
) {
  if (!error) return null;
  const message = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" ");
  if (message.includes("get_dashboard_summary")) {
    return "Datenbank-Update fehlt: Bitte `supabase/migrations/20260619_dashboard_rpc.sql` im Supabase SQL Editor ausfuehren.";
  }
  if (message.includes("Could not find the table") && message.includes("schema cache")) {
    return "Datenbank-Update fehlt: Bitte die Supabase-Migration für Materialwarnungen/Einkaufsvorschlaege ausfuehren.";
  }
  return safeQueryErrorMessage(error);
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const summary = await loadDashboardSummary(supabase, context);
  const jobsites = summary.jobsitesActive.list;
  const reports = summary.reportsLatest.list;
  const tasks = summary.tasksOpen.list;
  const employees = summary.employeesActive.list;
  const bringListCount = summary.bringListsUpcomingCount;
  const todayTimeEntries = summary.todayTimeEntries.list;
  const todayTimeMinutes = summary.todayTimeEntries.netMinutes;
  const lowStockDisplayCount = Math.min(summary.lowStockCount, 5);
  const todayTimeEmployeeIds = new Set(todayTimeEntries.map((entry) => entry.employee_id));
  const employeesWithoutTimeToday = context.canManage ? employees.filter((employee) => !todayTimeEmployeeIds.has(employee.id)) : [];
  const unapprovedTimeEntries = todayTimeEntries.filter((entry) => entry.status === "draft" || entry.status === "submitted");
  const dashboardError = error || schemaSetupMessage(summary.error);
  const todayLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(new Date());
  const greeting = context.canManage ? "Betriebszentrale" : "Mein Arbeitstag";

  return (
    <div className="baupro-screen">
      <MessageBox error={dashboardError} success={success} />

      <section className="command-panel overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-5 sm:p-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs font-black text-white ring-1 ring-white/10">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {todayLabel}
            </div>
            <p className="mb-2 text-xs font-black uppercase tracking-normal text-warning">{context.canManage ? "Heute im Betrieb" : "Heute auf Baustelle"}</p>
            <h1 className="max-w-3xl text-3xl font-black tracking-normal text-white sm:text-4xl">{greeting}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              {context.canManage
                ? "Aufträge steuern, Material sichern, Zeiten freigeben und Engpässe rechtzeitig erkennen."
                : "Deine Baustellen, Zeiten, Berichte, Mitbringlisten und Materialmeldungen sind direkt erreichbar."}
            </p>
            <div className="mt-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-warning" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase tracking-normal text-white">Schnellaktionen</h2>
            </div>
            {context.canManage ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <QuickActionButton href="/orders/new" icon={BriefcaseBusiness} title="Auftrag" description="Mit Maßen" primary />
                <QuickActionButton href="/time-tracking/daily" icon={Clock3} title="Tagesstunden" description="Prüfen" />
                <QuickActionButton href="/plantafel" icon={CalendarDays} title="Plantafel" description="Team planen" />
                <QuickActionButton href="/berichte/neu" icon={ClipboardList} title="Bericht" description="Direkt erfassen" />
                <QuickActionButton href="/materials/inventory" icon={Layers3} title="Lager" description="Bestand buchen" />
                <VoiceQuickAction title="Sprache" description="Direkt sortieren" />
              </div>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <QuickActionButton href="/time/new" icon={Clock3} title="Stunden" description="Heute eintragen" primary />
                <VoiceQuickAction title="Sprache" description="Aufnehmen" kind="time_tracking" />
                <QuickActionButton href="/berichte/neu" icon={ClipboardList} title="Bericht" description="Schreiben" />
                <QuickActionButton href="/bring-lists/new" icon={ListChecks} title="Material morgen" description="Mitbringen" />
                <QuickActionButton href="/material-melden" icon={BellPlus} title="Material fehlt" description="Melden" />
                <QuickActionButton href="/berichte/neu" icon={Camera} title="Foto" description="Hochladen" />
              </div>
            )}
          </div>
          <div className="border-t border-white/10 bg-slate-900 p-5 text-white sm:p-7 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold text-white/70">{context.companyName}</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <HeroMetric label="Baustellen" value={jobsites.length} />
              <HeroMetric label="Aufgaben" value={tasks.length} />
              <HeroMetric
                label={context.canManage ? "Material" : "Berichte"}
                value={context.canManage ? lowStockDisplayCount : reports.length}
                alert={context.canManage && lowStockDisplayCount > 0}
              />
            </div>
            <p className="mt-5 rounded-md bg-white/10 p-3 text-sm leading-6 text-white/75">
              {context.canManage
                ? lowStockDisplayCount > 0
                  ? `${lowStockDisplayCount} Materialpositionen sind am Mindestbestand.`
                  : "Materialbestand sieht aktuell ruhig aus."
                : "Preise und Einkauf bleiben ausgeblendet. Deine Arbeitsbereiche sind direkt erreichbar."}
            </p>
          </div>
        </div>
      </section>

      {!context.canManage ? (
        <TodayJobsiteFocus
          jobsite={jobsites[0]}
          roleLabel={context.profile.role === "vorarbeiter" ? "Team-Einsatz heute" : "Mein Einsatz heute"}
        />
      ) : null}

      <section>
        <SectionHeader
          eyebrow="Wichtig"
          title={context.canManage ? "Betriebsampel" : "Mein Überblick"}
          description={
            context.canManage
              ? "Die wichtigsten Kennzahlen für Baustellen, Zeiten und Material auf einen Blick."
              : "Alles, was du auf der Baustelle schnell brauchst, ohne Preise oder interne Chef-Daten."
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Hammer} label={context.canManage ? "Offene Baustellen" : "Meine Baustellen"} value={jobsites.length} href="/baustellen" tone="green" />
        <StatCard icon={ClipboardList} label="Offene Tagesberichte" value={reports.length} href="/berichte" tone="info" />
        <StatCard
          icon={Clock3}
          label={context.canManage ? "Heute erfasste Stunden" : "Meine Aufgaben"}
          value={context.canManage ? formatMinutesAsHours(todayTimeMinutes) : tasks.length}
          detail={context.canManage ? `${unapprovedTimeEntries.length} noch nicht genehmigt` : undefined}
          href={context.canManage ? "/time-tracking/daily?range=today" : "/dashboard#aufgaben"}
          tone={context.canManage ? (unapprovedTimeEntries.length > 0 ? "warning" : "green") : tasks.length > 0 ? "warning" : "neutral"}
        />
        {context.canManage ? (
          <StatCard icon={Layers3} label="Materialwarnungen" value={lowStockDisplayCount} href="/materials/low-stock" tone={lowStockDisplayCount > 0 ? "warning" : "green"} />
        ) : (
          <StatCard icon={ListChecks} label="Mitbringlisten" value={bringListCount} href="/bring-lists" tone="green" />
        )}
        {context.canManage ? (
          <StatCard
            icon={UserMinus}
            label="Ohne Zeiteintrag heute"
            value={employeesWithoutTimeToday.length}
            href="/time-tracking/daily?range=today"
            tone={employeesWithoutTimeToday.length > 0 ? "warning" : "neutral"}
          />
        ) : null}
        {context.canManage ? <StatCard icon={Users} label="Team aktiv" value={employees.length} href="/team" tone="dark" /> : null}
        </div>
      </section>

      {context.canManage ? (
        <section className="mt-6 surface-strong p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-mint px-3 py-1 text-xs font-black text-moss">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Warum BauPro?
              </div>
              <h2 className="section-title">Wechselgruende für Handwerksbetriebe</h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Nutze diese Punkte in der Demo: BauPro spart Zeit, senkt Fehlkosten, verhindert Preis-Leaks und automatisiert
                Baustellenablaeufe.
              </p>
            </div>
            <Link href="/warum-baupro" className="btn-primary w-full lg:w-auto">
              Nutzen ansehen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {whyBauProSalesHighlights.map((highlight) => (
              <div key={highlight.label} className="rounded-md border border-line bg-white p-3">
                <p className="text-sm font-black text-ink">{highlight.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{highlight.value}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Suspense fallback={null}>
        {context.canManage ? <DashboardManagedDetails supabase={supabase} context={context} summary={summary} /> : null}
      </Suspense>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="dashboard-band">
          <SectionHeader
            title={context.canManage ? "Baustellen im Fokus" : "Meine Baustellen"}
            description="Geplant und aktiv, nach Startdatum sortiert."
            actionHref="/baustellen"
            actionLabel="Alle ansehen"
          />
          <div className="space-y-3">
            {jobsites.map((jobsite) => (
              <Link
                key={jobsite.id}
                href={`/baustellen/${jobsite.id}`}
                className="group block rounded-lg border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-moss/30 hover:shadow-soft"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-ink">{jobsite.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">{jobsite.customer}</p>
                    <p className="mt-1 text-xs text-slate-500">{jobsite.address}</p>
                  </div>
                  <StatusBadge value={jobsite.status} />
                </div>
                <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-500">
                  <span>Start: {formatDate(jobsite.start_date)}</span>
                  <span className="text-moss opacity-0 transition group-hover:opacity-100">Öffnen</span>
                </div>
              </Link>
            ))}
            {jobsites.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">
                Keine geplanten oder aktiven Baustellen sichtbar.
              </p>
            ) : null}
          </div>
        </section>

        <section className="dashboard-band">
          <SectionHeader
            title="Letzte Berichte"
            description="Was zuletzt dokumentiert wurde."
            actionHref="/berichte"
            actionLabel="Alle ansehen"
          />
          <div className="space-y-3">
            {reports.map((report) => (
              <Link
                key={report.id}
                href={`/berichte/${report.id}`}
                className="block rounded-lg border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-moss/30 hover:shadow-soft"
              >
                <p className="text-sm font-semibold text-ink">
                  {report.jobsites?.name ?? "Ohne Baustelle"}
                </p>
                <p className="mt-1 text-xs text-slate-500">{formatDate(report.report_date)}</p>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">{report.activities}</p>
              </Link>
            ))}
            {reports.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">
                Noch keine Tagesberichte vorhanden.
              </p>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section id="aufgaben" className="dashboard-band">
          <SectionHeader title="Offene Aufgaben" description="Direkt aktualisieren, ohne die Seite zu wechseln." />
          <div className="space-y-3">
            {tasks.map((task) => (
              <ResponsiveTableCard
                key={task.id}
                title={task.title}
                meta={`${task.jobsites?.name ?? "Ohne Baustelle"} · Fällig: ${formatDate(task.due_date)}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="mt-1 text-sm text-slate-600">{task.description || "Keine Beschreibung"}</p>
                  </div>
                  <StatusBadge value={task.status} />
                </div>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <form action={updateTaskStatusAction} className="flex flex-1 flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="id" value={task.id} />
                    <select className="field-input" name="status" defaultValue={task.status}>
                      <option value="offen">Offen</option>
                      <option value="in_arbeit">In Arbeit</option>
                      <option value="erledigt">Erledigt</option>
                    </select>
                    <SubmitButton variant="secondary">Aktualisieren</SubmitButton>
                  </form>
                  {context.canManage ? (
                    <form action={deleteTaskAction}>
                      <input type="hidden" name="id" value={task.id} />
                      <SubmitButton variant="danger">Archivieren</SubmitButton>
                    </form>
                  ) : null}
                </div>
              </ResponsiveTableCard>
            ))}
            {tasks.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">
                Keine offenen Aufgaben.
              </p>
            ) : null}
          </div>
        </section>

        {context.canManage ? (
          <FormSection title="Neue Aufgabe" description="Kurz erfassen, später im Ablauf schließen.">
            <form action={createTaskAction} className="space-y-3">
              <div>
                <label className="field-label" htmlFor="title">
                  Titel
                </label>
                <input className="field-input" id="title" name="title" required />
              </div>
              <div>
                <label className="field-label" htmlFor="jobsite_id">
                  Baustelle
                </label>
                <select className="field-input" id="jobsite_id" name="jobsite_id" defaultValue="">
                  <option value="">Ohne Baustelle</option>
                  {jobsites.map((jobsite) => (
                    <option key={jobsite.id} value={jobsite.id}>
                      {jobsite.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="field-label" htmlFor="assigned_to">
                    Mitarbeiter
                  </label>
                  <select className="field-input" id="assigned_to" name="assigned_to" defaultValue="">
                    <option value="">Nicht zugewiesen</option>
                    {employees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.full_name || employee.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="due_date">
                    Fällig am
                  </label>
                  <input className="field-input" id="due_date" name="due_date" type="date" />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="description">
                  Beschreibung
                </label>
                <textarea className="field-input min-h-24" id="description" name="description" />
              </div>
              <SubmitButton className="w-full">Aufgabe anlegen</SubmitButton>
            </form>
          </FormSection>
        ) : (
          <section className="dashboard-band">
            <div className="flex gap-3">
              <TriangleAlert className="mt-1 h-5 w-5 text-signal" aria-hidden="true" />
              <div>
                <h2 className="font-semibold text-ink">Mitarbeiteransicht</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Du siehst hier deine Aufgaben und deine Berichte. Stammdaten verwalten Admin und Chef.
                </p>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

async function DashboardManagedDetails({
  supabase,
  context,
  summary
}: {
  supabase: SupabaseServerClient;
  context: AppContext;
  summary: DashboardSummary;
}) {
  const details = await loadDashboardDetails(supabase, context, summary);
  const todayTimeEntries = summary.todayTimeEntries.list;
  const todayTimeMinutes = summary.todayTimeEntries.netMinutes;
  const employees = summary.employeesActive.list;
  const todayTimeEmployeeIds = new Set(todayTimeEntries.map((entry) => entry.employee_id));
  const employeesWithoutTimeToday = employees.filter((employee) => !todayTimeEmployeeIds.has(employee.id));
  const unapprovedTimeEntries = todayTimeEntries.filter((entry) => entry.status === "draft" || entry.status === "submitted");
  const tomorrowMaterialStatuses = details.tomorrowMaterialStatuses;
  const tomorrowCriticalCount = tomorrowMaterialStatuses.reduce((sum, status) => sum + status.summary.criticalCount, 0);
  const tomorrowWarningCount = tomorrowMaterialStatuses.reduce((sum, status) => sum + status.summary.warningCount, 0);
  const materialAlerts = summary.materialAlertsOpen.list;
  const purchaseSuggestions = summary.purchaseSuggestionsOpen.list;

  return (
    <>
      <div className="mt-6">
        <LiveWeatherCard
          decision={details.liveWeatherDecision}
          weather={details.liveWeather}
          radarFrames={details.radarFrames}
          error={details.liveWeatherError}
        />
      </div>

      <section className="dashboard-band mt-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">Materialplanung morgen</h2>
            <p className="mt-1 text-sm text-slate-500">Mitbringlisten und Lagerstatus als schneller Chef-Check.</p>
          </div>
          <Link href="/bring-lists" className="inline-flex items-center gap-1 text-sm font-bold text-moss">
            Mitbringlisten öffnen
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard icon={ListChecks} label="Listen morgen" value={tomorrowMaterialStatuses.length} href="/bring-lists" tone="green" />
          <StatCard
            icon={TriangleAlert}
            label="Kritische Positionen"
            value={tomorrowCriticalCount}
            href="/materials/low-stock"
            tone={tomorrowCriticalCount > 0 ? "warning" : "green"}
          />
          <StatCard
            icon={Layers3}
            label="Knapp im Lager"
            value={tomorrowWarningCount}
            href="/materials/inventory"
            tone={tomorrowWarningCount > 0 ? "warning" : "neutral"}
          />
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {tomorrowMaterialStatuses.map((status) => (
            <AlertCard
              key={status.bringList.id}
              icon={ListChecks}
              title={status.bringList.title}
              description={materialStatusText(status)}
              meta={`${formatDate(status.bringList.date)} · ${status.positions.length} Positionen`}
              tone={status.summary.criticalCount > 0 ? "danger" : status.summary.warningCount > 0 ? "warning" : "green"}
              action={<Link href={`/bring-lists/${status.bringList.id}`} className="btn-secondary h-10 px-3 text-xs">Öffnen</Link>}
            />
          ))}
          {tomorrowMaterialStatuses.length === 0 ? (
            <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">
              Für morgen sind noch keine Mitbringlisten angelegt.
            </p>
          ) : null}
        </div>
      </section>

      <section className="dashboard-band mt-6">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">Tageskontrolle Zeiten</h2>
            <p className="mt-1 text-sm text-slate-500">Heute erfasste Stunden, offene Freigaben und fehlende Einträge.</p>
          </div>
          <Link href="/time-tracking/daily?range=today" className="inline-flex items-center gap-1 text-sm font-bold text-moss">
            Tagesstunden prüfen
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard icon={Clock3} label="Einträge heute" value={todayTimeEntries.length} href="/time-tracking/daily?range=today" tone="green" />
          <StatCard icon={Clock3} label="Netto heute" value={formatMinutesAsHours(todayTimeMinutes)} href="/time-tracking/daily?range=today" tone="dark" />
          <StatCard
            icon={ClipboardList}
            label="Nicht genehmigt"
            value={unapprovedTimeEntries.length}
            href="/time-tracking/daily?status=submitted"
            tone={unapprovedTimeEntries.length > 0 ? "warning" : "green"}
          />
          <StatCard
            icon={UserMinus}
            label="Ohne Eintrag"
            value={employeesWithoutTimeToday.length}
            href="/time-tracking/daily?range=today"
            tone={employeesWithoutTimeToday.length > 0 ? "warning" : "neutral"}
          />
        </div>
        {employeesWithoutTimeToday.length > 0 ? (
          <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm text-ink">
            <p className="font-bold">Noch ohne Zeiteintrag heute</p>
            <p className="mt-1 text-slate-600">
              {employeesWithoutTimeToday
                .slice(0, 6)
                .map((employee) => employee.full_name || employee.email)
                .join(", ")}
              {employeesWithoutTimeToday.length > 6 ? ` und ${employeesWithoutTimeToday.length - 6} weitere` : ""}
            </p>
          </div>
        ) : null}
      </section>

      {materialAlerts.length > 0 || purchaseSuggestions.length > 0 ? (
        <section className="dashboard-band mt-6">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="section-title">Material-Warnungen</h2>
              <p className="mt-1 text-sm text-slate-500">Fehlmaterial aus Mitbringlisten, Diktaten und Reservierungen.</p>
            </div>
            <Link href="/bring-lists" className="inline-flex items-center gap-1 text-sm font-bold text-moss">
              Mitbringlisten öffnen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-signal" aria-hidden="true" />
                <h3 className="text-sm font-black uppercase tracking-wide text-ink">Offene Meldungen</h3>
              </div>
              {materialAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  icon={TriangleAlert}
                  title={alert.inventory_items?.name ?? "Materialmeldung"}
                  description={alert.message}
                  meta={`${alert.jobsites?.name ?? alert.bring_lists?.title ?? "Ohne Zuordnung"}${
                    alert.missing_quantity ? ` · fehlt ${formatQuantity(alert.missing_quantity)} ${alert.unit ?? ""}` : ""
                  }`}
                  tone={alert.severity === "critical" ? "danger" : "warning"}
                  action={
                    <StatusBadge value={alert.severity === "critical" ? "rejected" : "offen"} label={alert.severity === "critical" ? "Kritisch" : "Offen"} />
                  }
                />
              ))}
              {materialAlerts.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">Keine offenen Materialmeldungen.</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-moss" aria-hidden="true" />
                <h3 className="text-sm font-black uppercase tracking-wide text-ink">Einkaufsvorschläge</h3>
              </div>
              {purchaseSuggestions.map((suggestion) => (
                <AlertCard
                  key={suggestion.id}
                  icon={ShoppingCart}
                  title={suggestion.inventory_items?.name ?? "Freier Einkaufsvorschlag"}
                  description={suggestion.reason}
                  meta={`Vorschlag: ${formatQuantity(suggestion.quantity_needed)} ${suggestion.unit}${
                    suggestion.jobsites?.name ? ` · ${suggestion.jobsites.name}` : ""
                  }`}
                  tone="green"
                  action={
                    <form action={updatePurchaseSuggestionStatusAction} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={suggestion.id} />
                      <button className="btn-secondary h-10 px-3 text-xs" type="submit" name="status" value="ordered">
                        Bestellt
                      </button>
                      <button className="btn-secondary h-10 px-3 text-xs" type="submit" name="status" value="received">
                        Erhalten
                      </button>
                      <button className="btn-secondary h-10 px-3 text-xs" type="submit" name="status" value="ignored">
                        Ignorieren
                      </button>
                    </form>
                  }
                />
              ))}
              {purchaseSuggestions.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">Keine offenen Einkaufsvorschläge.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}

function HeroMetric({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className="rounded-lg bg-white/10 p-3 ring-1 ring-white/10">
      <p className={alert ? "text-2xl font-black text-signal" : "text-2xl font-black text-white"}>{value}</p>
      <p className="mt-1 text-xs font-semibold text-white/60">{label}</p>
    </div>
  );
}
