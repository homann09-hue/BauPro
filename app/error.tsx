"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-fog px-4 py-10 text-ink">
      <section className="mx-auto max-w-2xl rounded-md border border-red-200 bg-white p-6 shadow-soft">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Fehler</p>
            <h1 className="mt-1 text-2xl font-black">Diese Seite konnte nicht geladen werden.</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Bitte versuche es erneut. Wenn der Fehler bleibt, prüfe auf <code>/debug/system</code> die Supabase-Verbindung
              und fehlende Migrationen.
            </p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button className="btn-primary" onClick={reset} type="button">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Erneut laden
          </button>
          <a className="btn-secondary" href="/login">
            Zum Login
          </a>
        </div>
        {error.digest ? <p className="mt-4 text-xs font-semibold text-slate-400">Fehler-ID: {error.digest}</p> : null}
      </section>
    </main>
  );
}
