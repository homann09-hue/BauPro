import { ClipboardCheck } from "lucide-react";
import { createJobsiteChecklistFromTemplateAction } from "@/lib/actions/checklist-actions";
import { checklistCategoryLabels } from "@/lib/checklists";
import { formatDate } from "@/lib/utils";
import { SubmitButton } from "@/components/submit-button";
import type { ChecklistTemplate, Jobsite } from "@/types/app";

export function JobsiteChecklistCreateForm({
  templates,
  jobsites,
  jobsiteId
}: {
  templates: ChecklistTemplate[];
  jobsites?: Array<Pick<Jobsite, "id" | "name" | "customer" | "address">>;
  jobsiteId?: string;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={createJobsiteChecklistFromTemplateAction} className="surface grid gap-4 p-4 sm:p-5">
      <input type="hidden" name="return_to" value={jobsiteId ? `/baustellen/${jobsiteId}/checklists/new` : "/checklists"} />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-moss">
          <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-black text-ink">Checkliste aus Vorlage starten</h2>
          <p className="mt-1 text-sm text-slate-600">
            Vorlage wählen, Baustelle bestätigen und direkt auf dem Handy Punkt für Punkt abarbeiten.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {jobsiteId ? (
          <input type="hidden" name="jobsite_id" value={jobsiteId} />
        ) : (
          <label>
            <span className="field-label">Baustelle</span>
            <select className="field-input min-h-14 text-base" name="jobsite_id" required>
              {(jobsites ?? []).map((jobsite) => (
                <option key={jobsite.id} value={jobsite.id}>
                  {jobsite.name} · {jobsite.customer}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          <span className="field-label">Vorlage</span>
          <select className="field-input min-h-14 text-base" name="template_id" required>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name} · {checklistCategoryLabels[template.category]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="field-label">Eigener Titel optional</span>
          <input className="field-input min-h-14 text-base" name="title" placeholder="z. B. Abnahme Garage Schmidt" />
        </label>
        <label>
          <span className="field-label">Faelligkeit</span>
          <input className="field-input min-h-14 text-base" name="due_date" type="date" defaultValue={today} />
        </label>
      </div>

      <label>
        <span className="field-label">Notizen optional</span>
        <textarea className="field-input min-h-24 text-base" name="notes" placeholder={`Kurzer Hinweis für ${formatDate(today)}`} />
      </label>

      <SubmitButton className="min-h-14">
        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
        Checkliste starten
      </SubmitButton>
    </form>
  );
}
