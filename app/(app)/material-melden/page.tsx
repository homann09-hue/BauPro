import { BellPlus, Send } from "lucide-react";
import { ContextualHelpTip } from "@/components/help/ContextualHelpTip";
import { MessageBox } from "@/components/message-box";
import { FormDraftAutosave } from "@/components/offline/form-draft-autosave";
import { PageHeader } from "@/components/page-header";
import { VoiceInputField } from "@/components/voice/VoiceInputField";
import { reportMaterialNeedAction } from "@/lib/actions/material-alert-actions";
import { requireAppContext } from "@/lib/auth";
import { jobsiteFormSelect } from "@/lib/data/selects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { searchParamMessage } from "@/lib/utils";
import type { Jobsite } from "@/types/app";

export default async function MaterialReportPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await requireAppContext();
  const supabase = await createSupabaseServerClient();
  const { error, success } = searchParamMessage(await searchParams);

  const jobsitesQuery = (
    context.canManage
      ? supabase.from("jobsites").select(jobsiteFormSelect).eq("company_id", context.companyId)
      : supabase
          .from("jobsites")
          .select(jobsiteFormSelect)
          .eq("company_id", context.companyId)
          .contains("assigned_employee_ids", [context.userId])
  )
    .in("status", ["geplant", "aktiv"])
    .order("start_date", { ascending: true, nullsFirst: false })
    .limit(50);

  const { data: jobsites } = await jobsitesQuery;

  const visibleJobsites = (jobsites ?? []) as Jobsite[];

  return (
    <>
      <PageHeader
        title="Material melden"
        description="Fehlendes oder knappes Material direkt an Chef melden. Preis- und Einkaufsdaten bleiben ausgeblendet."
      />
      <MessageBox error={error} success={success} />
      <ContextualHelpTip featureKey="material_missing_report" returnTo="/material-melden" />

      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-700">
            <BellPlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Schnellmeldung</p>
            <h2 className="section-title">Was fehlt auf der Baustelle?</h2>
          </div>
        </div>

        <div className="mb-4">
        <FormDraftAutosave
          formId="material-report-form"
          storageKey={`baupro:material-report:${context.companyId}:${context.userId}`}
          offlineActionEndpoint="/api/offline/material-need"
          description="Materialname, Menge, Baustelle und Hinweis bleiben lokal erhalten, wenn der Empfang beim Absenden weg ist."
        />
        </div>

        <form id="material-report-form" action={reportMaterialNeedAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="return_to" value="/material-melden" />
          <div className="sm:col-span-2">
            <VoiceInputField label="Material" name="material_name" placeholder="z. B. Unterspannbahn, Schrauben, Rinnenhalter" required />
          </div>
          <label>
            <span className="field-label">Menge</span>
            <input className="field-input min-h-14 text-base" name="quantity" inputMode="decimal" defaultValue="1" />
          </label>
          <label>
            <span className="field-label">Einheit</span>
            <input className="field-input min-h-14 text-base" name="unit" defaultValue="Stück" />
          </label>
          <label className="sm:col-span-2">
            <span className="field-label">Baustelle</span>
            <select className="field-input min-h-14 text-base" name="job_id" defaultValue="">
              <option value="">Ohne Zuordnung</option>
              {visibleJobsites.map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {jobsite.name} · {jobsite.customer}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <VoiceInputField label="Hinweis" name="note" placeholder="optional, z. B. dringend für morgen" />
          </div>
          <button className="btn-primary sm:col-span-2 lg:col-span-4" type="submit">
            <Send className="h-4 w-4" aria-hidden="true" />
            Meldung senden
          </button>
        </form>
      </section>

      <p className="mt-4 rounded-md border border-line bg-white/80 p-3 text-sm text-slate-600">
        Chef sieht die Meldung im Dashboard als Materialwarnung und Einkaufsvorschlag. Mitarbeiter sehen keine EK-/VK-Preise
        und keine Preisquellen.
      </p>
    </>
  );
}
