"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import {
  buildConsentState,
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  parseConsentState,
  type ConsentState
} from "@/lib/compliance/consent";

export function ConsentSettingsCard() {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedConsent = parseConsentState(window.localStorage.getItem(CONSENT_STORAGE_KEY));
      if (!storedConsent) return;

      setConsent(storedConsent);
      setAnalytics(storedConsent.analytics);
      setMarketing(storedConsent.marketing);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function save(next: ConsentState) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    setConsent(next);
    setAnalytics(next.analytics);
    setMarketing(next.marketing);
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }

  return (
    <section className="surface p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-mint text-moss">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="section-title">Datenschutzeinstellungen</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Notwendige Cookies für Login und Sicherheit sind immer aktiv. Analyse und Marketing bleiben freiwillig und können hier
            jederzeit geändert werden.
          </p>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-14 items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="h-5 w-5 rounded border-line text-primary"
              />
              Analyse optional
            </label>
            <label className="flex min-h-14 items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="h-5 w-5 rounded border-line text-primary"
              />
              Marketing optional
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" className="btn-secondary" onClick={() => save(buildConsentState({ analytics: false, marketing: false }))}>
              Nur notwendig speichern
            </button>
            <button type="button" className="btn-primary" onClick={() => save(buildConsentState({ analytics, marketing }))}>
              Auswahl speichern
            </button>
          </div>

          <p className="mt-3 text-xs font-semibold text-slate-500">
            {consent ? `Aktuelle Auswahl gespeichert am ${new Date(consent.decidedAt).toLocaleString("de-DE")}.` : "Noch keine Auswahl gespeichert."}
          </p>
        </div>
      </div>
    </section>
  );
}
