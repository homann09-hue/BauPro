import Link from "next/link";
import { AlertTriangle, Bell, CalendarDays, CheckCircle2, FileWarning, Plus, Search } from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import { markDefectNotificationReadAction } from "@/lib/actions/defect-actions";
import { requireAppContext } from "@/lib/auth";
import { defectPriorities, defectPriorityLabels, defectStatusLabels, defectStatuses, isDefectDueSoon, isDefectOverdue } from "@/lib/defects";
import { searchOrFilter } from "@/lib/data/shared";
import { defectListSelect, defectNotificationSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, searchParamMessage } from "@/lib/utils";
import type { Defect, DefectNotification, DefectPriority, DefectStatus, Jobsite, Profile } from "@/types/app";

type Search = Record<string, string | string[] | undefined>;

function param(searchParams: Search | undefined, key: string) {
  const value = searchParams?.[key];
  return typeof value === "string" ? value : "";
}

function isDefectStatus(value: string): value is DefectStatus {
  return defectStatuses.includes(value as DefectStatus);
}

function isDefectPriority(value: string): value is DefectPriority {
  return defectPriorities.includes(value as DefectPriority);
}

export default async function DefectsPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const resolvedSearch = await searchParams;
  const { error, success } = searchParamMessage(resolvedSearch);
  const status = param(resolvedSearch, "status");
  const priority = param(resolvedSearch, "priority");
  const jobsiteId = param(resolvedSearch, "jobsite_id");
  const q = param(resolvedSearch, "q").trim();

  let defectsQuery = supabase
    .from("defects")
    .select(defectListSelect)
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(120);

  if (isDefectStatus(status)) defectsQuery = defectsQuery.eq("status", status);
  if (isDefectPriority(priority)) defectsQuery = defectsQuery.eq("priority", priority);
  if (jobsiteId) defectsQuery = defectsQuery.eq("jobsite_id", jobsiteId);
  if (q) defectsQuery = defectsQuery.or(searchOrFilter(["title", "description"], q));

  const [defectsResult, jobsitesResult, employeesResult, notificationsResult] = await Promise.all([
    defectsQuery,
    supabase
      .from("jobsites")
      .select("id, name, customer, address")
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .order("name", { ascending: true }),
    context.canManage
      ? supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("company_id", context.companyId)
          .eq("active", true)
          .in("role", ["vorarbeiter", "mitarbeiter"])
          .order("full_name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("defect_notifications")
      .select(defectNotificationSelect)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .is("read_at", null)
      .order("created_at", { ascending: false })
      .limit(10)
  ]);

  const defects = (defectsResult.data ?? []) as unknown as Defect[];
  const jobsites = (jobsitesResult.data ?? []) as Pick<Jobsite, "id" | "name" | "customer" | "address">[];
  const employees = (employeesResult.data ?? []) as Pick<Profile, "id" | "full_name" | "email" | "role">[];
  const notifications = (notificationsResult.data ?? []) as unknown as DefectNotification[];
  const openCount = defects.filter((defect) => ["offen", "in_arbeit", "wartet_auf_kunde"].includes(defect.status)).length;
  const overdueCount = defects.filter((defect) => isDefectOverdue(defect)).length;
  const dueSoonCount = defects.filter((defect) => isDefectDueSoon(defect)).length;
  const customerVisibleCount = defects.filter((defect) => defect.visible_to_customer).length;
  const pageError = [
    error,
    safeQueryErrorMessage(defectsResult.error),
    safeQueryErrorMessage(jobsitesResult.error),
    safeQueryErrorMessage(employeesResult.error),
    safeQueryErrorMessage(notificationsResult.error)
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHeader
        title="Mängel"
        description="Schäden, offene Punkte und Kundenthemen mit Foto, Frist, Verantwortlichem und sauberem Abschluss verfolgen."
        actionHref="/maengel/neu"
        actionLabel="Mangel erfassen"
        actionIcon={Plus}
      />
      <MessageBox error={pageError || null} success={success} />

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Offen" value={openCount} icon={FileWarning} tone="bg-amber-50 text-amber-700" />
        <Stat label="Überfällig" value={overdueCount} icon={AlertTriangle} tone="bg-red-50 text-red-700" />
        <Stat label="Bald fällig" value={dueSoonCount} icon={CalendarDays} tone="bg-blue-50 text-info" />
        <Stat label="Kundenfreigaben" value={customerVisibleCount} icon={CheckCircle2} tone="bg-mint text-moss" />
      </section>

      {notifications.length > 0 ? (
        <section className="surface-strong mb-5 p-4 sm:p-5">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-amber-50 text-amber-700">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-black text-ink">Fristen im Blick</h2>
              <p className="text-sm text-slate-600">Benachrichtigungen bleiben intern und helfen beim Nachfassen.</p>
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-2">
            {notifications.map((notification) => (
              <article key={notification.id} className="rounded-lg border border-line bg-white p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-black text-ink">{notification.title}</p>
                    {notification.body ? <p className="mt-1 text-sm text-slate-600">{notification.body}</p> : null}
                    <p className="mt-2 text-xs font-semibold text-slate-500">
                      {notification.due_at ? `Frist: ${formatDate(notification.due_at)}` : `Erstellt: ${formatDateTime(notification.created_at)}`}
                    </p>
                  </div>
                  <form action={markDefectNotificationReadAction} className="shrink-0">
                    <input type="hidden" name="notification_id" value={notification.id} />
                    <input type="hidden" name="return_to" value="/maengel" />
                    <SubmitButton variant="secondary" className="min-h-10 px-3 text-xs">
                      Erledigt
                    </SubmitButton>
                  </form>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="surface mb-5 p-4 sm:p-5">
        <form className="grid gap-3 lg:grid-cols-[1fr_180px_180px_220px_auto]" action="/maengel">
          <label>
            <span className="field-label">Suche</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input className="field-input min-h-12 pl-9" name="q" defaultValue={q} placeholder="Titel oder Beschreibung" />
            </div>
          </label>
          <label>
            <span className="field-label">Status</span>
            <select className="field-input min-h-12" name="status" defaultValue={status}>
              <option value="">Alle</option>
              {defectStatuses.map((item) => (
                <option key={item} value={item}>
                  {defectStatusLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Priorität</span>
            <select className="field-input min-h-12" name="priority" defaultValue={priority}>
              <option value="">Alle</option>
              {defectPriorities.map((item) => (
                <option key={item} value={item}>
                  {defectPriorityLabels[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Baustelle</span>
            <select className="field-input min-h-12" name="jobsite_id" defaultValue={jobsiteId}>
              <option value="">Alle Baustellen</option>
              {jobsites.map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {jobsite.name}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-secondary min-h-12 self-end" type="submit">
            Filtern
          </button>
        </form>
      </section>

      <section className="grid gap-3">
        {defects.length === 0 ? (
          <div className="surface-strong p-6 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-moss" aria-hidden="true" />
            <h2 className="mt-3 text-lg font-black text-ink">Keine Mängel gefunden</h2>
            <p className="mt-1 text-sm text-slate-600">Sobald aus Foto, Bericht, Checkliste oder Kundennachricht ein Mangel entsteht, landet er hier.</p>
            <Link href="/maengel/neu" className="btn-primary mt-4">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ersten Mangel erfassen
            </Link>
          </div>
        ) : (
          defects.map((defect) => <DefectCard key={defect.id} defect={defect} employees={employees} />)
        )}
      </section>
    </>
  );
}

function Stat({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof AlertTriangle; tone: string }) {
  return (
    <article className="surface-strong p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="meta-label">{label}</p>
          <p className="mt-2 text-2xl font-black text-ink">{value}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-md ${tone}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}

function DefectCard({
  defect,
  employees
}: {
  defect: Defect;
  employees: Array<Pick<Profile, "id" | "full_name" | "email" | "role">>;
}) {
  const assignee = defect.profiles ?? employees.find((employee) => employee.id === defect.assigned_to);
  const overdue = isDefectOverdue(defect);

  return (
    <Link href={`/maengel/${defect.id}`} className="surface-strong block p-4 transition hover:border-moss hover:shadow-md sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={defect.status} label={defectStatusLabels[defect.status]} />
            <StatusBadge value={defect.priority} label={defectPriorityLabels[defect.priority]} />
            {overdue ? <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700">Überfällig</span> : null}
            {defect.visible_to_customer ? <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-info">Kunde sieht es</span> : null}
          </div>
          <h2 className="mt-3 text-lg font-black text-ink">{defect.title}</h2>
          {defect.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-600">{defect.description}</p> : null}
        </div>
        <div className="grid gap-2 text-sm lg:min-w-64">
          <Meta label="Baustelle" value={defect.jobsites?.name ?? "Keine Baustelle"} />
          <Meta label="Verantwortlich" value={assignee?.full_name || assignee?.email || "Noch offen"} />
          <Meta label="Frist" value={formatDate(defect.due_date)} />
        </div>
      </div>
    </Link>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-fog px-3 py-2">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 font-bold text-ink">{value}</p>
    </div>
  );
}
