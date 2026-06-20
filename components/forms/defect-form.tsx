import { AlertTriangle, Camera } from "lucide-react";
import { createDefectAction } from "@/lib/actions/defect-actions";
import { defectPriorities, defectPriorityLabels, defectSourceLabels } from "@/lib/defects";
import { PhotoCaptureButton } from "@/components/forms/photo-capture-button";
import { SubmitButton } from "@/components/submit-button";
import { VoiceInputField } from "@/components/voice/VoiceInputField";
import { VoiceTextarea } from "@/components/voice/VoiceTextarea";
import type { DefectPriority, DefectSourceType, Jobsite, Profile } from "@/types/app";

export type DefectFormDefaults = {
  jobsite_id?: string | null;
  title?: string | null;
  description?: string | null;
  priority?: DefectPriority | null;
  assigned_to?: string | null;
  due_date?: string | null;
  visible_to_customer?: boolean;
  source_type?: DefectSourceType | null;
  source_report_id?: string | null;
  source_report_photo_id?: string | null;
  source_checklist_id?: string | null;
  source_checklist_item_id?: string | null;
  source_customer_message_id?: string | null;
};

type DefectFormProps = {
  jobsites: Array<Pick<Jobsite, "id" | "name" | "customer" | "address">>;
  employees: Array<Pick<Profile, "id" | "full_name" | "email" | "role">>;
  canManage: boolean;
  defaults?: DefectFormDefaults;
  returnTo?: string;
};

export function DefectForm({ jobsites, employees, canManage, defaults, returnTo = "/maengel/neu" }: DefectFormProps) {
  const sourceType = defaults?.source_type ?? "manual";
  const selectedJobsite = defaults?.jobsite_id ?? jobsites[0]?.id ?? "";

  return (
    <form action={createDefectAction} className="surface grid gap-5 p-4 sm:p-5">
      <input type="hidden" name="return_to" value={returnTo} />
      <input type="hidden" name="source_type" value={sourceType} />
      <HiddenInput name="source_report_id" value={defaults?.source_report_id} />
      <HiddenInput name="source_report_photo_id" value={defaults?.source_report_photo_id} />
      <HiddenInput name="source_checklist_id" value={defaults?.source_checklist_id} />
      <HiddenInput name="source_checklist_item_id" value={defaults?.source_checklist_item_id} />
      <HiddenInput name="source_customer_message_id" value={defaults?.source_customer_message_id} />

      <div className="flex items-start gap-3 rounded-lg border border-line bg-fog p-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-sm font-black text-ink">Mangel erfassen</p>
          <p className="mt-1 text-sm text-slate-600">
            Quelle: {defectSourceLabels[sourceType]}. Foto, Frist und Verantwortlicher sind optional, helfen aber beim schnellen Nachverfolgen.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
        <div className="grid gap-4">
          <VoiceInputField
            label="Titel"
            id="defect-title"
            name="title"
            defaultValue={defaults?.title ?? ""}
            placeholder="z. B. Ortgang links beschädigt"
            required
          />

          <VoiceTextarea
            label="Beschreibung"
            id="defect-description"
            name="description"
            defaultValue={defaults?.description ?? ""}
            rows={6}
            placeholder="Was ist passiert, wo genau, was muss erledigt werden?"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="field-label">Baustelle</span>
              <select className="field-input min-h-14 text-base" name="jobsite_id" defaultValue={selectedJobsite} required>
                {jobsites.map((jobsite) => (
                  <option key={jobsite.id} value={jobsite.id}>
                    {jobsite.name} · {jobsite.customer}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="field-label">Priorität</span>
              <select className="field-input min-h-14 text-base" name="priority" defaultValue={defaults?.priority ?? "mittel"}>
                {defectPriorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {defectPriorityLabels[priority]}
                  </option>
                ))}
              </select>
            </label>

            {canManage ? (
              <label>
                <span className="field-label">Verantwortlicher</span>
                <select className="field-input min-h-14 text-base" name="assigned_to" defaultValue={defaults?.assigned_to ?? ""}>
                  <option value="">Noch offen</option>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.full_name || employee.email}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label>
              <span className="field-label">Frist optional</span>
              <input className="field-input min-h-14 text-base" name="due_date" type="date" defaultValue={defaults?.due_date ?? ""} />
            </label>
          </div>
        </div>

        <aside className="grid content-start gap-4 rounded-lg border border-line bg-white p-3">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="font-black text-ink">Foto-Nachweis</p>
                <p className="mt-1 text-sm text-slate-600">Auf dem Handy öffnet sich direkt die Kamera.</p>
              </div>
              <Camera className="h-5 w-5 text-moss" aria-hidden="true" />
            </div>
            <PhotoCaptureButton name="photo" label="Foto zum Mangel aufnehmen" />
          </div>

          {canManage ? (
            <label className="flex items-start gap-3 rounded-md border border-line bg-fog px-3 py-3 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                name="visible_to_customer"
                defaultChecked={defaults?.visible_to_customer ?? false}
                className="mt-1 h-4 w-4 rounded border-line text-moss"
              />
              <span>
                Im Kundenportal freigeben
                <span className="block text-xs font-semibold text-slate-500">Kunden sehen nur freigegebene Mängel.</span>
              </span>
            </label>
          ) : null}
        </aside>
      </div>

      <SubmitButton className="min-h-14">
        <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        Mangel speichern
      </SubmitButton>
    </form>
  );
}

function HiddenInput({ name, value }: { name: string; value?: string | null }) {
  if (!value) return null;
  return <input type="hidden" name={name} value={value} />;
}
