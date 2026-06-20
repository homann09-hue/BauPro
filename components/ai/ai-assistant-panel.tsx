"use client";

import { useState, useTransition } from "react";
import { Bot, Send, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { askAiAssistantAction, matchMaterialNameAction } from "@/lib/actions/ai-actions";
import type { AiAssistantAnswer, MaterialMatchDraft } from "@/lib/ai/types";

type AssistantResponse = {
  ok: boolean;
  configured: boolean;
  message: string;
  result?: AiAssistantAnswer;
};

type MaterialMatchResponse = {
  ok: boolean;
  configured: boolean;
  message: string;
  result?: MaterialMatchDraft;
};

const managerPrompts = [
  "Was ist knapp und muss bestellt werden?",
  "Was fehlt für morgen?",
  "Welche offenen Aufträge haben Materialrisiken?",
  "Fasse meine heutige Betriebsübersicht zusammen."
];

const employeePrompts = [
  "Was muss ich morgen mitnehmen?",
  "Welche Baustelle habe ich morgen?",
  "Welche Zeiten fehlen mir diese Woche?",
  "Formuliere meinen Tagesbericht aus Stichpunkten."
];

export function AiAssistantPanel({
  canManage,
  configured,
  enabledMessage
}: {
  canManage: boolean;
  configured: boolean;
  enabledMessage: string | null;
}) {
  const [input, setInput] = useState("");
  const [materialInput, setMaterialInput] = useState("");
  const [response, setResponse] = useState<AssistantResponse | null>(null);
  const [materialResponse, setMaterialResponse] = useState<MaterialMatchResponse | null>(null);
  const [pending, startTransition] = useTransition();
  const [materialPending, startMaterialTransition] = useTransition();
  const prompts = canManage ? managerPrompts : employeePrompts;

  function askAssistant(value = input) {
    const text = value.trim();
    if (!text) return;
    setInput(text);
    setResponse(null);
    startTransition(async () => {
      const result = await askAiAssistantAction(text);
      setResponse(result);
    });
  }

  function matchMaterial() {
    const text = materialInput.trim();
    if (!text) return;
    setMaterialResponse(null);
    startMaterialTransition(async () => {
      const result = await matchMaterialNameAction(text);
      setMaterialResponse(result);
    });
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
      <section className="surface p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-ink text-white">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">BauPro KI</p>
            <h2 className="section-title">Frage an deinen Betriebsassistenten</h2>
          </div>
        </div>

        {!configured ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            KI-Funktionen sind noch nicht konfiguriert. Trage serverseitig `OPENAI_API_KEY` ein.
          </p>
        ) : null}

        {enabledMessage ? (
          <p className="mb-4 rounded-md border border-line bg-fog p-3 text-sm text-slate-700">{enabledMessage}</p>
        ) : null}

        <label>
          <span className="field-label">Frage oder Arbeitsauftrag</span>
          <textarea
            className="field-input min-h-36"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={
              canManage
                ? "z. B. Was muss ich für morgen bestellen?"
                : "z. B. Was muss ich morgen zur Baustelle mitnehmen?"
            }
          />
        </label>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-primary" onClick={() => askAssistant()} disabled={pending || !input.trim()}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {pending ? "KI arbeitet..." : "KI fragen"}
          </button>
        </div>

        <div className="mt-5 grid gap-2">
          {prompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="rounded-md border border-line bg-white px-3 py-2 text-left text-sm font-semibold text-ink transition hover:border-moss/40 hover:bg-mint"
              onClick={() => askAssistant(prompt)}
              disabled={pending}
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-md border border-line bg-white p-3">
          <p className="text-sm font-black text-ink">Materialnamen normalisieren</p>
          <p className="mt-1 text-sm text-slate-600">Diktierte Kurzbegriffe gegen typische Katalogartikel prüfen.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              className="field-input"
              value={materialInput}
              onChange={(event) => setMaterialInput(event.target.value)}
              placeholder="z. B. Spenglerschrauben Edelstahl 35er"
            />
            <button type="button" className="btn-secondary" onClick={matchMaterial} disabled={materialPending || !materialInput.trim()}>
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Prüfen
            </button>
          </div>
          {materialResponse ? (
            <div className="mt-3 rounded-md bg-fog p-3 text-sm">
              {!materialResponse.ok ? (
                <p className="font-semibold text-amber-800">{materialResponse.message}</p>
              ) : (
                <>
                  <p className="font-black text-ink">
                    {materialResponse.result?.normalized_name} · {Math.round((materialResponse.result?.confidence ?? 0) * 100)} %
                  </p>
                  <p className="mt-1 text-slate-700">{materialResponse.result?.explanation}</p>
                  {materialResponse.result?.candidates.length ? (
                    <div className="mt-2 space-y-1">
                      {materialResponse.result.candidates.slice(0, 3).map((candidate) => (
                        <p key={`${candidate.catalog_id}-${candidate.name}`} className="rounded-md bg-white px-2 py-1">
                          {candidate.name} ({candidate.unit}) - {candidate.reason}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="surface-strong p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-moss">
              <Bot className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="meta-label">Antwort</p>
              <h2 className="section-title">Entwurf zur Prüfung</h2>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900 sm:flex">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Rollenfilter aktiv
          </div>
        </div>

        {!response ? (
          <div className="rounded-lg border border-dashed border-line bg-fog p-6 text-sm text-slate-600">
            Stelle eine Frage. Die KI nutzt nur rollenbereinigte App-Daten: Mitarbeiter sehen keine Preise, keine Margen und keine
            Preisvergleichsdaten.
          </div>
        ) : null}

        {response && !response.ok ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex gap-2">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="font-semibold">{response.message}</p>
            </div>
          </div>
        ) : null}

        {response?.result ? (
          <div className="space-y-4">
            <div className="rounded-md border border-line bg-white p-4">
              <p className="whitespace-pre-wrap text-sm leading-6 text-ink">{response.result.answer}</p>
            </div>

            {response.result.warnings.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="mb-2 font-black">Hinweise</p>
                <ul className="space-y-1">
                  {response.result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {response.result.needs_confirmation ? (
              <div className="rounded-md border border-line bg-fog p-3 text-sm text-slate-700">
                <p className="font-black text-ink">Vorgeschlagene Aktion</p>
                <p className="mt-1 whitespace-pre-wrap">{response.result.action_draft || "Aktion muss vor dem Speichern bestätigt werden."}</p>
              </div>
            ) : null}

            {response.result.follow_up_questions.length > 0 ? (
              <div className="rounded-md border border-line bg-white p-3 text-sm">
                <p className="mb-2 font-black text-ink">Rueckfragen</p>
                <ul className="space-y-1 text-slate-700">
                  {response.result.follow_up_questions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
