import Link from "next/link";
import { CalendarDays, ListChecks, MapPin, Plus, RefreshCw } from "lucide-react";
import { ContextualHelpTip } from "@/components/help/ContextualHelpTip";
import { EmptyState } from "@/components/empty-state";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { syncAutomaticBringListsAction } from "@/lib/actions/bring-list-actions";
import { requireAppContext } from "@/lib/auth";
import { bringListDetailSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { BringList } from "@/types/app";

const statusLabels = {
  draft: "Entwurf",
  ready: "Bereit",
  packed: "Gepackt",
  delivered: "Geliefert"
};

function inSevenDaysIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function tomorrowIsoDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

export default async function BringListsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const resolvedSearchParams = await searchParams;
  const { error, success } = searchParamMessage(resolvedSearchParams);
  const selectedDate = typeof resolvedSearchParams?.date === "string" ? resolvedSearchParams.date : null;
  const today = new Date().toISOString().slice(0, 10);
  const dateFrom = selectedDate || today;
  const dateTo = selectedDate || inSevenDaysIsoDate();
  const autoSyncDate = selectedDate || tomorrowIsoDate();

  let listsQuery = supabase
    .from("bring_lists")
    .select(bringListDetailSelect)
    .eq("company_id", context.companyId)
    .gte("date", dateFrom)
    .lte("date", dateTo)
    .order("date", { ascending: true });

  if (!context.canManage) listsQuery = listsQuery.or(`assigned_to.eq.${context.userId},created_by.eq.${context.userId}`);

  const { data, error: queryError } = await listsQuery.limit(60);
  let assignedJobsiteLists: BringList[] = [];

  if (!context.canManage) {
    const { data: assignedJobsites } = await supabase
      .from("jobsites")
      .select("id")
      .eq("company_id", context.companyId)
      .contains("assigned_employee_ids", [context.userId]);
    const assignedJobsiteIds = (assignedJobsites ?? []).map((jobsite) => jobsite.id as string);

    if (assignedJobsiteIds.length > 0) {
      const { data: extraLists } = await supabase
        .from("bring_lists")
        .select(bringListDetailSelect)
        .eq("company_id", context.companyId)
        .gte("date", dateFrom)
        .lte("date", dateTo)
        .in("job_id", assignedJobsiteIds)
        .order("date", { ascending: true })
        .limit(60);
      assignedJobsiteLists = (extraLists ?? []) as unknown as BringList[];
    }
  }

  const listsById = new Map<string, BringList>();
  for (const list of [...((data ?? []) as unknown as BringList[]), ...assignedJobsiteLists]) listsById.set(list.id, list);
  const lists = [...listsById.values()].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <>
      <PageHeader
        title="Mitbringlisten"
        description="Automatisch aus Auftrag, Plantafel, Materialplanung und Lager für die nächsten Baustellen."
        actionHref="/bring-lists/new"
        actionLabel="Neue Mitbringliste"
        actionIcon={Plus}
      />
      <MessageBox error={error || safeQueryErrorMessage(queryError)} success={success} />
      <ContextualHelpTip featureKey="bring_list_use" returnTo="/bring-lists" />

      <div className="mb-5 flex flex-wrap gap-2">
        <Link href="/bring-lists/new" className="btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Neue Mitbringliste
        </Link>
        {context.canOperate ? (
          <form action={syncAutomaticBringListsAction}>
            <input type="hidden" name="date" value={autoSyncDate} />
            <input type="hidden" name="return_to" value={selectedDate ? `/bring-lists?date=${selectedDate}` : "/bring-lists"} />
            <button type="submit" className="btn-primary">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Automatisch aktualisieren
            </button>
          </form>
        ) : null}
        {selectedDate ? (
          <Link href="/bring-lists" className="btn-secondary">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Alle nächsten Tage
          </Link>
        ) : null}
        <Link href="/bring-lists/tomorrow" className="btn-secondary">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          Morgen
        </Link>
      </div>

      {lists.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Keine Mitbringlisten"
          description="Erstelle eine Liste per Diktat, manuell oder direkt aus einem Auftrag."
          actionHref="/bring-lists/new"
          actionLabel="Mitbringliste erstellen"
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lists.map((list) => (
            <Link key={list.id} href={`/bring-lists/${list.id}`} className="interactive-surface block overflow-hidden p-0">
              <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
              <div className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="meta-label">{formatDate(list.date)}</p>
                    <h2 className="mt-1 text-lg font-black text-ink">{list.title}</h2>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{list.jobsites?.name ?? "Baustelle"}</p>
                    {list.auto_generated ? (
                      <p className="mt-2 inline-flex rounded-md bg-mint px-2 py-1 text-xs font-black text-moss">
                        Automatisch vorbereitet
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge value={list.status} label={statusLabels[list.status]} />
                </div>
                <p className="mt-4 flex items-start gap-2 rounded-md bg-fog p-3 text-sm text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden="true" />
                  {list.jobsites?.address ?? "Keine Adresse"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
