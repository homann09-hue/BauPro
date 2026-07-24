"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Cookie, ShieldCheck, X } from "lucide-react";
import {
  buildConsentState,
  CONSENT_CHANGED_EVENT,
  CONSENT_STORAGE_KEY,
  parseConsentState,
  type ConsentState
} from "@/lib/compliance/consent";

export function ConsentBanner() {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    function syncConsent() {
      const storedConsent = parseConsentState(window.localStorage.getItem(CONSENT_STORAGE_KEY));
      if (storedConsent) setConsent(storedConsent);
    }

    const timer = window.setTimeout(syncConsent, 0);
    window.addEventListener(CONSENT_CHANGED_EVENT, syncConsent);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(CONSENT_CHANGED_EVENT, syncConsent);
    };
  }, []);

  function save(next: ConsentState) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(next));
    setConsent(next);
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
  }

  if (consent) return null;

  return (
    <div className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-[70] mx-auto max-h-[34dvh] max-w-4xl overflow-y-auto border border-line bg-surface-container p-3 shadow-lift backdrop-blur-md sm:max-h-none sm:p-4">
      <div className="grid gap-2.5 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <div className="flex items-start gap-2.5 pr-8 sm:pr-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-moss/30 bg-moss/10 text-moss">
              <Cookie className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-base font-black leading-tight text-ink">Datenschutz kurz bestätigen</p>
              <p className="mt-1 line-clamp-1 text-xs font-semibold leading-5 text-ash sm:line-clamp-none sm:text-sm sm:leading-6">
                Notwendige Cookies sichern Login und Betrieb. Analyse und Marketing bleiben optional.
              </p>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="flex min-h-10 items-center gap-2 border border-line bg-coal/35 px-2 py-2 text-xs font-bold text-ink sm:px-3 sm:text-sm">
              <input
                type="checkbox"
                checked={analytics}
                onChange={(event) => setAnalytics(event.target.checked)}
                className="h-4 w-4 border-line text-primary"
              />
              Analyse optional
            </label>
            <label className="flex min-h-10 items-center gap-2 border border-line bg-coal/35 px-2 py-2 text-xs font-bold text-ink sm:px-3 sm:text-sm">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(event) => setMarketing(event.target.checked)}
                className="h-4 w-4 border-line text-primary"
              />
              Marketing optional
            </label>
          </div>
        </div>

        <div className="grid gap-2 sm:min-w-72">
          <Link href="/legal/datenschutz" className="inline-flex min-h-8 items-center gap-2 text-xs font-black text-moss sm:min-h-10 sm:text-sm">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Datenschutzhinweise ansehen
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center border border-line bg-coal/55 px-2 text-xs font-black text-ink transition hover:border-ocher/45 sm:px-3 sm:text-sm"
              onClick={() => save(buildConsentState({ analytics: false, marketing: false }))}
            >
              Nur notwendig
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center justify-center bg-primary px-2 text-xs font-black text-white transition hover:bg-primary-dark sm:px-3 sm:text-sm"
              onClick={() => save(buildConsentState({ analytics, marketing }))}
            >
              Auswahl speichern
            </button>
          </div>
        </div>
        <button
          type="button"
          className="absolute right-2 top-2 inline-flex h-9 w-9 shrink-0 items-center justify-center text-ash transition hover:bg-coal/35 hover:text-ink"
          aria-label="Schliessen"
          onClick={() => save(buildConsentState({ analytics: false, marketing: false }))}
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
