import { ClipboardList } from "lucide-react";
import { createChecklistTemplateAction } from "@/lib/actions/checklist-actions";
import { checklistCategoryLabels, checklistCategories } from "@/lib/checklists";
import { SubmitButton } from "@/components/submit-button";

export function ChecklistTemplateForm() {
  return (
    <form action={createChecklistTemplateAction} className="surface grid gap-4 p-4 sm:p-5">
      <input type="hidden" name="return_to" value="/checklists/templates/new" />
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-moss">
          <ClipboardList className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-lg font-black text-ink">Neue Checklistenvorlage</h2>
          <p className="mt-1 text-sm text-slate-600">
            Ein Punkt pro Zeile. Mit <span className="font-black">#foto</span> am Zeilenanfang wird ein Foto-Nachweis Pflicht.
            Mit <span className="font-black">|</span> kannst du einen kurzen Hilfetext ergänzen.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="field-label">Name der Vorlage</span>
          <input className="field-input min-h-14 text-base" name="name" placeholder="z. B. Abnahme Steildach" required />
        </label>
        <label>
          <span className="field-label">Kategorie</span>
          <select className="field-input min-h-14 text-base" name="category" defaultValue="baustart">
            {checklistCategories.map((category) => (
              <option key={category} value={category}>
                {checklistCategoryLabels[category]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        <span className="field-label">Beschreibung optional</span>
        <textarea
          className="field-input min-h-24 text-base"
          name="description"
          placeholder="Wofür ist diese Vorlage gedacht?"
        />
      </label>

      <div className="grid gap-3 lg:grid-cols-2">
        <label>
          <span className="field-label">Pflichtpunkte</span>
          <textarea
            className="field-input min-h-56 text-base"
            name="required_items"
            placeholder={`PSA vorhanden und getragen\n#foto Absturzsicherung geprüft | Foto vom Seitenschutz speichern`}
            required
          />
        </label>
        <label>
          <span className="field-label">Optionale Punkte</span>
          <textarea
            className="field-input min-h-56 text-base"
            name="optional_items"
            placeholder={`Kunde informiert\nTagesbericht vorbereitet`}
          />
        </label>
      </div>

      <SubmitButton className="min-h-14">
        <ClipboardList className="h-4 w-4" aria-hidden="true" />
        Vorlage speichern
      </SubmitButton>
    </form>
  );
}
