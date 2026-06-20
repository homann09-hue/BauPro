"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { BellPlus, ClipboardList, Clock3, ListChecks, Mic, Pencil, Save, Sparkles, StickyNote, Trash2, TriangleAlert, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { classifyBusinessInputAction } from "@/lib/actions/ai-actions";
import { discardVoiceNoteAction, confirmVoiceNoteAction } from "@/lib/actions/voice-actions";
import { createGermanSpeechRecognition, supportsSpeechRecognition } from "@/lib/voice/speech";
import { parseVoiceInput } from "@/lib/voice/voice-router";
import { usePathname } from "next/navigation";
import type { ClassifiedBusinessInput } from "@/lib/ai/types";
import type { VoiceQuickActionKind } from "@/components/voice/VoiceQuickAction";

const intentLabels = {
  bring_list: "Mitbringliste",
  time_tracking: "Zeiterfassung",
  material_alert: "Materialmeldung",
  job_note: "Baustellennotiz",
  unknown: "Unklar"
};

const aiIntentLabels: Record<ClassifiedBusinessInput["intent"], string> = {
  customer_note: "Kundennotiz",
  new_task: "Aufgabe",
  time_entry: "Zeiterfassung",
  bring_list: "Mitbringliste",
  material_request: "Materialmeldung",
  job_note: "Baustellennotiz",
  report_entry: "Tagesbericht",
  appointment: "Termin",
  unknown: "Unklar"
};

type AiAnalysisState = Awaited<ReturnType<typeof classifyBusinessInputAction>> | null;

const quickActionTemplates: Record<
  VoiceQuickActionKind,
  { label: string; helper: string; prefix: string; icon: LucideIcon }
> = {
  time_tracking: {
    label: "Stunde erfassen",
    helper: "z. B. heute Baustelle Mueller von 7 bis 16 Uhr, 30 Minuten Pause...",
    prefix: "Arbeitszeit: ",
    icon: Clock3
  },
  report_entry: {
    label: "Tagesbericht",
    helper: "Tätigkeit, Material, Probleme und Hinweis für morgen diktieren.",
    prefix: "Tagesbericht: ",
    icon: ClipboardList
  },
  bring_list: {
    label: "Material für morgen",
    helper: "z. B. morgen Baustelle Mueller 20 Latten und den Brenner mitnehmen.",
    prefix: "Mitbringliste morgen: ",
    icon: ListChecks
  },
  material_alert: {
    label: "Problem melden",
    helper: "Fehlendes Material oder Engpass direkt an Chef/Admin melden.",
    prefix: "Materialmeldung: ",
    icon: BellPlus
  },
  job_note: {
    label: "Baustelle notieren",
    helper: "Hinweis, Schaden, Kundenwunsch oder offene Frage festhalten.",
    prefix: "Baustellennotiz: ",
    icon: StickyNote
  }
};

