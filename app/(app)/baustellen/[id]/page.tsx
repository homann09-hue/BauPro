import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Archive,
  Camera,
  ClipboardCheck,
  CheckSquare,
  ClipboardList,
  Clock3,
  Download,
  FileText,
  FolderOpen,
  Hammer,
  LockKeyhole,
  MessageSquareText,
  Navigation,
  PackageCheck,
  PenLine,
  Plus,
  ReceiptText,
  Upload,
  Warehouse
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { MaterialCalculationForm } from "@/components/forms/material-calculation-form";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import { SignaturePad } from "@/components/signature/signature-pad";
import { StatusBadge } from "@/components/status-badge";
import { SubmitButton } from "@/components/submit-button";
import {
  archiveJobsiteDocumentAction,
  createJobsiteActivityNoteAction,
  signJobsiteDocumentAction,
  uploadJobsiteDocumentAction
} from "@/lib/actions/jobsite-file-actions";
import { updateMaterialCalculationRuleAction, updatePricingSettingsAction } from "@/lib/actions/material-calculation-actions";
import { requireAppContext } from "@/lib/auth";
import {
  companyPricingSettingsSelect,
  commercialDocumentListSelect,
  defectListSelect,
  jobsiteChecklistItemSelect,
  jobsiteChecklistListSelect,
  jobMaterialRequirementPublicSelect,
  jobMaterialCalculationItemManagerSelect,
  jobMaterialCalculationItemPublicSelect,
  jobMaterialCalculationSelect,
  jobsiteActivityEventSelect,
  jobsiteDocumentSelect,
  jobsiteFormSelect,
  materialCalculationRuleSelect,
  reportFormSelect,
  reportPhotoSelect,
  timeEntryFormSelect
} from "@/lib/data/selects";
import { formatQuantity } from "@/lib/inventory";
import { checklistCategoryLabels, checklistProgress, jobsiteChecklistStatusLabels } from "@/lib/checklists";
import { defectPriorityLabels, defectStatusLabels, isDefectOverdue } from "@/lib/defects";
import { materialTypeLabels, roofFormLabels, roofTypeLabels } from "@/lib/material-calculations";
import { googleMapsJobsiteUrl } from "@/lib/maps/google-maps";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDate, formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";
import type {
  CommercialDocument,
  CompanyPricingSettings,
  Defect,
  JobMaterialRequirement,
  JobMaterialCalculation,
  JobMaterialCalculationItem,
  JobsiteChecklist,
  JobsiteChecklistItem,
  JobsiteActivityEvent,
  JobsiteDocument,
  JobsiteDocumentCategory,
  Jobsite,
  MaterialCalculationRule,
  PublicJobMaterialCalculationItem,
  PublicJobMaterialRequirement,
  Report,
  ReportPhoto,
  Task,
  TimeEntry
} from "@/types/app";

const documentCategoryLabels: Record<JobsiteDocumentCategory, string> = {
  angebot: "Angebot",
  rechnung: "Rechnung",
  lieferschein: "Lieferschein",
  aufmass: "Aufmaß",
  abnahmeprotokoll: "Abnahmeprotokoll",
  regiebericht: "Regiebericht",
  sicherheitsunterweisung: "Sicherheitsunterweisung",
  sonstiges: "Sonstiges"
};

const activityLabels: Record<string, string> = {
  note: "Notiz",
  document: "Dokument",
  photo: "Foto",
  task: "Aufgabe",
  time: "Zeit",
  material: "Material",
  report: "Bericht",
  order: "Auftrag",
  weather: "Wetter",
  signature: "Signatur"
};

const reportSelectWithJobsite = `${reportFormSelect}, jobsites(id, name, customer, address)`;

function timeLabel(value?: string | null) {
  if (!value) return "-";
  return value.slice(0, 5);
}

