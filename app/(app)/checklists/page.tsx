import Link from "next/link";
import { ClipboardCheck, ClipboardList, ShieldCheck } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { JobsiteChecklistCreateForm } from "@/components/forms/jobsite-checklist-create-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireAppContext } from "@/lib/auth";
import { checklistCategoryLabels, checklistProgress, jobsiteChecklistStatusLabels } from "@/lib/checklists";
import { checklistTemplateSelect, jobsiteChecklistListSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, searchParamMessage, isForeman } from "@/lib/utils";
import type { ChecklistTemplate, Jobsite, JobsiteChecklist, JobsiteChecklistItem } from "@/types/app";

export default async function ChecklistsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);
  const canStartChecklists = context.canManage || isForeman(context.profile.role);

  let jobsiteQuery = supabase
    .from("jobsites")
    .select("id, name, customer, address")
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .order("start_date", { ascending: false })
    .limit(40);
  if (!context.canManage) jobsiteQuery = jobsiteQuery.contains("assigned_employee_ids", [context.userId]);

  const [checklistsResult, itemsResult, templatesResult, jobsitesResult] = await Promise.all([
    supabase
      .from("jobsite_checklists")
      .select(jobsiteChecklistListSelect)
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(80),
    supabase
      .from("jobsite_checklist_items")
      .select("id, checklist_id, status, required")
      .eq("company_id", context.companyId)
      .is("archived_at", null)
      .limit(600),
    supabase
      .from("checklist_templates")
      .select(checklistTemplateSelect)
      .or(`company_id.is.null,company_id.eq.${context.companyId}`)
      .eq("active", true)
      .is("archived_at", null)
      .order("company_id", { ascending: false, nullsFirst: false })
      .order("category", { ascending: true })
      .order("name", { ascending: true }),
    canStartChecklists ? jobsiteQuery : Promise.resolve({ data: [], error: null })
  ]);

  const checklists = (checklistsResult.data ?? []) as unknown as JobsiteChecklist[];
  const allItems = (itemsResult.data ?? []) as Pick<JobsiteChecklistItem, "id" | "checklist_id" | "status" | "required">[];
  const templates = (templatesResult.data ?? []) as ChecklistTemplate[];
  const jobsites = (jobsitesResult.data ?? []) as Array<Pick<Jobsite, "id" | "name" | "customer" | "address">>;
  const itemsByChecklist = new Map<string, Pick<JobsiteChecklistItem, "id" | "checklist_id" | "status" | "required">[]>();
  for (const item of allItems) {
    const list = itemsByChecklist.get(item.checklist_id) ?? [];
    list.push(item);
    itemsByChecklist.set(item.checklist_id, list);
  }

  const pageError = [
    error,
    safeQueryErrorMessage(checklistsResult.error),
    safeQueryErrorMessage(itemsResult.error),
    safeQueryErrorMessage(templatesResult.error),
    safeQueryErrorMessage(jobsitesResult.error)
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHeader
        title="Checklisten"
        description="Wiederverwendbare Baustellen-, Sicherheits-, Abnahme- und Materialchecks mit Foto-Nachweis, Problem-Aufgaben und PDF."
        actionHref={context.canManage ? "/checklists/templates/new" : undefined}
        actionLabel={context.canManage ? "Vorlage erstellen" : undefined}
        actionIcon={ClipboardList}
      />
      <MessageBox error={pageError || null} success={success} />

      {canStartChecklists && templates.length > 0 && jobsites.length > 0 ? (
        <section className="mb-5">
          <JobsiteChecklistCreateForm templates={templates} jobsites={jobsites} />
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="surface-strong p-4">
          <p className="meta-label">Aktive Checklisten</p>
          <p className="mt-2 text-3xl font-black text-ink">{checklists.length}</p>
        </article>
        <article className="surface-strong p-4">
          <p className="meta-label">Offene Probleme</p>
          <p className="mt-2 text-3xl font-black text-amber-700">
            {allItems.filter((item) => item.status === "problem").length}
          </p>
        </article>
        <article className="surface-strong p-4">
          <p className="meta-label">Vorlagen</p>
          <p className="mt-2 text-3xl font-black text-ink">{templates.length}</p>
        </article>
      </section>

      <section className="mt-5">
        {checklists.length === 0 ? (
          <EmptyState
            icon={ClipboardCheck}
            title="Noch keine Baustellen-Checklisten"
            description="Starte oben eine Vorlage für eine Baustelle. Auf dem Handy kann das Team die Punkte direkt abhaken und Probleme melden."
            actionHref={context.canManage ? "/checklists/templates/new" : undefined}
            actionLabel={context.canManage ? "Vorlage erstellen" : undefined}
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {checklists.map((checklist) => {
              const progress = checklistProgress(itemsByChecklist.get(checklist.id) ?? []);
              return (
                <Link
                  key={checklist.id}
                  href={`/checklists/${checklist.id}`}
                  className="surface-strong construction-rail block p-4 transition hover:border-moss hover:shadow-lift"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-mint px-2 py-1 text-xs font-black text-moss">
                          {checklistCategoryLabels[checklist.category]}
                        </span>
                        <StatusBadge value={checklist.status} label={jobsiteChecklistStatusLabels[checklist.status]} />
                      </div>
                      <h2 className="mt-3 text-lg font-black text-ink">{checklist.title}</h2>
                      <p className="mt-1 text-sm font-semibold text-slate-600">
                        {checklist.jobsites?.name ?? "Baustelle"} · {checklist.jobsites?.customer ?? "Kunde"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        Faellig {formatDate(checklist.due_date)} · Aktualisiert {formatDateTime(checklist.updated_at)}
                      </p>
                    </div>
                    <div className="min-w-32 rounded-md bg-fog p-3 text-right">
                      <p className="text-2xl font-black text-ink">{progress.percent}%</p>
                      <p className="text-xs font-bold text-slate-500">
                        {progress.done}/{progress.total} erledigt
                      </p>
                    </div>
                  </div>
                  {progress.problems > 0 || progress.requiredOpen > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                      {progress.problems > 0 ? (
                        <span className="rounded-md bg-red-50 px-2 py-1 text-red-700">{progress.problems} Problem(e)</span>
                      ) : null}
                      {progress.requiredOpen > 0 ? (
                        <span className="rounded-md bg-amber-50 px-2 py-1 text-amber-800">{progress.requiredOpen} Pflicht offen</span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-moss">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      Keine offenen Pflichtprobleme
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
