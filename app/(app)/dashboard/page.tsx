import Link from "next/link";
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
  ShoppingCart,
  TriangleAlert,
  type LucideIcon
} from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { updatePurchaseSuggestionStatusAction } from "@/lib/actions/bring-list-actions";
import { createTaskAction, deleteTaskAction, updateTaskStatusAction } from "@/lib/actions/task-actions";
import { requireAppContext } from "@/lib/auth";
import { formatQuantity, isLowStock } from "@/lib/inventory";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { InventoryItem, Jobsite, MaterialAlert, Profile, PurchaseSuggestion, Report, Task } from "@/types/app";

function schemaSetupMessage(message?: string) {
  if (!message) return null;
  if (message.includes("Could not find the table") && message.includes("schema cache")) {
    return "Datenbank-Update fehlt: Bitte die Supabase-Migration fuer Materialwarnungen/Einkaufsvorschlaege ausfuehren.";
  }
  return message;
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const todayIso = new Date().toISOString().slice(0, 10);
  const lowStockPromise = context.canManage
    ? supabase
        .from("inventory_items")
        .select("*")
        .eq("company_id", context.companyId)
        .order("name", { ascending: true })
        .limit(80)
    : Promise.resolve({ data: [], error: null });
  const materialAlertsPromise = context.canManage
    ? supabase
        .from("material_alerts")
        .select("*, inventory_items(id, name, unit, stock, minimum_stock), jobsites(id, name, address, customer), bring_lists(id, title, date)")
        .eq("company_id", context.companyId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(6)
    : Promise.resolve({ data: [], error: null });
  const purchaseSuggestionsPromise = context.canManage
    ? supabase
        .from("purchase_suggestions")
        .select("*, inventory_items(id, name, unit, stock, minimum_stock), jobsites(id, name, address, customer), bring_lists(id, title, date)")
        .eq("company_id", context.companyId)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(6)
    : Promise.resolve({ data: [], error: null });
  const bringListsPromise = !context.canManage
    ? supabase.from("bring_lists").select("id").gte("date", todayIso).limit(20)
    : Promise.resolve({ data: [], error: null });

  const [
    jobsitesResult,
    reportsResult,
    tasksResult,
    employeesResult,
    lowStockResult,
    materialAlertsResult,
    purchaseSuggestionsResult,
    bringListsResult
  ] = await Promise.all([
    supabase
      .from("jobsites")
      .select("*")
      .in("status", ["geplant", "aktiv"])
      .order("start_date", { ascending: true, nullsFirst: false })
      .limit(5),
    supabase
      .from("reports")
      .select("*, jobsites(id, name, customer, address)")
      .order("report_date", { ascending: false })
      .limit(5),
    supabase
      .from("tasks")
      .select("*, jobsites(id, name), profiles!tasks_assigned_to_fkey(id, full_name, email)")
      .neq("status", "erledigt")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase.from("profiles").select("*").eq("active", true).order("full_name", { ascending: true }),
    lowStockPromise,
    materialAlertsPromise,
    purchaseSuggestionsPromise,
    bringListsPromise
  ]);

  const jobsites = (jobsitesResult.data ?? []) as Jobsite[];
  const reports = (reportsResult.data ?? []) as Report[];
  const tasks = (tasksResult.data ?? []) as Task[];
  const employees = (employeesResult.data ?? []) as Profile[];
  const lowStock = ((lowStockResult.data ?? []) as InventoryItem[]).filter(isLowStock).slice(0, 5);
  const materialAlerts = (materialAlertsResult.data ?? []) as MaterialAlert[];
  const purchaseSuggestions = (purchaseSuggestionsResult.data ?? []) as PurchaseSuggestion[];
  const bringListCount = (bringListsResult.data ?? []).length;
  const dashboardError =
    error || schemaSetupMessage(materialAlertsResult.error?.message) || schemaSetupMessage(purchaseSuggestionsResult.error?.message);
  const todayLabel = new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(new Date());
  const greeting = context.canManage ? "Betriebszentrale" : "Mein Arbeitstag";

  return (
    <>
      <MessageBox error={dashboardError} success={success} />

      <section className="surface-strong overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="p-5 sm:p-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-mint px-3 py-1.5 text-xs font-bold text-moss">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              {todayLabel}
            </div>
            <p className="section-kicker mb-2">{context.canManage ? "Heute im Betrieb" : "Heute auf Baustelle"}</p>
            <h1 className="max-w-3xl text-3xl font-black tracking-normal text-ink sm:text-4xl">{greeting}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              {context.canManage
                ? "Aufträge steuern, Material sichern, Zeiten freigeben und Engpässe rechtzeitig erkennen."
                : "Deine Baustellen, Zeiten, Berichte, Mitbringlisten und Materialmeldungen sind direkt erreichbar."}
            </p>
            <div className="mt-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-signal" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase tracking-normal text-ink">Schnellaktionen</h2>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {context.canManage ? (
                <QuickAction href="/orders/new" icon={BriefcaseBusiness} title="Auftrag" description="Mit Maßen" primary />
              ) : (
                <QuickAction href="/time-tracking/new" icon={Clock3} title="Zeit" description="Heute eintragen" primary />
              )}
              {context.canManage ? <QuickAction href="/time-tracking" icon={Clock3} title="Zeiten" description="Freigaben" /> : null}
              {context.canManage ? <QuickAction href="/calendar" icon={CalendarDays} title="Kalender" description="Planung" /> : null}
              <QuickAction href="/berichte/neu" icon={ClipboardList} title="Bericht" description="Direkt erfassen" />
              {context.canManage ? (
                <QuickAction href="/materials/inventory" icon={Layers3} title="Lager" description="Bestand buchen" />
              ) : (
                <QuickAction href="/material-melden" icon={BellPlus} title="Material" description="Fehlt melden" />
              )}
              <QuickAction href="/bring-lists" icon={ListChecks} title="Mitbringen" description="Packlisten" />
            </div>
          </div>
          <div className="border-t border-line bg-ink p-5 text-white sm:p-7 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold text-white/70">{context.companyName}</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <HeroMetric label="Baustellen" value={jobsites.length} />
              <HeroMetric label="Aufgaben" value={tasks.length} />
              <HeroMetric
                label={context.canManage ? "Material" : "Berichte"}
                value={context.canManage ? lowStock.length : reports.length}
                alert={context.canManage && lowStock.length > 0}
              />
            </div>
            <p className="mt-5 rounded-md bg-white/10 p-3 text-sm leading-6 text-white/75">
              {context.canManage
                ? lowStock.length > 0
                  ? `${lowStock.length} Materialpositionen sind am Mindestbestand.`
                  : "Materialbestand sieht aktuell ruhig aus."
                : "Preise und Einkauf bleiben ausgeblendet. Deine Arbeitsbereiche sind direkt erreichbar."}
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-moss" aria-hidden="true" />
        <h2 className="text-sm font-black uppercase tracking-normal text-ink">Wichtig</h2>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <DashboardStat icon={Hammer} label={context.canManage ? "Aktive und geplante Baustellen" : "Meine Baustellen"} value={jobsites.length} href="/baustellen" />
        <DashboardStat icon={ClipboardList} label="Offene Aufgaben" value={tasks.length} href="#aufgaben" />
        {context.canManage ? (
          <DashboardStat icon={Layers3} label="Mindestbestand erreicht" value={lowStock.length} href="/materials/low-stock" />
        ) : (
          <DashboardStat icon={ListChecks} label="Mitbringlisten" value={bringListCount} href="/bring-lists" />
        )}
      </div>

      {context.canManage && (materialAlerts.length > 0 || purchaseSuggestions.length > 0) ? (
        <section className="surface mt-6 p-4 sm:p-5">
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
                <div key={alert.id} className="rounded-lg border border-line bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink">{alert.inventory_items?.name ?? "Materialmeldung"}</p>
                      <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        {alert.jobsites?.name ?? alert.bring_lists?.title ?? "Ohne Zuordnung"}
                        {alert.missing_quantity ? ` · fehlt ${formatQuantity(alert.missing_quantity)} ${alert.unit ?? ""}` : ""}
                      </p>
                    </div>
                    <StatusBadge value={alert.severity === "critical" ? "rejected" : "offen"} label={alert.severity === "critical" ? "Kritisch" : "Offen"} />
                  </div>
                </div>
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
                <div key={suggestion.id} className="rounded-lg border border-line bg-white p-3">
                  <div className="flex flex-col gap-3">
                    <div>
                      <p className="font-black text-ink">{suggestion.inventory_items?.name ?? "Freier Einkaufsvorschlag"}</p>
                      <p className="mt-1 text-sm text-slate-600">{suggestion.reason}</p>
                      <p className="mt-2 text-xs font-semibold text-slate-500">
                        Vorschlag: {formatQuantity(suggestion.quantity_needed)} {suggestion.unit}
                        {suggestion.jobsites?.name ? ` · ${suggestion.jobsites.name}` : ""}
                      </p>
                    </div>
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
                  </div>
                </div>
              ))}
              {purchaseSuggestions.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">Keine offenen Einkaufsvorschläge.</p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Baustellen im Fokus</h2>
              <p className="mt-1 text-sm text-slate-500">Geplant und aktiv, nach Startdatum sortiert.</p>
            </div>
            <Link href="/baustellen" className="inline-flex items-center gap-1 text-sm font-bold text-moss">
              Alle ansehen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
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

        <section className="surface p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Letzte Berichte</h2>
              <p className="mt-1 text-sm text-slate-500">Was zuletzt dokumentiert wurde.</p>
            </div>
            <Link href="/berichte" className="inline-flex items-center gap-1 text-sm font-bold text-moss">
              Alle ansehen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
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

      <div className="mt-6 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <section id="aufgaben" className="surface p-4 sm:p-5">
          <div className="mb-4">
            <h2 className="section-title">Offene Aufgaben</h2>
            <p className="mt-1 text-sm text-slate-500">Direkt aktualisieren, ohne die Seite zu wechseln.</p>
          </div>
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="rounded-lg border border-line bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{task.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{task.description || "Keine Beschreibung"}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {task.jobsites?.name ?? "Ohne Baustelle"} · Fällig: {formatDate(task.due_date)}
                    </p>
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
                      <SubmitButton variant="danger">Löschen</SubmitButton>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
            {tasks.length === 0 ? (
              <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-600">
                Keine offenen Aufgaben.
              </p>
            ) : null}
          </div>
        </section>

        {context.canManage ? (
          <section className="surface p-4 sm:p-5">
            <h2 className="section-title mb-1">Neue Aufgabe</h2>
            <p className="mb-4 text-sm text-slate-500">Kurz erfassen, später im Ablauf schließen.</p>
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
          </section>
        ) : (
          <section className="surface p-4 sm:p-5">
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
    </>
  );
}

function DashboardStat({
  icon: Icon,
  label,
  value,
  href
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link href={href} className="interactive-surface flex items-center gap-3 p-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-moss ring-1 ring-moss/10">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-black text-ink">{value}</p>
        <p className="text-sm font-medium text-slate-600">{label}</p>
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
  primary = false
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        primary
          ? "flex min-h-24 flex-col justify-between rounded-lg bg-ink p-4 text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-moss"
          : "flex min-h-24 flex-col justify-between rounded-lg border border-line bg-white p-4 text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-moss/30 hover:bg-mint/60"
      }
    >
      <div className={primary ? "text-white" : "text-moss"}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-bold">{title}</p>
        <p className={primary ? "text-sm text-white/70" : "text-sm text-slate-500"}>{description}</p>
      </div>
    </Link>
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
