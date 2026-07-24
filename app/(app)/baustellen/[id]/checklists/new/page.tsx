import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { JobsiteChecklistCreateForm } from "@/components/forms/jobsite-checklist-create-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { checklistTemplateSelect, jobsiteFormSelect } from "@/lib/data/selects";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isForeman, searchParamMessage } from "@/lib/utils";
import type { ChecklistTemplate, Jobsite } from "@/types/app";

export default async function NewJobsiteChecklistPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { id } = await params;
  const { error, success } = searchParamMessage(await searchParams);

  let jobsiteQuery = supabase
    .from("jobsites")
    .select(jobsiteFormSelect)
    .eq("company_id", context.companyId)
    .eq("id", id)
    .is("archived_at", null);
  if (!context.canManage) jobsiteQuery = jobsiteQuery.contains("assigned_employee_ids", [context.userId]);

  const [jobsiteResult, templatesResult] = await Promise.all([
    jobsiteQuery.maybeSingle(),
    supabase
      .from("checklist_templates")
      .select(checklistTemplateSelect)
      .or(`company_id.is.null,company_id.eq.${context.companyId}`)
      .eq("active", true)
      .is("archived_at", null)
      .order("category", { ascending: true })
      .order("name", { ascending: true })
  ]);

  const jobsite = jobsiteResult.data as Jobsite | null;
  if (!jobsite) notFound();
  if (!context.canManage && !isForeman(context.profile.role)) notFound();

  const templates = (templatesResult.data ?? []) as ChecklistTemplate[];
  const pageError = [error, safeQueryErrorMessage(templatesResult.error)].filter(Boolean).join(" ");

  return (
    <>
      <PageHeader
        title="Checkliste starten"
        description={`${jobsite.name} · ${jobsite.customer} · ${jobsite.address}`}
      />
      <MessageBox error={pageError || null} success={success} />
      <div className="mb-4">
        <Link href={`/baustellen/${jobsite.id}`} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zur Baustelle
        </Link>
      </div>
      {templates.length > 0 ? (
        <JobsiteChecklistCreateForm templates={templates} jobsiteId={jobsite.id} />
      ) : (
        <div className="surface p-4">
          <p className="font-black text-ink">Keine Vorlagen vorhanden.</p>
          <p className="mt-1 text-sm text-slate-600">Chef kann zuerst eine eigene Checklistenvorlage erstellen.</p>
          {context.canManage ? (
            <Link href="/checklists/templates/new" className="btn-primary mt-4">
              Vorlage erstellen
            </Link>
          ) : null}
        </div>
      )}
    </>
  );
}