export function VoiceDictation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AiAnalysisState>(null);
  const [aiPending, startAiTransition] = useTransition();
  const speechSupported = supportsSpeechRecognition();
  const parsed = useMemo(() => parseVoiceInput(text), [text]);
  const aiResult = aiAnalysis?.ok ? aiAnalysis.result : null;
  const displayMaterials = aiResult ? [...aiResult.materials, ...aiResult.tools] : parsed.materials;
  const aiActionId = aiAnalysis?.ok ? aiAnalysis.actionId ?? "" : "";

  useEffect(() => {
    function openFromEvent(event: Event) {
      const detail = (event as CustomEvent<{ kind?: VoiceQuickActionKind }>).detail;
      setOpen(true);
      setEditing(false);
      if (detail?.kind) {
        setText(quickActionTemplates[detail.kind].prefix);
      }
    }

    window.addEventListener("baupro:open-voice", openFromEvent);
    return () => window.removeEventListener("baupro:open-voice", openFromEvent);
  }, []);

  function updateText(value: string) {
    setText(value);
    setAiAnalysis(null);
  }

  function chooseQuickAction(kind: VoiceQuickActionKind) {
    updateText(quickActionTemplates[kind].prefix);
    setEditing(false);
  }

  function analyzeWithAi() {
    const value = text.trim();
    if (!value) return;
    startAiTransition(async () => {
      const result = await classifyBusinessInputAction(value);
      setAiAnalysis(result);
    });
  }

  function startDictation() {
    setOpen(true);
    setEditing(false);
    const recognition = createGermanSpeechRecognition();

    if (!recognition) {
      setEditing(true);
      return;
    }

    setListening(true);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (transcript) {
        setAiAnalysis(null);
        setText((current) => (current ? `${current} ${transcript}` : transcript));
      }
    };
    recognition.onerror = () => {
      setListening(false);
      setEditing(true);
    };
    recognition.onend = () => setListening(false);
    recognition.start();
  }

  return (
    <>
      <button
        type="button"
        onClick={startDictation}
        className="fixed bottom-[calc(10.5rem+env(safe-area-inset-bottom))] left-4 z-40 inline-flex h-14 w-14 items-center justify-center rounded-md bg-anthracite text-white shadow-lift transition hover:-translate-y-0.5 hover:bg-slate-800 lg:bottom-6 lg:left-auto lg:right-6"
        aria-label="Diktieren"
        title="Diktieren"
      >
        <Mic className="h-6 w-6" aria-hidden="true" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-ink/40 p-3 backdrop-blur-sm">
          <div className="mx-auto mt-10 max-w-2xl rounded-lg bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-line p-4">
              <div>
                <p className="meta-label">BauPro Spracheingabe</p>
                <h2 className="text-lg font-black text-ink">{listening ? "Ich hoere zu..." : "Ich habe erkannt:"}</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-fog"
                aria-label="Schliessen"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {!speechSupported ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  Dein Browser unterstuetzt Sprache-zu-Text hier nicht. Du kannst den Text normal eingeben.
                </p>
              ) : null}

              <textarea
                className="field-input min-h-28"
                value={text}
                readOnly={!editing}
                onChange={(event) => updateText(event.target.value)}
                placeholder="Diktat oder Text eingeben, z. B. Für Baustelle Mueller morgen 30 Dachlatten mitnehmen."
              />

              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(quickActionTemplates).map(([kind, item]) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => chooseQuickAction(kind as VoiceQuickActionKind)}
                      className="flex min-h-16 items-start gap-3 rounded-md border border-line bg-white p-3 text-left shadow-sm transition hover:border-primary/40 hover:bg-mint"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span>
                        <span className="block text-sm font-black text-ink">{item.label}</span>
                        <span className="mt-1 block text-xs font-semibold text-slate-500">{item.helper}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-2 rounded-md bg-fog p-3 text-sm sm:grid-cols-2">
                <Info label="Bereich" value={aiResult ? aiIntentLabels[aiResult.intent] : intentLabels[parsed.intent]} />
                <Info label="Baustelle/Auftrag" value={aiResult?.job_name || aiResult?.customer_name || parsed.targetName || "Nicht erkannt"} />
                <Info label="Datum" value={aiResult?.date || parsed.date || "Nicht erkannt"} />
                <Info
                  label="Zeiten"
                  value={
                    aiResult?.time_start || aiResult?.time_end || parsed.startTime || parsed.endTime
                      ? `${aiResult?.time_start ?? parsed.startTime ?? "--:--"} bis ${aiResult?.time_end ?? parsed.endTime ?? "--:--"}, Pause ${
                          aiResult?.break_minutes ?? parsed.breakMinutes ?? 0
                        } Min.`
                      : "Nicht erkannt"
                  }
                />
              </div>

              <div className="rounded-md border border-line bg-white p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-ink">KI-Auswertung</p>
                    <p className="mt-1 text-sm text-slate-600">
                      Optional. Die KI erstellt nur einen Vorschlag; gespeichert wird erst nach deiner Bestätigung.
                    </p>
                  </div>
                  <button type="button" className="btn-secondary" onClick={analyzeWithAi} disabled={!text.trim() || aiPending}>
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                    {aiPending ? "Analysiere..." : "KI auswerten"}
                  </button>
                </div>

                {aiAnalysis && !aiAnalysis.ok ? (
                  <div className="mt-3 flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{aiAnalysis.message}</span>
                  </div>
                ) : null}

                {aiResult ? (
                  <div className="mt-3 rounded-md bg-fog p-3 text-sm text-slate-700">
                    <p className="font-black text-ink">
                      Sicherheit: {Math.round(aiResult.confidence * 100)} %
                      {aiResult.confidence < 0.7 ? " - Rueckfrage noetig" : ""}
                    </p>
                    {aiResult.notes ? <p className="mt-1 whitespace-pre-wrap">{aiResult.notes}</p> : null}
                    {aiResult.follow_up_questions.length > 0 ? (
                      <p className="mt-2 text-amber-800">Rueckfragen: {aiResult.follow_up_questions.join(" ")}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {displayMaterials.length > 0 ? (
                <div className="rounded-md border border-line p-3">
                  <p className="mb-2 text-sm font-black text-ink">Materialien</p>
                  <div className="grid gap-2">
                    {displayMaterials.map((material, index) => (
                      <div key={`${material.name}-${index}`} className="rounded-md bg-fog px-3 py-2 text-sm">
                        {material.quantity} {material.unit} {material.name}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Bearbeiten
                </button>
                <form action={discardVoiceNoteAction}>
                  <input type="hidden" name="raw_text" value={text} />
                  <input type="hidden" name="ai_action_id" value={aiActionId} />
                  <input type="hidden" name="return_to" value={pathname} />
                  <button type="submit" className="btn-secondary w-full">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Verwerfen
                  </button>
                </form>
                <form action={confirmVoiceNoteAction}>
                  <input type="hidden" name="raw_text" value={text} />
                  <input type="hidden" name="ai_action_id" value={aiActionId} />
                  <input type="hidden" name="return_to" value={pathname} />
                  <button type="submit" className="btn-primary w-full" disabled={!text.trim()}>
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Speichern
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="meta-label">{label}</p>
      <p className="mt-1 font-black text-ink">{value}</p>
    </div>
  );
}
