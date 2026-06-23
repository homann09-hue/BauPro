import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FilePlus2,
  PackageCheck,
  PackageSearch,
  Save,
  ShieldCheck,
  Sparkles,
  Warehouse,
  XCircle
} from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { PageHeader } from "@/components/page-header";
import {
  createOrderFromAiDraftAction,
  prepareAiJobDraftAction,
  rejectAiJobDraftAction,
  saveAiJobDraftAction,
  updateAiJobDraftPreviewAction
} from "@/lib/actions/ai-job-actions";
import { formatMissingMaterial } from "@/lib/ai/job-drafts";
import { requireManager } from "@/lib/auth";
import { aiJobDraftSelect } from "@/lib/data/selects";
import { formatQuantity } from "@/lib/inventory";
import { materialTypeLabels, roofFormLabels } from "@/lib/material-calculations";
import { orderPriorityLabels, orderTypeLabels } from "@/lib/order-labels";
import { safeQueryErrorMessage } from "@/lib/security/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isMissingSchemaError, migrationMissingMessage } from "@/lib/supabase/errors";
import { cn, formatDate, formatDateTime, formatMoney, searchParamMessage } from "@/lib/utils";
import type { AiJobDraftParsed, AiJobDraftPreview, AiJobDraftRow } from "@/lib/ai/types";
import type { OrderPriority, OrderType } from "@/types/app";

type SearchParams = Record<string, string | string[] | undefined>;
type RecentDraft = Pick<AiJobDraftRow, "id" | "raw_input" | "status" | "confidence" | "created_at" | "converted_order_id"> & {
  missing_fields: unknown;
  parsed_json: Partial<AiJobDraftParsed> | null;
};

const statusLabels: Record<AiJobDraftRow["status"], string> = {
  proposed: "Vorschlag",
  incomplete: "Unvollständig",
  confirmed: "Bestätigt",
  rejected: "Verworfen",
  converted_to_job: "Erstellt"
};

const orderTypes = Object.keys(orderTypeLabels) as OrderType[];
const priorities = Object.keys(orderPriorityLabels) as OrderPriority[];
const roofForms = Object.keys(roofFormLabels);
const materialTypes = Object.keys(materialTypeLabels);

function paramValue(params: SearchParams, key: string) {
  const value = params[key];
  return typeof value === "string" ? value : null;
}

function jsonStringArray(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function statusClass(status: AiJobDraftRow["status"]) {
  if (status === "converted_to_job") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "rejected") return "border-red-200 bg-red-50 text-red-700";
  if (status === "incomplete") return "border-amber-200 bg-amber-50 text-amber-800";
  return "border-moss/20 bg-mint text-moss";
}

function StatusBadge({ status }: { status: AiJobDraftRow["status"] }) {
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-black", statusClass(status))}>
      {statusLabels[status]}
    </span>
  );
}

function StepCard({
  step,
  title,
  icon: Icon,
  children
}: {
  step: string;
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-ink text-white">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="meta-label">{step}</p>
          <h2 className="section-title">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "good" | "warn" }) {
  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2",
        tone === "good" && "border-emerald-200 bg-emerald-50",
        tone === "warn" && "border-amber-200 bg-amber-50",
        tone === "default" && "border-line bg-fog"
      )}
    >
      <p className="meta-label">{label}</p>
      <p className="mt-1 text-lg font-black text-ink">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-md border border-line bg-fog px-3 py-2">
      <p className="meta-label">{label}</p>
      <p className="mt-1 font-bold text-ink">{value || "Keine Angabe"}</p>
    </div>
  );
}

function NumberInput({
  name,
  label,
  value,
  suffix
}: {
  name: string;
  label: string;
  value?: number | null;
  suffix?: string;
}) {
  return (
    <label>
      <span className="field-label">{label}</span>
      <div className="flex rounded-md border border-line bg-white/95 shadow-sm focus-within:border-moss focus-within:ring-4 focus-within:ring-moss/15">
        <input
          className="min-w-0 flex-1 rounded-l-md border-0 bg-transparent px-3 py-3 text-sm text-ink outline-none"
          name={name}
          inputMode="decimal"
          defaultValue={value ?? ""}
        />
        {suffix ? <span className="flex items-center px-3 text-sm font-semibold text-slate-500">{suffix}</span> : null}
      </div>
    </label>
  );
}

