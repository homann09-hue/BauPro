"use client";

import { useState, useTransition } from "react";
import { FilePenLine, Sparkles } from "lucide-react";
import { generateDailyReportDraftAction } from "@/lib/actions/ai-actions";
import type { DailyReportDraft } from "@/lib/ai/types";

type DraftResponse = {
  ok: boolean;
  configured: boolean;
  message: string;
  result?: DailyReportDraft;
};

function setFormValue(id: string, value: string | null) {
  if (!value) return;
  const element = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!element) return;
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

export function ReportDraftAssistant() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState<DraftResponse | null>(null);
  const [pending, startTransition] = useTransition();

  function generateDraft() {
    const text = input.trim();
    if (!text) return;

    setResponse(null);
    startTransition(async () => {
      const result = await generateDailyReportDraftAction(text);
      setResponse(result);
    });
  }

  function applyDraft() {
    if (!response?.result) return;
    setFormValue("activities", response.result.activities);
    setFormValue("material_usage", response.result.material_usage);
    setFormValue("issues", response.result.issues);
    setFormValue("weather", response.result.weather);
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
        <textarea
          className="field-input min-h-24"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="z. B. 7 bis 16 Uhr, Dachrinne Garage montiert, 12 m Rinne, 8 Halter, Anschluss rechts schwierig"
        />
        <button type="button" className="btn-secondary self-start lg:self-end" onClick={generateDraft} disabled={pending || !input.trim()}>
          <FilePenLine className="h-4 w-4" aria-hidden="true" />
          {pending ? "Erstelle..." : "Entwurf"}
        </button>
      </div>

      {response ? (
        <div className="mt-3 rounded-md border border-white/80 bg-white/90 p-3 text-sm">
          {!response.ok ? (
            <p className="font-semibold text-amber-800">{response.message}</p>
          ) : (
            <div className="space-y-3">
              <p className="font-black text-ink">Entwurf wurde erstellt. Bitte pruefen und dann uebernehmen.</p>
              <p className="whitespace-pre-wrap text-slate-700">{response.result?.summary}</p>
              {response.result?.follow_up_questions.length ? (
                <p className="text-amber-800">Rueckfragen: {response.result.follow_up_questions.join(" ")}</p>
              ) : null}
              <button type="button" className="btn-primary" onClick={applyDraft}>
                In Formular uebernehmen
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
