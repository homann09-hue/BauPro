"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie, ShieldCheck, X } from "lucide-react";
import { buildConsentState, CONSENT_STORAGE_KEY, parseConsentState, type ConsentState } from "@/lib/compliance/consent";

export function ConsentBanner() {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedConsent = parseConsentState(window.localStorage.getItem(CONSENT_STORAGE_KEY));
      if (storedConsent) setConsent(storedConsent);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  function save(next: ConsentState) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    setConsent(next);
  }

  if (consent) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-3xl rounded-lg border border-line bg-white p-4 shadow-lift">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mint text-moss">
          <Cookie className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-ink">Datenschutz-Einstellungen</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            BauPro nutzt notwendige Cookies fuer Login und Sicherheit. Analyse oder Marketing bleiben optional und werden erst nach deiner
            Zustimmung vorbereitet.
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="h-4 w-4 rounded border-line text-moss"
              />
              Analyse optional
            </label>
            <label className="flex items-center gap-3 rounded-md border border-line bg-fog px-3 py-2 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="h-4 w-4 rounded border-line text-moss"
              />
              Marketing optional
            </label>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/legal/datenschutz" className="inline-flex items-center gap-2 text-sm font-bold text-moss">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Datenschutzhinweise ansehen
            </Link>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="button" className="btn-secondary" onClick={() => save(buildConsentState({ analytics: false, marketing: false }))}>
                Nur notwendig
              </button>
              <button type="button" className="btn-primary" onClick={() => save(buildConsentState({ analytics, marketing }))}>
                Auswahl speichern
              </button>
            </div>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md hover:bg-fog"
          aria-label="Schliessen"
          onClick={() => save(buildConsentState({ analytics: false, marketing: false }))}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