function ActionForm({
  draftId,
  action,
  label,
  icon: Icon,
  disabled
}: {
  draftId: string;
  action: "order" | "order_bringlist" | "order_bringlist_reserve";
  label: string;
  icon: LucideIcon;
  disabled: boolean;
}) {
  return (
    <form action={createOrderFromAiDraftAction}>
      <input type="hidden" name="draft_id" value={draftId} />
      <input type="hidden" name="next_action" value={action} />
      <button className="btn-primary w-full" type="submit" disabled={disabled}>
        <Icon className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

function DraftCorrectionForm({ draft, preview }: { draft: AiJobDraftRow; preview: AiJobDraftPreview }) {
  const parsed = preview.parsed;
  const dimensions = parsed.dimensions;

  return (
    <form action={updateAiJobDraftPreviewAction} className="grid gap-3">
      <input type="hidden" name="draft_id" value={draft.id} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label>
          <span className="field-label">Kunde</span>
          <input className="field-input" name="customer_name" defaultValue={parsed.customer_name ?? ""} />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Auftragstitel</span>
          <input className="field-input" name="title" defaultValue={parsed.title} required />
        </label>
        <label>
          <span className="field-label">Auftragsart</span>
          <select className="field-input" name="order_type" defaultValue={parsed.order_type}>
            {orderTypes.map((type) => (
              <option key={type} value={type}>
                {orderTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Dachform</span>
          <select className="field-input" name="roof_form" defaultValue={parsed.roof_form ?? ""}>
            <option value="">Noch offen</option>
            {roofForms.map((form) => (
              <option key={form} value={form}>
                {roofFormLabels[form]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Materialtyp</span>
          <select className="field-input" name="material_type" defaultValue={parsed.material_type ?? ""}>
            <option value="">Noch offen</option>
            {materialTypes.map((type) => (
              <option key={type} value={type}>
                {materialTypeLabels[type]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Priorität</span>
          <select className="field-input" name="priority" defaultValue={parsed.priority}>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {orderPriorityLabels[priority]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="field-label">Baustellenname</span>
          <input className="field-input" name="jobsite_name" defaultValue={parsed.jobsite_name ?? ""} />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Baustellenadresse</span>
          <input className="field-input" name="jobsite_address" defaultValue={parsed.jobsite_address ?? ""} />
        </label>
        <label>
          <span className="field-label">Start</span>
          <input className="field-input" type="date" name="start_date" defaultValue={parsed.start_date ?? ""} />
        </label>
        <label>
          <span className="field-label">Ende</span>
          <input className="field-input" type="date" name="end_date" defaultValue={parsed.end_date ?? ""} />
        </label>
        <label className="md:col-span-2">
          <span className="field-label">Zeitraum als Text</span>
          <input className="field-input" name="timeframe_text" defaultValue={parsed.timeframe_text ?? ""} />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <NumberInput name="length_m" label="Länge" value={dimensions.length_m} suffix="m" />
        <NumberInput name="width_m" label="Breite" value={dimensions.width_m} suffix="m" />
        <NumberInput name="area_m2" label="Fläche" value={dimensions.area_m2} suffix="m²" />
        <NumberInput name="roof_pitch" label="Dachneigung" value={dimensions.roof_pitch} suffix="°" />
        <NumberInput name="eaves_length_m" label="Traufe" value={dimensions.eaves_length_m} suffix="m" />
        <NumberInput name="ridge_length_m" label="First" value={dimensions.ridge_length_m} suffix="m" />
        <NumberInput name="verge_length_m" label="Ortgang" value={dimensions.verge_length_m} suffix="m" />
        <NumberInput name="valley_length_m" label="Kehle" value={dimensions.valley_length_m} suffix="m" />
        <NumberInput name="wall_connection_length_m" label="Wandanschluss/Attika" value={dimensions.wall_connection_length_m} suffix="m" />
        <NumberInput name="building_height_m" label="Gebäudehöhe" value={dimensions.building_height_m} suffix="m" />
        <NumberInput name="downpipe_length_m" label="Fallrohrlänge" value={dimensions.downpipe_length_m} suffix="m" />
        <NumberInput name="labor_hours_estimated" label="Arbeitszeit" value={parsed.labor_hours_estimated} suffix="Std." />
        <NumberInput name="roof_drains_count" label="Dachabläufe" value={dimensions.roof_drains_count} />
        <NumberInput name="emergency_overflows_count" label="Notüberläufe" value={dimensions.emergency_overflows_count} />
        <NumberInput name="penetrations_count" label="Durchdringungen" value={dimensions.penetrations_count} />
        <NumberInput name="roof_windows_count" label="Dachfenster" value={dimensions.roof_windows_count} />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label>
          <span className="field-label">Materialsystem</span>
          <input className="field-input" name="material_system" defaultValue={parsed.material_system ?? ""} />
        </label>
        <label>
          <span className="field-label">Kurzbeschreibung</span>
          <input className="field-input" name="description" defaultValue={parsed.description} />
        </label>
        <label>
          <span className="field-label">Kundentext</span>
          <textarea className="field-input min-h-28" name="customer_friendly_description" defaultValue={parsed.customer_friendly_description} />
        </label>
        <label>
          <span className="field-label">Interne Arbeitsanweisung</span>
          <textarea className="field-input min-h-28" name="internal_work_instructions" defaultValue={parsed.internal_work_instructions} />
        </label>
      </div>

      <button className="btn-secondary w-full sm:w-auto" type="submit">
        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        Daten aktualisieren und neu berechnen
      </button>
    </form>
  );
}

export default async function AiJobWizardPage({
  searchParams
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const context = await requireManager();
  const supabase = await createSupabaseServerClient();
  const params = (await searchParams) ?? {};
  const { error, success } = searchParamMessage(params);
  const draftId = paramValue(params, "draft_id");

  const [draftResult, recentResult] = await Promise.all([
    draftId
      ? supabase
          .from("ai_job_drafts")
          .select(aiJobDraftSelect)
          .eq("id", draftId)
          .eq("company_id", context.companyId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("ai_job_drafts")
      .select("id, raw_input, status, confidence, created_at, missing_fields, converted_order_id, parsed_json")
      .eq("company_id", context.companyId)
      .order("created_at", { ascending: false })
      .limit(6)
  ]);

  const draft = draftResult.data as AiJobDraftRow | null;
  const preview = draft?.preview_json as AiJobDraftPreview | undefined;
  const recentDrafts = (recentResult.data ?? []) as RecentDraft[];
  const schemaMissing = isMissingSchemaError(draftResult.error) || isMissingSchemaError(recentResult.error);
  const loadError = schemaMissing
    ? null
    : safeQueryErrorMessage(draftResult.error, "KI-Auftragsentwürfe konnten nicht geladen werden.") ??
      safeQueryErrorMessage(recentResult.error, "KI-Auftragsentwürfe konnten nicht geladen werden.");
  const missingFields = preview ? preview.parsed.missing_fields : [];
  const missingMaterials = preview ? formatMissingMaterial(preview.items) : [];
  const disabledActions = !draft || draft.status === "rejected" || draft.status === "converted_to_job";

  return (
    <>
      <PageHeader
        title="KI-Auftragswizard"
        description="Aufträge aus Sprache oder Text vorbereiten, regelbasiert berechnen und erst nach Chef-Bestätigung speichern."
      />
      <MessageBox error={error ?? loadError} success={success} />
      {schemaMissing ? (
        <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          {migrationMissingMessage("KI-Auftragswizard")} Der restliche Betrieb bleibt nutzbar.
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <StepCard step="Schritt 1" title="Auftrag beschreiben" icon={Sparkles}>
          <form action={prepareAiJobDraftAction} className="grid gap-3">
            <div className="rounded-md border border-line bg-fog p-3">
              <p className="text-sm font-black text-ink">Geführte Eingabe</p>
              <p className="mt-1 text-sm text-slate-600">
                Diese Felder reichen schon für einen regelbasierten Entwurf. Sprache oder Text ergänzt Details.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label>
                <span className="field-label">Kunde</span>
                <input className="field-input" name="customer_name" placeholder="z. B. Müller" />
              </label>
              <label className="md:col-span-2">
                <span className="field-label">Baustellenadresse</span>
                <input className="field-input" name="jobsite_address" placeholder="Straße, PLZ Ort" />
              </label>
              <label>
                <span className="field-label">Baustelle</span>
                <input className="field-input" name="jobsite_name" placeholder="z. B. Wohnhaus Müller" />
              </label>
              <label>
                <span className="field-label">Dachart</span>
                <select className="field-input" name="order_type" defaultValue="steildach">
                  {orderTypes.map((type) => (
                    <option key={type} value={type}>
                      {orderTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Dachform</span>
                <select className="field-input" name="roof_form" defaultValue="">
                  <option value="">Noch offen</option>
                  {roofForms.map((form) => (
                    <option key={form} value={form}>
                      {roofFormLabels[form]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="field-label">Materialtyp</span>
                <select className="field-input" name="material_type" defaultValue="">
                  <option value="">Noch offen</option>
                  {materialTypes.map((type) => (
                    <option key={type} value={type}>
                      {materialTypeLabels[type]}
                    </option>
                  ))}
                </select>
              </label>
              <NumberInput name="area_m2" label="Dachfläche" suffix="m²" />
              <NumberInput name="roof_pitch" label="Neigung" suffix="°" />
              <NumberInput name="ridge_length_m" label="First" suffix="m" />
              <NumberInput name="eaves_length_m" label="Traufe" suffix="m" />
              <NumberInput name="verge_length_m" label="Ortgang" suffix="m" />
              <NumberInput name="valley_length_m" label="Kehlen" suffix="m" />
              <NumberInput name="downpipe_length_m" label="Rinne/Fallrohr" suffix="m" />
              <NumberInput name="penetrations_count" label="Durchdringungen" />
            </div>
            <label>
              <span className="field-label">Sprache oder Text ergänzen</span>
              <textarea
                className="field-input min-h-44"
                name="raw_input"
                defaultValue={draft?.raw_input ?? ""}
                placeholder="Beispiel: Auftrag für Kunde Müller, Garage Flachdach neu abdichten, 6 mal 4 Meter, zwei Abläufe, Attika 20 Meter, nächste Woche."
              />
              <span className="field-help">Die KI erstellt nur einen Entwurf. Auftrag, Material, Reservierung und Mitbringliste entstehen erst nach Bestätigung.</span>
            </label>
            <button className="btn-primary" type="submit" disabled={schemaMissing}>
              <Bot className="h-4 w-4" aria-hidden="true" />
              {schemaMissing ? "Migration fehlt" : "Auftrag mit KI vorbereiten"}
            </button>
          </form>

          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="font-semibold">KI kann Fehler machen. Maße, Materialbedarf und Preise vor Verwendung prüfen.</p>
            </div>
          </div>
        </StepCard>

        <StepCard step="Schritt 2" title="Aktueller Entwurf" icon={ClipboardCheck}>
          {draft && preview ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-ink">{preview.parsed.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    {orderTypeLabels[preview.parsed.order_type]} · Vertrauen {Math.round(Number(preview.parsed.confidence ?? 0) * 100)} %
                  </p>
                </div>
                <StatusBadge status={draft.status} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Info label="Kunde" value={preview.parsed.customer_name} />
                <Info label="Baustelle" value={preview.parsed.jobsite_name ?? preview.parsed.title} />
                <Info label="Adresse" value={preview.parsed.jobsite_address} />
                <Info label="Zeitraum" value={preview.parsed.start_date ? formatDate(preview.parsed.start_date) : preview.parsed.timeframe_text} />
                <Info label="Dachform" value={preview.parsed.roof_form ? roofFormLabels[preview.parsed.roof_form] : null} />
                <Info label="Materialtyp" value={preview.parsed.material_type ? materialTypeLabels[preview.parsed.material_type] : null} />
                <Info label="Prüfhinweis" value="Entwurf - fachlich prüfen" />
              </div>

              {missingFields.length ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="font-black text-amber-900">Fehlende Angaben</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {missingFields.map((field) => (
                      <span key={field} className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-amber-900">
                        {field}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Die Pflichtdaten für eine erste Auftragsanlage sind erkannt.
                </div>
              )}

              {preview.parsed.follow_up_questions.length ? (
                <div className="rounded-md border border-line bg-fog p-3">
                  <p className="font-black text-ink">Rückfragen der KI</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {preview.parsed.follow_up_questions.map((question) => (
                      <li key={question}>• {question}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-48 items-center justify-center rounded-md border border-dashed border-line bg-fog p-6 text-center">
              <div>
                <PackageSearch className="mx-auto mb-3 h-8 w-8 text-moss" aria-hidden="true" />
                <p className="font-black text-ink">Noch kein KI-Entwurf geöffnet</p>
                <p className="mt-1 text-sm text-slate-600">Beschreibe links einen Auftrag oder öffne unten einen gespeicherten Entwurf.</p>
              </div>
            </div>
          )}
        </StepCard>
      </div>

      {draft && preview ? (
        <div className="mt-5 grid gap-5">
          <StepCard step="Schritt 3" title="Prüfen und korrigieren" icon={ShieldCheck}>
            <DraftCorrectionForm draft={draft} preview={preview} />
          </StepCard>

          <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
            <StepCard step="Schritt 4-5" title="Material und Lagerabgleich" icon={Warehouse}>
              <div className="mb-4 grid gap-3 sm:grid-cols-3">
                <Metric label="Positionen" value={String(preview.items.length)} />
                <Metric label="Fehlende Artikel" value={String(missingMaterials.length)} tone={missingMaterials.length ? "warn" : "good"} />
                <Metric label="Verschnitt" value={`${formatQuantity(preview.items[0]?.waste_percent ?? 20)} %`} />
              </div>

              {missingMaterials.length ? (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="font-black">Einkaufsvorschläge werden beim Erstellen automatisch vorbereitet</p>
                  <p className="mt-1">{missingMaterials.slice(0, 4).join(" · ")}</p>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr className="border-b border-line">
                      <th className="py-2 pr-3">Material</th>
                      <th className="py-2 pr-3">Grundmenge</th>
                      <th className="py-2 pr-3">Verschnitt</th>
                      <th className="py-2 pr-3">Gesamt</th>
                      <th className="py-2 pr-3">Bestand</th>
                      <th className="py-2 pr-3">Fehlt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.items.map((item) => (
                      <tr key={`${item.material_name}-${item.unit}`} className="border-b border-line/70 last:border-0">
                        <td className="py-3 pr-3">
                          <p className="font-black text-ink">{item.material_name}</p>
                          <p className="text-xs text-slate-500">{item.location_name || "Kein Lagerort"} · {item.price_source}</p>
                        </td>
                        <td className="py-3 pr-3">{formatQuantity(item.base_quantity)} {item.unit}</td>
                        <td className="py-3 pr-3">+{formatQuantity(item.waste_quantity)} {item.unit}</td>
                        <td className="py-3 pr-3 font-black text-ink">{formatQuantity(item.total_quantity)} {item.unit}</td>
                        <td className="py-3 pr-3">{formatQuantity(item.available_quantity)} {item.unit}</td>
                        <td className={cn("py-3 pr-3 font-black", item.missing_quantity > 0 ? "text-amber-700" : "text-emerald-700")}>
                          {formatQuantity(item.missing_quantity)} {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </StepCard>

            <StepCard step="Schritt 6" title="Chef-Kalkulation" icon={PackageCheck}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Metric label="Material EK" value={formatMoney(preview.estimate.material_ek_total)} />
                <Metric label="Material VK" value={formatMoney(preview.estimate.material_vk_total)} />
                <Metric label="Arbeitszeit" value={`${formatQuantity(preview.estimate.labor_hours_estimated)} Std.`} />
                <Metric label="Lohn netto" value={formatMoney(preview.estimate.labor_total_net)} />
                <Metric label="Gemeinkosten" value={formatMoney(preview.estimate.overhead_total)} />
                <Metric label="Marge/Gewinn" value={formatMoney(preview.estimate.margin_total)} tone="good" />
                <Metric label="Netto" value={formatMoney(preview.estimate.subtotal_net)} />
                <Metric label="Brutto" value={formatMoney(preview.estimate.total_gross)} />
              </div>

              <div className="mt-4 rounded-md border border-line bg-fog p-3 text-sm text-slate-700">
                <p className="font-black text-ink">Preisquellen</p>
                <div className="mt-2 space-y-1">
                  {Object.entries(preview.estimate.price_source_summary).map(([source, count]) => (
                    <p key={source}>{source}: {count}</p>
                  ))}
                </div>
                <p className="mt-3 font-semibold text-slate-600">Kalkulation basiert auf hinterlegten Regeln und Preisen. Vor Angebotsversand prüfen.</p>
              </div>
            </StepCard>
          </div>

          <StepCard step="Schritt 7" title="Bestätigen und übernehmen" icon={FilePlus2}>
            <div className="grid gap-3 md:grid-cols-5">
              <ActionForm draftId={draft.id} action="order" label="Auftrag erstellen" icon={ArrowRight} disabled={disabledActions} />
              <ActionForm draftId={draft.id} action="order_bringlist" label="Mitbringliste erzeugen" icon={ClipboardCheck} disabled={disabledActions} />
              <ActionForm draftId={draft.id} action="order_bringlist_reserve" label="Material reservieren" icon={PackageCheck} disabled={disabledActions} />
              <form action={saveAiJobDraftAction}>
                <input type="hidden" name="draft_id" value={draft.id} />
                <button className="btn-secondary w-full" type="submit" disabled={disabledActions}>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Als Entwurf speichern
                </button>
              </form>
              <form action={rejectAiJobDraftAction}>
                <input type="hidden" name="draft_id" value={draft.id} />
                <button className="btn-danger w-full" type="submit" disabled={draft.status === "converted_to_job" || draft.status === "rejected"}>
                  <XCircle className="h-4 w-4" aria-hidden="true" />
                  Verwerfen
                </button>
              </form>
            </div>
            {draft.converted_order_id ? (
              <Link className="btn-secondary mt-3" href={`/orders/${draft.converted_order_id}`}>
                Erstellten Auftrag öffnen
              </Link>
            ) : null}
          </StepCard>
        </div>
      ) : null}

      <section className="surface mt-5 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="meta-label">Verlauf</p>
            <h2 className="section-title">Letzte KI-Auftragsentwürfe</h2>
          </div>
          <Link href="/settings" className="btn-secondary">
            Einstellungen
          </Link>
        </div>
        {recentDrafts.length ? (
          <div className="grid gap-2">
            {recentDrafts.map((item) => {
              const parsed = item.parsed_json ?? {};
              const fields = jsonStringArray(item.missing_fields);
              return (
                <Link
                  key={item.id}
                  href={`/ai/job-wizard?draft_id=${item.id}`}
                  className="flex flex-col gap-2 rounded-md border border-line bg-white px-3 py-3 transition hover:border-moss/40 hover:bg-mint/50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-ink">{parsed.title ?? item.raw_input.slice(0, 80)}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDateTime(item.created_at)} · Vertrauen {Math.round(Number(item.confidence ?? 0) * 100)} %
                      {fields.length ? ` · offen: ${fields.join(", ")}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-line bg-fog p-4 text-sm text-slate-600">
            Noch keine KI-Auftragsentwürfe vorhanden.
          </p>
        )}
      </section>
    </>
  );
}