function hoursLabel(minutes: number) {
  const hours = minutes / 60;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(hours)} h`;
}

function fileSizeLabel(bytes?: number | null) {
  if (!bytes) return "Unbekannte Groesse";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}

function activityBadge(value: string) {
  return activityLabels[value] ?? value;
}

function preferredRules(rules: MaterialCalculationRule[], companyId: string) {
  const byKey = new Map<string, MaterialCalculationRule>();

  for (const rule of rules) {
    if (rule.company_id === null && !byKey.has(rule.rule_key)) byKey.set(rule.rule_key, rule);
  }
  for (const rule of rules) {
    if (rule.company_id === companyId) byKey.set(rule.rule_key, rule);
  }

  return [...byKey.values()].sort((a, b) => a.roof_type.localeCompare(b.roof_type) || a.sort_order - b.sort_order);
}

function calculationTotals(items: JobMaterialCalculationItem[]) {
  return items.reduce(
    (totals, item) => ({
      purchase: totals.purchase + Number(item.purchase_total ?? 0),
      sales: totals.sales + Number(item.sales_total ?? 0),
      margin: totals.margin + Number(item.margin_total ?? 0)
    }),
    { purchase: 0, sales: 0, margin: 0 }
  );
}

export default async function JobsiteDetailPage({
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
    .eq("id", id);

  if (!context.canManage) jobsiteQuery = jobsiteQuery.contains("assigned_employee_ids", [context.userId]);

  const { data: jobsiteData } = await jobsiteQuery.single();

  if (!jobsiteData) {
    notFound();
  }

  const jobsite = jobsiteData as Jobsite;
  const itemSource = context.canManage ? "job_material_calculation_items" : "job_material_calculation_items_public";
  const itemSelect = context.canManage ? jobMaterialCalculationItemManagerSelect : jobMaterialCalculationItemPublicSelect;
  const materialRequirementSource = context.canManage ? "job_material_requirements" : "job_material_requirements_public";
  const materialRequirementSelect = context.canManage
    ? "id, company_id, order_id, dimension_id, jobsite_id, rule_id, catalog_item_id, inventory_item_id, material_name, unit, base_quantity, waste_percent, waste_quantity, total_quantity, purchase_price, sales_price, purchase_total, sales_total, margin_total, location_name, stock, minimum_stock, created_at"
    : jobMaterialRequirementPublicSelect;

  const [
    calculationsResult,
    itemsResult,
    settingsResult,
    rulesResult,
    documentsResult,
    activityResult,
    tasksResult,
    defectsResult,
    reportsResult,
    photosResult,
    timeEntriesResult,
    materialRequirementsResult,
    commercialDocumentsResult,
    checklistsResult,
    checklistItemsResult
  ] = await Promise.all([
    supabase
      .from("job_material_calculations")
      .select(jobMaterialCalculationSelect)
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from(itemSource)
      .select(itemSelect)
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .order("created_at", { ascending: true }),
    context.canManage
      ? supabase
          .from("company_pricing_settings")
          .select(companyPricingSettingsSelect)
          .eq("company_id", context.companyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    context.canManage
      ? supabase
          .from("material_calculation_rules")
          .select(materialCalculationRuleSelect)
          .eq("active", true)
          .or(`company_id.is.null,company_id.eq.${context.companyId}`)
          .order("roof_type", { ascending: true })
          .order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null })
    ,
    supabase
      .from("jobsite_documents")
      .select(jobsiteDocumentSelect)
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("jobsite_activity_events")
      .select(jobsiteActivityEventSelect)
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(16),
    supabase
      .from("tasks")
      .select("id, company_id, jobsite_id, title, description, assigned_to, due_date, status")
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .is("archived_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(8),
    supabase
      .from("defects")
      .select(defectListSelect)
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .is("archived_at", null)
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("reports")
      .select(reportSelectWithJobsite)
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .is("archived_at", null)
      .order("report_date", { ascending: false })
      .limit(6),
    supabase
      .from("report_photos")
      .select(reportPhotoSelect)
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("time_entries")
      .select(timeEntryFormSelect)
      .eq("company_id", context.companyId)
      .eq("job_id", id)
      .is("archived_at", null)
      .order("date", { ascending: false })
      .limit(8),
    context.canManage
      ? supabase
          .from(materialRequirementSource)
          .select(materialRequirementSelect)
          .eq("company_id", context.companyId)
          .eq("jobsite_id", id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(10)
      : supabase
          .from(materialRequirementSource)
          .select(materialRequirementSelect)
          .eq("company_id", context.companyId)
          .eq("jobsite_id", id)
          .order("created_at", { ascending: false })
          .limit(10),
    context.canManage
      ? supabase
          .from("commercial_documents")
          .select(commercialDocumentListSelect)
          .eq("company_id", context.companyId)
          .eq("jobsite_id", id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("jobsite_checklists")
      .select(jobsiteChecklistListSelect)
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("jobsite_checklist_items")
      .select(jobsiteChecklistItemSelect)
      .eq("company_id", context.companyId)
      .eq("jobsite_id", id)
      .is("archived_at", null)
      .limit(240)
  ]);

  const calculations = (calculationsResult.data ?? []) as JobMaterialCalculation[];
  const items = (itemsResult.data ?? []) as unknown as Array<JobMaterialCalculationItem | PublicJobMaterialCalculationItem>;
  const documents = (documentsResult.data ?? []) as unknown as JobsiteDocument[];
  const activityEvents = (activityResult.data ?? []) as unknown as JobsiteActivityEvent[];
  const tasks = (tasksResult.data ?? []) as unknown as Task[];
  const defects = (defectsResult.data ?? []) as unknown as Defect[];
  const reports = (reportsResult.data ?? []) as unknown as Report[];
  const timeEntries = (timeEntriesResult.data ?? []) as unknown as TimeEntry[];
  const materialRequirements = (materialRequirementsResult.data ?? []) as unknown as Array<JobMaterialRequirement | PublicJobMaterialRequirement>;
  const commercialDocuments = (commercialDocumentsResult.data ?? []) as unknown as CommercialDocument[];
  const checklists = (checklistsResult.data ?? []) as unknown as JobsiteChecklist[];
  const checklistItems = (checklistItemsResult.data ?? []) as unknown as JobsiteChecklistItem[];
  const settings = (settingsResult.data ?? {
    company_id: context.companyId,
    waste_percent: 20,
    default_markup_percent: 35,
    auto_calculate_sales_price: true
  }) as CompanyPricingSettings;
  const rules = preferredRules((rulesResult.data ?? []) as MaterialCalculationRule[], context.companyId);
  const itemsByCalculation = new Map<string, Array<JobMaterialCalculationItem | PublicJobMaterialCalculationItem>>();
  const checklistItemsByChecklist = new Map<string, JobsiteChecklistItem[]>();

  for (const item of items) {
    const list = itemsByCalculation.get(item.calculation_id) ?? [];
    list.push(item);
    itemsByCalculation.set(item.calculation_id, list);
  }

  for (const item of checklistItems) {
    const list = checklistItemsByChecklist.get(item.checklist_id) ?? [];
    list.push(item);
    checklistItemsByChecklist.set(item.checklist_id, list);
  }

  const photos = await Promise.all(
    ((photosResult.data ?? []) as ReportPhoto[]).map(async (photo) => {
      const { data } = await supabase.storage.from("report-photos").createSignedUrl(photo.storage_path, 60 * 15);
      return { ...photo, signedUrl: data?.signedUrl };
    })
  );
  const pageLoadError = [
    error,
    safeQueryErrorMessage(documentsResult.error),
    safeQueryErrorMessage(activityResult.error),
    safeQueryErrorMessage(tasksResult.error),
    safeQueryErrorMessage(defectsResult.error),
    safeQueryErrorMessage(reportsResult.error),
    safeQueryErrorMessage(photosResult.error),
    safeQueryErrorMessage(timeEntriesResult.error),
    safeQueryErrorMessage(materialRequirementsResult.error),
    safeQueryErrorMessage(commercialDocumentsResult.error),
    safeQueryErrorMessage(checklistsResult.error),
    safeQueryErrorMessage(checklistItemsResult.error)
  ]
    .filter(Boolean)
    .join(" ");
  const openTasks = tasks.filter((task) => task.status !== "erledigt");
  const openDefects = defects.filter((defect) => !["erledigt", "abgenommen"].includes(defect.status));
  const totalTimeMinutes = timeEntries.reduce((sum, entry) => sum + Number(entry.net_minutes ?? 0), 0);
  const canUploadDocuments = context.canManage || context.profile.role === "vorarbeiter";
  const canStartChecklist = context.canManage || context.profile.role === "vorarbeiter";
  const mapsHref = googleMapsJobsiteUrl(jobsite);

  return (
    <>
      <PageHeader
        title={jobsite.name}
        description={`${jobsite.customer} · ${jobsite.address}`}
        actionHref={context.canManage ? `/baustellen/${jobsite.id}/bearbeiten` : undefined}
        actionLabel={context.canManage ? "Baustelle bearbeiten" : undefined}
        actionIcon={Hammer}
      />
      <MessageBox error={pageLoadError || null} success={success} />

      <section className="surface mb-5 grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <p className="meta-label">Status</p>
          <div className="mt-1">
            <StatusBadge value={jobsite.status} />
          </div>
        </div>
        <div>
          <p className="meta-label">Start</p>
          <p className="mt-1 font-black text-ink">{formatDate(jobsite.start_date)}</p>
        </div>
        <div>
          <p className="meta-label">Team</p>
          <p className="mt-1 font-black text-ink">{jobsite.assigned_employee_ids.length} Mitarbeiter</p>
        </div>
        {mapsHref ? (
          <div className="sm:col-span-3">
            <a href={mapsHref} target="_blank" rel="noreferrer" className="btn-secondary w-full sm:w-auto">
              <Navigation className="h-4 w-4" aria-hidden="true" />
              In Google Maps öffnen
            </a>
          </div>
        ) : null}
        {jobsite.notes ? <p className="text-sm text-slate-600 sm:col-span-3">{jobsite.notes}</p> : null}
      </section>

      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {[
          { label: "Dokumente", value: documents.length, icon: FolderOpen, tone: "bg-mint text-moss" },
          { label: "Fotos", value: photos.length, icon: Camera, tone: "bg-blue-50 text-info" },
          { label: "Offene Aufgaben", value: openTasks.length, icon: CheckSquare, tone: "bg-amber-50 text-amber-700" },
          { label: "Mängel", value: openDefects.length, icon: AlertTriangle, tone: "bg-red-50 text-red-700" },
          { label: "Checklisten", value: checklists.length, icon: ClipboardCheck, tone: "bg-mint text-moss" },
          { label: "Erfasste Stunden", value: hoursLabel(totalTimeMinutes), icon: Clock3, tone: "bg-slate-100 text-slate-700" }
        ].map((stat) => (
          <article key={stat.label} className="surface-strong p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="meta-label">{stat.label}</p>
                <p className="mt-2 text-2xl font-black text-ink">{stat.value}</p>
              </div>
              <div className={`flex h-11 w-11 items-center justify-center rounded-md ${stat.tone}`}>
                <stat.icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="surface-strong mb-6 overflow-hidden">
        <div className="border-b border-line bg-anthracite p-4 text-white sm:p-5">
          <p className="text-xs font-black uppercase tracking-wide text-mint">Baustellenakte</p>
          <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-2xl font-black">Alles Wichtige an einem Ort</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-200">
                Dokumente, Fotos, Aufgaben, Zeiten und Materialbedarf laufen hier zusammen. Mitarbeiter sehen nur operative Infos,
                Chef sieht zusätzlich Preise und kaufmännische Dokumente.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <Link href={`/berichte/neu?jobsite_id=${jobsite.id}`} className="btn-secondary bg-white text-ink hover:bg-slate-100">
                <ClipboardList className="h-4 w-4" aria-hidden="true" />
                Bericht
              </Link>
              <Link href={`/time-tracking/new?job_id=${jobsite.id}`} className="btn-secondary bg-white text-ink hover:bg-slate-100">
                <Clock3 className="h-4 w-4" aria-hidden="true" />
                Zeit
              </Link>
              <Link href={`/bring-lists/new?job_id=${jobsite.id}`} className="btn-secondary bg-white text-ink hover:bg-slate-100">
                <Warehouse className="h-4 w-4" aria-hidden="true" />
                Mitbringliste
              </Link>
              <Link href={`/maengel/neu?jobsite_id=${jobsite.id}`} className="btn-secondary bg-white text-ink hover:bg-slate-100">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                Mangel
              </Link>
              {canStartChecklist ? (
                <Link href={`/baustellen/${jobsite.id}/checklists/new`} className="btn-secondary bg-white text-ink hover:bg-slate-100">
                  <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                  Checkliste
                </Link>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] sm:p-5">
          <div className="space-y-4">
            <div className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-ink">Dokumente</h3>
                  <p className="mt-1 text-sm text-slate-600">Aufmaß, Lieferschein, Abnahme, Sicherheitsunterweisung oder Kundendokument.</p>
                </div>
                {canUploadDocuments ? <Upload className="h-5 w-5 text-moss" aria-hidden="true" /> : <LockKeyhole className="h-5 w-5 text-slate-400" aria-hidden="true" />}
              </div>

              {canUploadDocuments ? (
                <form action={uploadJobsiteDocumentAction} className="mt-4 grid gap-3 rounded-md bg-fog p-3">
                  <input type="hidden" name="jobsite_id" value={jobsite.id} />
                  <label>
                    <span className="field-label">Dokumentart</span>
                    <select className="field-input" name="category" defaultValue="aufmass">
                      {Object.entries(documentCategoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className="field-label">Titel optional</span>
                    <input className="field-input" name="title" placeholder="Wird sonst automatisch benannt" />
                  </label>
                  <label>
                    <span className="field-label">PDF oder Bild</span>
                    <input className="field-input" name="document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required />
                  </label>
                  {context.canManage ? (
                    <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
                      <input type="checkbox" name="visible_to_customer" className="h-4 w-4 rounded border-line text-moss" />
                      Im Kundenportal sichtbar
                    </label>
                  ) : null}
                  <SubmitButton>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    Dokument speichern
                  </SubmitButton>
                </form>
              ) : (
                <p className="mt-4 rounded-md bg-fog p-3 text-sm font-semibold text-slate-600">
                  Dokumentenupload ist für Chef und Vorarbeiter freigeschaltet.
                </p>
              )}

              <div className="mt-4 space-y-2">
                {documents.length === 0 ? (
                  <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">Noch keine Dokumente in dieser Akte.</p>
                ) : (
                  documents.map((document) => (
                    <article key={document.id} className="rounded-md border border-line bg-white p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-mint px-2 py-1 text-xs font-black text-moss">
                              {documentCategoryLabels[document.category]}
                            </span>
                            {document.visible_to_customer ? (
                              <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-info">Kunde</span>
                            ) : null}
                            {document.signed_at ? (
                              <span className="rounded-md bg-primary/10 px-2 py-1 text-xs font-black text-primary-dark">Bestaetigt</span>
                            ) : null}
                          </div>
                          <p className="mt-2 font-black text-ink">{document.title}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {fileSizeLabel(document.size_bytes)} · {formatDateTime(document.created_at)}
                          </p>
                          {document.signature_name && document.signed_at ? (
                            <p className="mt-1 text-xs font-semibold text-emerald-700">
                              Bestaetigt von {document.signature_name} am {formatDateTime(document.signed_at)}
                            </p>
                          ) : null}
                          {document.signature_data_url ? (
                            // Signaturen werden als validierte Data-URL gespeichert und nicht extern nachgeladen.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={document.signature_data_url}
                              alt="Gespeicherte Dokumenten-Unterschrift"
                              className="mt-3 h-20 max-w-xs rounded-md border border-line bg-white object-contain p-2"
                              loading="lazy"
                              decoding="async"
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/baustellen/${jobsite.id}/documents/${document.id}`} className="btn-secondary">
                            <FileText className="h-4 w-4" aria-hidden="true" />
                            Öffnen
                          </Link>
                          <Link href={`/baustellen/${jobsite.id}/documents/${document.id}?download=1`} className="btn-secondary">
                            <Download className="h-4 w-4" aria-hidden="true" />
                            Download
                          </Link>
                          {context.canManage ? (
                            <form action={archiveJobsiteDocumentAction}>
                              <input type="hidden" name="jobsite_id" value={jobsite.id} />
                              <input type="hidden" name="document_id" value={document.id} />
                              <SubmitButton variant="secondary" className="h-10 px-3">
                                <Archive className="h-4 w-4" aria-hidden="true" />
                                Archivieren
                              </SubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </div>
                      {context.canManage && !document.signed_at ? (
                        <details className="mt-3 rounded-lg border border-line bg-fog p-3">
                          <summary className="cursor-pointer text-sm font-black text-ink">Dokument digital unterschreiben</summary>
                          <form action={signJobsiteDocumentAction} className="mt-3 grid gap-3">
                            <input type="hidden" name="jobsite_id" value={jobsite.id} />
                            <input type="hidden" name="document_id" value={document.id} />
                            <label>
                              <span className="field-label">Name des Unterzeichners</span>
                              <input
                                className="field-input"
                                name="signature_name"
                                placeholder="Vor- und Nachname"
                                defaultValue={context.profile.full_name ?? ""}
                                required
                              />
                            </label>
                            <SignaturePad label="Dokument unterschreiben" required />
                            <SubmitButton variant="secondary">
                              <PenLine className="h-4 w-4" aria-hidden="true" />
                              Signatur speichern
                            </SubmitButton>
                          </form>
                        </details>
                      ) : null}
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-ink">Fotos und Berichte</h3>
                  <p className="mt-1 text-sm text-slate-600">Aktuelle Nachweise aus Tagesberichten.</p>
                </div>
                <Camera className="h-5 w-5 text-moss" aria-hidden="true" />
              </div>
              {photos.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">Noch keine Fotos zu dieser Baustelle.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {photos.map((photo) => (
                    <Link key={photo.id} href={`/berichte/${photo.report_id}`} className="overflow-hidden rounded-md border border-line bg-fog">
                      {photo.signedUrl ? (
                        // Signierte Supabase-URLs haben keine stabile Remote-Domain-Konfiguration für next/image.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo.signedUrl} alt={photo.file_name} className="h-32 w-full object-cover" loading="lazy" decoding="async" />
                      ) : null}
                      <div className="p-2 text-xs font-semibold text-slate-600">{formatDateTime(photo.created_at)}</div>
                    </Link>
                  ))}
                </div>
              )}
              <div className="mt-4 grid gap-2">
                {reports.map((report) => (
                  <Link key={report.id} href={`/berichte/${report.id}`} className="rounded-md border border-line bg-fog p-3 hover:border-moss">
                    <p className="font-black text-ink">Tagesbericht vom {formatDate(report.report_date)}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{report.activities}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            <div className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-ink">Verlauf</h3>
                  <p className="mt-1 text-sm text-slate-600">Kurze interne Notizen und wichtige Ereignisse.</p>
                </div>
                <Activity className="h-5 w-5 text-moss" aria-hidden="true" />
              </div>
              <form action={createJobsiteActivityNoteAction} className="mt-4 grid gap-2 rounded-md bg-fog p-3">
                <input type="hidden" name="jobsite_id" value={jobsite.id} />
                <input className="field-input" name="title" placeholder="Kurzer Titel" required />
                <textarea className="field-input min-h-24" name="body" placeholder="Was ist wichtig?" />
                {context.canManage ? (
                  <label className="flex items-center gap-3 rounded-md border border-line bg-white px-3 py-2 text-sm font-semibold text-ink">
                    <input type="checkbox" name="visible_to_customer" className="h-4 w-4 rounded border-line text-moss" />
                    Als Kunden-Update markieren
                  </label>
                ) : null}
                <SubmitButton variant="secondary">
                  <MessageSquareText className="h-4 w-4" aria-hidden="true" />
                  Notiz speichern
                </SubmitButton>
              </form>
              <div className="mt-4 space-y-3">
                {activityEvents.length === 0 ? (
                  <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">Noch kein Verlauf gespeichert.</p>
                ) : (
                  activityEvents.map((event) => (
                    <article key={event.id} className="border-l-4 border-moss bg-fog p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="rounded-md bg-white px-2 py-1 text-xs font-black text-slate-600">{activityBadge(event.event_type)}</span>
                        <span className="text-xs font-semibold text-slate-500">{formatDateTime(event.created_at)}</span>
                      </div>
                      <p className="mt-2 font-black text-ink">{event.title}</p>
                      {event.body ? <p className="mt-1 text-sm text-slate-600">{event.body}</p> : null}
                    </article>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-ink">Checklisten</h3>
                  <p className="mt-1 text-sm text-slate-600">Sicherheit, Baustart, Tagesabschluss, Abnahme und Material.</p>
                </div>
                <ClipboardCheck className="h-5 w-5 text-moss" aria-hidden="true" />
              </div>
              {checklists.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">Noch keine Checkliste für diese Baustelle.</p>
              ) : (
                <div className="space-y-2">
                  {checklists.map((checklist) => {
                    const progress = checklistProgress(checklistItemsByChecklist.get(checklist.id) ?? []);
                    return (
                      <Link key={checklist.id} href={`/checklists/${checklist.id}`} className="block rounded-md border border-line bg-fog p-3 hover:border-moss">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-black text-ink">{checklist.title}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {checklistCategoryLabels[checklist.category]} · {progress.done}/{progress.total} erledigt
                            </p>
                          </div>
                          <StatusBadge value={checklist.status} label={jobsiteChecklistStatusLabels[checklist.status]} />
                        </div>
                        <div className="mt-3 h-2 rounded-full bg-white">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${progress.percent}%` }} />
                        </div>
                        {progress.problems > 0 ? (
                          <p className="mt-2 text-xs font-black text-red-700">{progress.problems} Problem(e) als Aufgabe erfasst</p>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}
              {canStartChecklist ? (
                <Link href={`/baustellen/${jobsite.id}/checklists/new`} className="btn-secondary mt-3 w-full">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Checkliste starten
                </Link>
              ) : null}
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-black text-ink">Aufgaben</h3>
                <CheckSquare className="h-5 w-5 text-moss" aria-hidden="true" />
              </div>
              {tasks.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">Keine offenen Aufgaben.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <article key={task.id} className="rounded-md border border-line bg-fog p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black text-ink">{task.title}</p>
                        <StatusBadge value={task.status} />
                      </div>
                      {task.description ? <p className="mt-1 text-sm text-slate-600">{task.description}</p> : null}
                      {task.due_date ? <p className="mt-2 text-xs font-semibold text-slate-500">Faellig {formatDate(task.due_date)}</p> : null}
                    </article>
                  ))}
                </div>
              )}
              {context.canManage ? (
                <Link href="/dashboard" className="btn-secondary mt-3 w-full">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Aufgabe im Dashboard anlegen
                </Link>
              ) : null}
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-ink">Mängel</h3>
                  <p className="mt-1 text-sm text-slate-600">Schäden, offene Punkte und Fristen.</p>
                </div>
                <AlertTriangle className="h-5 w-5 text-amber-700" aria-hidden="true" />
              </div>
              {defects.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">Keine Mängel zu dieser Baustelle erfasst.</p>
              ) : (
                <div className="space-y-2">
                  {defects.map((defect) => (
                    <Link key={defect.id} href={`/maengel/${defect.id}`} className="block rounded-md border border-line bg-fog p-3 hover:border-moss">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-black text-ink">{defect.title}</p>
                        <StatusBadge value={defect.status} label={defectStatusLabels[defect.status]} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge value={defect.priority} label={defectPriorityLabels[defect.priority]} />
                        {isDefectOverdue(defect) ? (
                          <span className="rounded-md bg-red-50 px-2 py-1 text-xs font-black text-red-700">Überfällig</span>
                        ) : null}
                        {defect.visible_to_customer ? (
                          <span className="rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-info">Kunde</span>
                        ) : null}
                      </div>
                      {defect.due_date ? <p className="mt-2 text-xs font-semibold text-slate-500">Frist {formatDate(defect.due_date)}</p> : null}
                    </Link>
                  ))}
                </div>
              )}
              <Link href={`/maengel/neu?jobsite_id=${jobsite.id}`} className="btn-secondary mt-3 w-full">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Mangel erfassen
              </Link>
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-black text-ink">Zeiten</h3>
                <Clock3 className="h-5 w-5 text-moss" aria-hidden="true" />
              </div>
              {timeEntries.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">Noch keine Zeiten erfasst.</p>
              ) : (
                <div className="space-y-2">
                  {timeEntries.map((entry) => (
                    <article key={entry.id} className="rounded-md border border-line bg-fog p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-black text-ink">{formatDate(entry.date)}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">
                            {timeLabel(entry.start_time)}-{timeLabel(entry.end_time)} · Pause {entry.break_minutes} Min.
                          </p>
                        </div>
                        <StatusBadge value={entry.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {hoursLabel(Number(entry.net_minutes ?? 0))} netto · {entry.activity}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-line bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="font-black text-ink">Materialbedarf</h3>
                <PackageCheck className="h-5 w-5 text-moss" aria-hidden="true" />
              </div>
              {materialRequirements.length === 0 ? (
                <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">Noch kein Auftragsmaterial gespeichert.</p>
              ) : (
                <div className="space-y-2">
                  {materialRequirements.map((requirement) => (
                    <article key={requirement.id} className="rounded-md border border-line bg-fog p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-ink">{requirement.material_name}</p>
                          <p className="mt-1 text-xs font-semibold text-slate-500">{requirement.location_name || "Noch kein Lagerort"}</p>
                        </div>
                        <p className="text-right font-black text-ink">
                          {formatQuantity(requirement.total_quantity)} {requirement.unit}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            {context.canManage ? (
              <div className="rounded-lg border border-line bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h3 className="font-black text-ink">Angebote/Rechnungen</h3>
                  <ReceiptText className="h-5 w-5 text-moss" aria-hidden="true" />
                </div>
                {commercialDocuments.length === 0 ? (
                  <p className="rounded-md border border-dashed border-line p-4 text-sm text-slate-500">Noch kein kaufmännisches Dokument zur Baustelle.</p>
                ) : (
                  <div className="space-y-2">
                    {commercialDocuments.map((document) => (
                      <Link key={document.id} href={`/angebote-rechnungen/${document.id}`} className="block rounded-md border border-line bg-fog p-3 hover:border-moss">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-black text-ink">{document.document_number}</p>
                          <StatusBadge value={document.status} />
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{document.subject}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">{formatMoney(document.total_gross)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {context.canManage ? (
        <div className="space-y-5">
          <MaterialCalculationForm jobsiteId={jobsite.id} defaultWastePercent={Number(settings.waste_percent ?? 20)} />

          <details className="surface p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-black text-ink">Kalkulationswerte und Materialregeln</summary>
            <form action={updatePricingSettingsAction} className="mt-4 grid gap-3 sm:grid-cols-4">
              <input type="hidden" name="return_to" value={`/baustellen/${jobsite.id}`} />
              <label>
                <span className="field-label">Verschnitt %</span>
                <input className="field-input" name="waste_percent" inputMode="decimal" defaultValue={settings.waste_percent} />
              </label>
              <label>
                <span className="field-label">Standard-Aufschlag %</span>
                <input
                  className="field-input"
                  name="default_markup_percent"
                  inputMode="decimal"
                  defaultValue={settings.default_markup_percent}
                />
              </label>
              <label className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink sm:col-span-2">
                <input
                  type="checkbox"
                  name="auto_calculate_sales_price"
                  defaultChecked={settings.auto_calculate_sales_price}
                  className="h-4 w-4 rounded border-line text-moss"
                />
                VK automatisch aus EK + Aufschlag berechnen
              </label>
              <button className="btn-primary sm:col-span-4" type="submit">
                Einstellungen speichern
              </button>
            </form>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {rules.map((rule) => (
                <form key={rule.id} action={updateMaterialCalculationRuleAction} className="rounded-lg border border-line bg-white p-3">
                  <input type="hidden" name="return_to" value={`/baustellen/${jobsite.id}`} />
                  <input type="hidden" name="rule_id" value={rule.id} />
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-ink">{rule.name}</p>
                      <p className="text-xs font-semibold text-slate-500">{roofTypeLabels[rule.roof_type]}</p>
                    </div>
                    <span className="rounded-md bg-mint px-2 py-1 text-xs font-black text-moss">
                      {rule.company_id ? "Firma" : "Standard"}
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <label>
                      <span className="field-label">Regelname</span>
                      <input className="field-input" name="name" defaultValue={rule.name} />
                    </label>
                    <label>
                      <span className="field-label">Material</span>
                      <input className="field-input" name="material_name" defaultValue={rule.material_name} />
                    </label>
                    <label>
                      <span className="field-label">Einheit</span>
                      <input className="field-input" name="unit" defaultValue={rule.unit} />
                    </label>
                    <label>
                      <span className="field-label">Faktor</span>
                      <input className="field-input" name="factor" inputMode="decimal" defaultValue={rule.factor} />
                    </label>
                    <label>
                      <span className="field-label">Abstand m</span>
                      <input className="field-input" name="spacing_m" inputMode="decimal" defaultValue={rule.spacing_m ?? ""} />
                    </label>
                    <label className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink">
                      <input
                        type="checkbox"
                        name="waste_applies"
                        defaultChecked={rule.waste_applies}
                        className="h-4 w-4 rounded border-line text-moss"
                      />
                      Verschnitt anwenden
                    </label>
                  </div>
                  <button className="btn-secondary mt-3 w-full" type="submit">
                    Regel speichern
                  </button>
                </form>
              ))}
            </div>
          </details>
        </div>
      ) : (
        <div className="surface mb-5 flex items-start gap-3 p-4">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-moss" aria-hidden="true" />
          <div>
            <p className="font-black text-ink">Preisbereich ausgeblendet</p>
            <p className="mt-1 text-sm text-slate-600">
              Du siehst Materialbedarf, Lagerort und Bestand. EK, VK, Aufschlag und Marge bleiben Chef-Sache.
            </p>
          </div>
        </div>
      )}

      <section className="mt-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="section-title">Berechnete Materiallisten</h2>
            <p className="mt-1 text-sm text-slate-500">Grundmenge, Zuschlag und Gesamtmenge je Berechnung.</p>
          </div>
          <Link href="/berichte/neu" className="btn-secondary">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Tagesbericht
          </Link>
        </div>

        {calculations.length === 0 ? (
          <EmptyState
            icon={PackageCheck}
            title="Noch keine Materialberechnung"
            description={
              context.canManage
                ? "Gib oben die Maße ein und erstelle die erste schnelle Materialliste."
                : "Noch keine Materialliste für diese Baustelle vorhanden."
            }
          />
        ) : (
          <div className="space-y-4">
            {calculations.map((calculation) => {
              const calculationItems = itemsByCalculation.get(calculation.id) ?? [];
              const pricedItems = calculationItems as JobMaterialCalculationItem[];
              const totals = context.canManage ? calculationTotals(pricedItems) : null;

              return (
                <article key={calculation.id} className="surface-strong overflow-hidden">
                  <div className="border-b border-line bg-fog p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-black text-ink">{roofTypeLabels[calculation.roof_type]}</p>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatDateTime(calculation.created_at)} · {formatQuantity(calculation.area_m2)} m² ·{" "}
                          {formatQuantity(calculation.waste_percent)} % Verschnitt
                        </p>
                        <p className="mt-1 text-xs font-semibold text-slate-500">
                          {roofFormLabels[calculation.roof_form ?? ""] ?? "Dachform offen"} ·{" "}
                          {materialTypeLabels[calculation.material_type ?? ""] ?? "Materialtyp offen"}
                          {calculation.ai_enabled ? " · KI-Vorschlag aktiv" : ""}
                        </p>
                      </div>
                      {context.canManage && totals ? (
                        <div className="grid grid-cols-3 gap-2 text-right text-sm">
                          <div>
                            <p className="meta-label">EK</p>
                            <p className="font-black text-ink">{formatMoney(totals.purchase)}</p>
                          </div>
                          <div>
                            <p className="meta-label">VK</p>
                            <p className="font-black text-ink">{formatMoney(totals.sales)}</p>
                          </div>
                          <div>
                            <p className="meta-label">Marge</p>
                            <p className="font-black text-emerald-700">{formatMoney(totals.margin)}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="border-b border-line bg-white px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">
                      {calculation.review_notice || "Materialberechnung ist ein Vorschlag und muss fachlich geprüft werden."}
                    </p>
                    {calculation.ai_notes ? (
                      <p className="mt-1 whitespace-pre-line text-xs font-semibold text-slate-600">{calculation.ai_notes}</p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 p-4">
                    {calculationItems.map((item) => (
                      <div key={item.id} className="rounded-lg border border-line bg-white p-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-black text-ink">{item.material_name}</p>
                              <span className={item.source === "ai" ? "rounded-md bg-blue-50 px-2 py-1 text-xs font-black text-info" : "rounded-md bg-mint px-2 py-1 text-xs font-black text-moss"}>
                                {item.source === "ai" ? "KI-Vorschlag" : "Regel"}
                              </span>
                              {item.missing_quantity > 0 ? (
                                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">
                                  {formatQuantity(item.missing_quantity)} {item.unit} fehlt
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {item.location_name || "Kein Lagerbestand"} · Bestand {formatQuantity(item.stock ?? 0)} / Minimum{" "}
                              {formatQuantity(item.minimum_stock ?? 0)}
                            </p>
                            {item.ai_reason ? <p className="mt-1 text-xs font-semibold text-blue-700">{item.ai_reason}</p> : null}
                          </div>
                          <div className={context.canManage ? "grid grid-cols-4 gap-2 text-sm lg:min-w-[620px]" : "grid grid-cols-2 gap-2 text-sm lg:min-w-[320px]"}>
                            {context.canManage ? (
                              <>
                                <div className="rounded-md bg-fog p-2">
                                  <p className="meta-label">Grund</p>
                                  <p className="font-black text-ink">
                                    {formatQuantity(item.base_quantity)} {item.unit}
                                  </p>
                                </div>
                                <div className="rounded-md bg-fog p-2">
                                  <p className="meta-label">+{formatQuantity(item.waste_percent)} %</p>
                                  <p className="font-black text-ink">
                                    {formatQuantity(item.waste_quantity)} {item.unit}
                                  </p>
                                </div>
                              </>
                            ) : null}
                            <div className="rounded-md bg-mint p-2">
                              <p className="meta-label text-moss">Gesamt</p>
                              <p className="font-black text-ink">
                                {formatQuantity(item.total_quantity)} {item.unit}
                              </p>
                            </div>
                            {context.canManage && "purchase_total" in item ? (
                              <div className="rounded-md bg-fog p-2">
                                <p className="meta-label">Kosten</p>
                                <p className="font-black text-ink">
                                  {formatMoney(item.purchase_total)} / {formatMoney(item.sales_total)}
                                </p>
                              </div>
                            ) : (
                              <div className="rounded-md bg-fog p-2">
                                <p className="meta-label">Lager</p>
                                <p className="truncate font-black text-ink">{item.location_name || "-"}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-line bg-fog p-4 sm:flex-row sm:justify-end">
                    <Link href={`/bring-lists/new?job_id=${jobsite.id}`} className="btn-secondary">
                      <PackageCheck className="h-4 w-4" aria-hidden="true" />
                      Mitbringliste erstellen
                    </Link>
                    <Link href="/materials/inventory" className="btn-secondary">
                      <Warehouse className="h-4 w-4" aria-hidden="true" />
                      Lager prüfen
                    </Link>
                    {context.canManage ? (
                      <Link href="/invoices" className="btn-secondary">
                        <ReceiptText className="h-4 w-4" aria-hidden="true" />
                        Angebot/Rechnung
                      </Link>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
