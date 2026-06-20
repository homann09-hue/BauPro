"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, FilePenLine, ShieldCheck, Sparkles } from "lucide-react";
import { VoiceTextarea } from "@/components/voice/VoiceTextarea";
import type { DailyReportAutomationContext, DailyReportDraft } from "@/lib/ai/types";

type DraftResponse = {
  ok: boolean;
  configured: boolean;
  message: string;
  result?: DailyReportDraft;
};

function setFormValue(id: string, value: string | null) {
  if (!value) return;
  const element =
    (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null) ??
    (document.querySelector(`[name="${id}"]`) as HTMLInputElement | HTMLTextAreaElement | null);
  if (!element) return;
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

function checkedLabel(form: HTMLFormElement, name: string) {
  return Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`))
    .map((input) => input.closest("label")?.textContent?.replace(/\s+/g, " ").trim())
    .filter((label): label is string => Boolean(label));
}

function formString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function currentContext(): { context: DailyReportAutomationContext; existingPhotoIds: string[] } {
  const form = document.querySelector<HTMLFormElement>("form");
  if (!form) return { context: {}, existingPhotoIds: [] };

  const formData = new FormData(form);
  const jobsiteSelect = form.querySelector<HTMLSelectElement>('select[name="jobsite_id"]');
  const fileInput = form.querySelector<HTMLInputElement>('input[type="file"][name="photos"]');
  const selectedPhotoNames = Array.from(fileInput?.files ?? []).map((file) => file.name || "Baustellenfoto");
  const existingPhotoIds = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="ai_existing_photo_ids"]')).map((input) => input.value);
  const existingPhotoNames = Array.from(form.querySelectorAll<HTMLInputElement>('input[name="ai_existing_photo_names"]')).map((input) => input.value);
  const photoContextNote =
    existingPhotoIds.length > 0
      ? "Bereits gespeicherte Fotos können serverseitig als Bildkontext genutzt werden."
      : selectedPhotoNames.length > 0
        ? "Neue, noch nicht gespeicherte Fotos werden vor dem Absenden nicht an OpenAI gesendet; Dateinamen und Anzahl dienen nur als Kontext."
        : "Keine Fotos ausgewählt.";

  return {
    existingPhotoIds,
    context: {
      jobsite_label: jobsiteSelect?.selectedOptions[0]?.textContent?.trim() || null,
      report_date: formString(formData, "report_date"),
      weather: {
        summary: formString(formData, "weather_summary") ?? formString(formData, "weather"),
        temperature_c: formString(formData, "weather_temperature_c"),
        precipitation_mm: formString(formData, "weather_precipitation_mm"),
        wind_kmh: formString(formData, "weather_wind_kmh"),
        source: formString(formData, "weather_source")
      },
      employees: checkedLabel(form, "employee_ids"),
      time_entries: checkedLabel(form, "linked_time_entry_ids"),
      material_usage: formString(formData, "material_usage"),
      machine_usage: formString(formData, "machine_usage"),
      vehicle_names: checkedLabel(form, "vehicle_ids"),
      existing_photo_names: existingPhotoNames,
      selected_photo_names: selectedPhotoNames,
      photo_context_note: photoContextNote
    }
  };
}

function issuesFromDraft(draft: DailyReportDraft) {
  return [
    draft.special_notes ? `Besonderheiten:\n${draft.special_notes}` : null,
    draft.defects_obstructions ? `Mängel/Behinderungen:\n${draft.defects_obstructions}` : null,
    draft.next_steps ? `Nächste Schritte:\n${draft.next_steps}` : null,
    draft.issues ? `Weitere Notizen:\n${draft.issues}` : null
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function ReportDraftAssistant({
  existingPhotos = []
}: {
  existingPhotos?: Array<{ id: string; fileName: string }>;
}) {
  const [input, setInput] = useState("");
  const [aiProcessingOptIn, setAiProcessingOptIn] = useState(false);
  const [response, setResponse] = useState<DraftResponse | null>(null);
  const [pending, startTransition] = useTransition();

  function generateDraft() {
    const text = input.trim();
    if (!text) return;
    if (!aiProcessingOptIn) {
      setResponse({
        ok: false,
        configured: true,
        message: "Bitte bestaetige zuerst die KI-Verarbeitung. Ohne Opt-in bleibt die normale Texteingabe aktiv."
      });
      return;
    }

    setResponse(null);
    startTransition(async () => {
      try {
        const { context, existingPhotoIds } = currentContext();
        const result = await fetch("/api/ai/report-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: text,
            aiProcessingOptIn: true,
            context,
            existingPhotoIds
          })
        });
        const payload = (await result.json()) as DraftResponse;
        setResponse(payload);
      } catch {
        setResponse({
          ok: false,
          configured: true,
          message: "KI-Entwurf konnte gerade nicht erstellt werden. Du kannst den Bericht normal ausfuellen."
        });
      }
    });
  }

  function applyDraft() {
    if (!response?.result) return;
    setFormValue("activities", response.result.activities);
    setFormValue("material_usage", response.result.material_usage);
    setFormValue("machine_usage", response.result.machine_usage);
    setFormValue("issues", issuesFromDraft(response.result));
    setFormValue("weather", response.result.weather);
    setFormValue("weather_summary", response.result.weather);
  }

  function updateDraftField(field: keyof DailyReportDraft, value: string) {
    setResponse((current) => {
      if (!current?.result) return current;
      return {
        ...current,
        result: {
          ...current.result,
          [field]: value
        }
      };
    });
  }

  return (
    <div className="mb-5 rounded-lg border border-moss/20 bg-mint/60 p-4">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-moss shadow-sm">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="meta-label">KI-Hilfe</p>
          <h2 className="section-title">Tagesbericht aus Stichpunkten</h2>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <VoiceTextarea
          label="Sprache oder Stichpunkte für KI"
          name="ai_report_input"
          className="min-h-28"
          value={input}
          onValueChange={setInput}
          placeholder="z. B. 7 bis 16 Uhr, Dachrinne Garage montiert, 12 m Rinne, 8 Halter, Anschluss rechts schwierig"
        />
        <button type="button" className="btn-secondary self-start lg:self-end" onClick={generateDraft} disabled={pending || !input.trim()}>
          <FilePenLine className="h-4 w-4" aria-hidden="true" />
          {pending ? "Erstelle..." : "Entwurf"}
        </button>
      </div>

      <label className="mt-3 flex items-start gap-3 rounded-md border border-white/80 bg-white/80 p-3 text-sm">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-line text-moss"
          checked={aiProcessingOptIn}
          onChange={(event) => setAiProcessingOptIn(event.target.checked)}
        />
        <span>
          <span className="flex items-center gap-2 font-black text-ink">
            <ShieldCheck className="h-4 w-4 text-moss" aria-hidden="true" />
            KI-Verarbeitung erlauben
          </span>
          <span className="mt-1 block leading-6 text-slate-600">
            Text, Formularwerte, Wetter, Zeiten, Material und gespeicherte Fotos können zur Entwurfserstellung serverseitig an OpenAI
            übermittelt werden. Der Vorschlag wird nicht automatisch gespeichert.
          </span>
        </span>
      </label>

      {existingPhotos.length > 0 ? (
        <div className="mt-3 hidden">
          {existingPhotos.map((photo) => (
            <span key={photo.id}>
              <input type="hidden" name="ai_existing_photo_ids" value={photo.id} />
              <input type="hidden" name="ai_existing_photo_names" value={photo.fileName} />
            </span>
          ))}
        </div>
      ) : null}

      {response ? (
        <div className="mt-3 rounded-md border border-white/80 bg-white/90 p-3 text-sm">
          {!response.ok ? (
            <p className="font-semibold text-amber-800">{response.message}</p>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="font-black text-ink">Entwurf wurde erstellt. Bitte prüfen, bearbeiten und dann übernehmen.</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{response.result?.summary}</p>
                {response.result?.token_note ? <p className="mt-1 text-xs font-semibold text-slate-500">{response.result.token_note}</p> : null}
              </div>

              {response.result?.missing_information.length ? (
                <div className="rounded-md border border-warning/30 bg-amber-50 p-3 text-amber-900">
                  <p className="flex items-center gap-2 font-black">
                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                    Fehlende Angaben
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {response.result.missing_information.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {response.result?.follow_up_questions.length ? (
                <div className="rounded-md border border-line bg-fog p-3">
                  <p className="font-black text-ink">Rueckfragen</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-700">
                    {response.result.follow_up_questions.map((question) => (
                      <li key={question}>{question}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {response.result ? <DraftEditor draft={response.result} onChange={updateDraftField} /> : null}
              <button type="button" className="btn-primary" onClick={applyDraft}>
                In Formular übernehmen
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function DraftEditor({
  draft,
  onChange
}: {
  draft: DailyReportDraft;
  onChange: (field: keyof DailyReportDraft, value: string) => void;
}) {
  const fields: Array<{ key: keyof DailyReportDraft; label: string; rows?: number }> = [
    { key: "general_information", label: "1. Allgemeine Angaben" },
    { key: "weather_section", label: "2. Wetter" },
    { key: "employees_section", label: "3. Mitarbeiter" },
    { key: "activities", label: "4. Ausgeführte Arbeiten", rows: 4 },
    { key: "material_usage", label: "5. Materialverbrauch", rows: 3 },
    { key: "machine_usage", label: "6. Maschinen/Fahrzeuge", rows: 3 },
    { key: "special_notes", label: "7. Besonderheiten", rows: 3 },
    { key: "defects_obstructions", label: "8. Mängel/Behinderungen", rows: 3 },
    { key: "next_steps", label: "9. Nächste Schritte", rows: 3 }
  ];

  return (
    <div className="grid gap-3">
      {fields.map((field) => (
        <label key={field.key}>
          <span className="field-label">{field.label}</span>
          <textarea
            className="field-input min-h-20 text-sm"
            rows={field.rows ?? 2}
            value={String(draft[field.key] ?? "")}
            onChange={(event) => onChange(field.key, event.target.value)}
          />
        </label>
      ))}
    </div>
  );
}
