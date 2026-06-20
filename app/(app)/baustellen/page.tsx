import Link from "next/link";
import { HardHat, MapPin, Plus } from "lucide-react";
import { JobsiteCard, StatCard } from "@/components/construction-ui";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { searchOrFilter } from "@/lib/data/shared";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn, searchParamMessage } from "@/lib/utils";
import type { Jobsite, JobsiteStatus } from "@/types/app";

const pageSize = 12;
const statusFilters: Array<{ value: "alle" | JobsiteStatus; label: string }> = [
  { value: "alle", label: "Alle" },
  { value: "aktiv", label: "Aktiv" },
  { value: "geplant", label: "Geplant" },
  { value: "abgeschlossen", label: "Abgeschlossen" }
];

function stringParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function pageParam(value: string | string[] | undefined) {
  const parsed = Number(stringParam(value));
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 1;
}

function statusParam(value: string | string[] | undefined): "alle" | JobsiteStatus {
  const raw = stringParam(value);
  return raw === "aktiv" || raw === "geplant" || raw === "abgeschlossen" ? raw : "alle";
}

function filterHref({
  status,
  page,
  q
}: {
  status: "alle" | JobsiteStatus;
  page?: number;
  q?: string;
}) {
  const params = new URLSearchParams();
  if (status !== "alle") params.set("status", status);
  if (page && page > 1) params.set("page", String(page));
  if (q) params.set("q", q);
  const query = params.toString();
  return query ? `/baustellen?${query}` : "/baustellen";
}

export default async function JobsitesPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = await searchParams;
  const { error, success } = searchParamMessage(resolvedSearchParams);
  const page = pageParam(resolvedSearchParams?.page);
  const selectedStatus = statusParam(resolvedSearchParams?.status);
  const q = stringParam(resolvedSearchParams?.q).trim().slice(0, 80);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let jobsitesQuery = supabase
    .from("jobsites")
    .select("id, company_id, name, customer, address, start_date, status, notes, assigned_employee_ids, latitude, longitude, weather_last_checked_at, created_at", {
      count: "exact"
    })
    .eq("company_id", context.companyId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!context.canManage) jobsitesQuery = jobsitesQuery.contains("assigned_employee_ids", [context.userId]);
  if (selectedStatus !== "alle") jobsitesQuery = jobsitesQuery.eq("status", selectedStatus);
  if (q) jobsitesQuery = jobsitesQuery.or(searchOrFilter(["name", "customer", "address"], q));

  let activeCountQuery = supabase
    .from("jobsites")
    .select("id", { count: "exact", head: true })
    .eq("company_id", context.companyId)
    .eq("status", "aktiv");
  let plannedCountQuery = supabase
    .from("jobsites")
    .select("id", { count: "exact", head: true })
    .eq("company_id", context.companyId)
    .eq("status", "geplant");
  let doneCountQuery = supabase
    .from("jobsites")
    .select("id", { count: "exact", head: true })
    .eq("company_id", context.companyId)
    .eq("status", "abgeschlossen");

  if (!context.canManage) {
    activeCountQuery = activeCountQuery.contains("assigned_employee_ids", [context.userId]);
    plannedCountQuery = plannedCountQuery.contains("assigned_employee_ids", [context.userId]);
    doneCountQuery = doneCountQuery.contains("assigned_employee_ids", [context.userId]);
  }

  const [jobsitesResult, activeCountResult, plannedCountResult, doneCountResult] = await Promise.all([
    jobsitesQuery,
    activeCountQuery,
    plannedCountQuery,
    doneCountQuery
  ]);

  const jobsites = (jobsitesResult.data ?? []) as Jobsite[];
  const totalCount = jobsitesResult.count ?? jobsites.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const activeCount = activeCountResult.count ?? 0;
  const plannedCount = plannedCountResult.count ?? 0;
  const doneCount = doneCountResult.count ?? 0;

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

      <section className="surface mb-5 p-3 sm:p-4">
        <form className="grid gap-3 lg:grid-cols-[1fr_auto]" action="/baustellen">
          {selectedStatus !== "alle" ? <input type="hidden" name="status" value={selectedStatus} /> : null}
          <label>
            <span className="field-label">Suche</span>
            <input className="field-input" name="q" defaultValue={q} placeholder="Baustelle, Kunde oder Adresse" />
          </label>
          <button className="btn-primary self-end" type="submit">
            Suchen
          </button>
        </form>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {statusFilters.map((filter) => (
            <Link
              key={filter.value}
              href={filterHref({ status: filter.value, q })}
              className={cn(
                "rounded-md border px-3 py-2 text-sm font-black",
                selectedStatus === filter.value
                  ? "border-primary bg-primary text-white"
                  : "border-line bg-white text-slate-700 hover:border-primary/40"
              )}
            >
              {filter.label}
            </Link>
          ))}
        </div>
      </section>

      {jobsites.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Noch keine Baustellen"
          description="Lege die erste Baustelle an, damit Berichte und Aufgaben sauber zugeordnet werden können."
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
            <p className="text-sm font-semibold text-slate-500">
              {totalCount} Einträge · Seite {page} von {totalPages}
            </p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {jobsites.map((jobsite) => (
              <JobsiteCard key={jobsite.id} jobsite={jobsite} canManage={context.canManage} />
            ))}
          </div>
          {totalPages > 1 ? (
            <nav className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={filterHref({ status: selectedStatus, q, page: Math.max(1, page - 1) })}
                className={cn("btn-secondary", page <= 1 && "pointer-events-none opacity-50")}
              >
                Zurück
              </Link>
              <span className="text-center text-sm font-bold text-slate-500">
                {from + 1}-{Math.min(to + 1, totalCount)} von {totalCount}
              </span>
              <Link
                href={filterHref({ status: selectedStatus, q, page: Math.min(totalPages, page + 1) })}
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
