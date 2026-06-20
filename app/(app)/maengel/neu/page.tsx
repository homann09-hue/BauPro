import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { DefectForm, type DefectFormDefaults } from "@/components/forms/defect-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, searchParamMessage } from "@/lib/utils";
import type { DefectSourceType, Jobsite, Profile } from "@/types/app";

type Search = Record<string, string | string[] | undefined>;

type ReportSource = {
  id: string;
  jobsite_id: string | null;
  report_date: string;
  activities: string | null;
  issues: string | null;
};

type PhotoSource = {
  id: string;
  report_id: string;
  jobsite_id: string;
  file_name: string;
};

type ChecklistItemSource = {
  id: string;
  checklist_id: string;
  jobsite_id: string;
  label: string;
  problem_description: string | null;
};

type MessageSource = {
  id: string;
  jobsite_id: string | null;
  sender_name: string;
  message: string;
};

function param(searchParams: Search | undefined, key: string) {
  const value = searchParams?.[key];
  return typeof value === "string" ? value : "";
}

function sourceType(value: string): DefectSourceType {
  if (value === "photo" || value === "report" || value === "checklist" || value === "customer_message") return value;
  return "manual";
}

export default async function NewDefectPage({ searchParams }: { searchParams?: Promise<Search> }) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const resolvedSearch = await searchParams;
  const { error, success } = searchParamMessage(resolvedSearch);
  const defaults: DefectFormDefaults = {
    jobsite_id: param(resolvedSearch, "jobsite_id") || null,
    source_type: sourceType(param(resolvedSearch, "source_type")),
    source_report_id: param(resolvedSearch, "source_report_id") || null,
    source_report_photo_id: param(resolvedSearch, "source_report_photo_id") || null,
    source_checklist_id: param(resolvedSearch, "source_checklist_id") || null,
    source_checklist_item_id: param(resolvedSearch, "source_checklist_item_id") || null,
    source_customer_message_id: param(resolvedSearch, "source_customer_message_id") || null,
    title: param(resolvedSearch, "title") || null,
    description: param(resolvedSearch, "description") || null
  };

  let jobsitesQuery = supabase
    .from("jobsites")
    .select("id, name, customer, address")
    .eq("company_id", context.companyId)
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (!context.canManage) jobsitesQuery = jobsitesQuery.contains("assigned_employee_ids", [context.userId]);

  const [jobsitesResult, employeesResult, reportResult, photoResult, checklistItemResult, messageResult] = await Promise.all([
    jobsitesQuery,
    context.canManage
      ? supabase
          .from("profiles")
          .select("id, full_name, email, role")
          .eq("company_id", context.companyId)
          .eq("active", true)
          .in("role", ["vorarbeiter", "mitarbeiter"])
          .order("full_name", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    defaults.source_report_id
      ? supabase
          .from("reports")
          .select("id, jobsite_id, report_date, activities, issues")
          .eq("company_id", context.companyId)
          .eq("id", defaults.source_report_id)
          .is("archived_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    defaults.source_report_photo_id
      ? supabase
          .from("report_photos")
          .select("id, report_id, jobsite_id, file_name")
          .eq("company_id", context.companyId)
          .eq("id", defaults.source_report_photo_id)
          .is("archived_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    defaults.source_checklist_item_id
      ? supabase
          .from("jobsite_checklist_items")
          .select("id, checklist_id, jobsite_id, label, problem_description")
          .eq("company_id", context.companyId)
          .eq("id", defaults.source_checklist_item_id)
          .is("archived_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    defaults.source_customer_message_id
      ? supabase
          .from("customer_portal_messages")
          .select("id, jobsite_id, sender_name, message")
          .eq("company_id", context.companyId)
          .eq("id", defaults.source_customer_message_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const reportSource = reportResult.data as ReportSource | null;
  const photoSource = photoResult.data as PhotoSource | null;
  const checklistItemSource = checklistItemResult.data as ChecklistItemSource | null;
  const messageSource = messageResult.data as MessageSource | null;

  if (photoSource) {
    defaults.source_type = "photo";
    defaults.jobsite_id = photoSource.jobsite_id;
    defaults.source_report_id = defaults.source_report_id ?? photoSource.report_id;
    defaults.title = defaults.title ?? `Mangel aus Foto ${photoSource.file_name}`;
  }
  if (reportSource) {
    defaults.source_type = defaults.source_type === "photo" ? "photo" : "report";
    defaults.jobsite_id = defaults.jobsite_id ?? reportSource.jobsite_id;
    defaults.title = defaults.title ?? `Mangel aus Tagesbericht vom ${formatDate(reportSource.report_date)}`;
    defaults.description = defaults.description ?? reportSource.issues ?? reportSource.activities;
  }
  if (checklistItemSource) {
    defaults.source_type = "checklist";
    defaults.jobsite_id = checklistItemSource.jobsite_id;
    defaults.source_checklist_id = defaults.source_checklist_id ?? checklistItemSource.checklist_id;
    defaults.title = defaults.title ?? checklistItemSource.label;
    defaults.description = defaults.description ?? checklistItemSource.problem_description;
  }
  if (messageSource) {
    defaults.source_type = "customer_message";
    defaults.jobsite_id = defaults.jobsite_id ?? messageSource.jobsite_id;
    defaults.title = defaults.title ?? `Kundenthema von ${messageSource.sender_name}`;
    defaults.description = defaults.description ?? messageSource.message;
  }

  const jobsites = (jobsitesResult.data ?? []) as Pick<Jobsite, "id" | "name" | "customer" | "address">[];
  const employees = (employeesResult.data ?? []) as Pick<Profile, "id" | "full_name" | "email" | "role">[];
  const pageError = [
    error,
    safeQueryErrorMessage(jobsitesResult.error),
    safeQueryErrorMessage(employeesResult.error),
    safeQueryErrorMessage(reportResult.error),
    safeQueryErrorMessage(photoResult.error),
    safeQueryErrorMessage(checklistItemResult.error),
    safeQueryErrorMessage(messageResult.error)
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <PageHeader
        title="Mangel erfassen"
        description="Direkt vom Handy mit Foto, Spracheingabe, Frist und Verantwortlichem. Kunden sehen den Mangel nur nach Freigabe."
      />
      <MessageBox error={pageError || null} success={success} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/maengel" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Zurück
        </Link>
      </div>

      {jobsites.length === 0 ? (
        <section className="surface-strong p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-700" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-black text-ink">Keine passende Baustelle gefunden</h2>
          <p className="mt-1 text-sm text-slate-600">Mängel brauchen eine Baustelle. Bitte zuerst eine Baustelle anlegen oder zuweisen.</p>
          {context.canManage ? (
            <Link href="/baustellen/neu" className="btn-primary mt-4">
              Baustelle anlegen
            </Link>
          ) : null}
        </section>
      ) : (
        <DefectForm jobsites={jobsites} employees={employees} canManage={context.canManage} defaults={defaults} />
      )}
    </>
  );
}
