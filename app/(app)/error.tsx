"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function AppError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="surface-strong construction-rail p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-700">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="meta-label">Fehler</p>
            <h1 className="mt-1 text-2xl font-black text-ink">Daten konnten nicht geladen werden.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Die App hat beim Laden dieser Ansicht einen Fehler bekommen. Lade die Seite erneut oder prüfe unter
              <code className="mx-1 rounded bg-slate-100 px-1 py-0.5">/debug/system</code>
              Supabase, Migrationen und Tabellenstatus.
            </p>
          </div>
        </div>
        <button className="btn-primary shrink-0" onClick={reset} type="button">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Erneut laden
        </button>
      </div>
      {error.digest ? <p className="mt-4 text-xs font-semibold text-slate-400">Fehler-ID: {error.digest}</p> : null}
    </section>
  );
}
