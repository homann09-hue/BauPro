"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body>
        <main className="min-h-screen bg-fog px-4 py-10 text-ink">
          <section className="mx-auto max-w-xl rounded-lg border border-line bg-white p-6 shadow-soft">
            <p className="section-kicker">Fehler</p>
            <h1 className="mt-2 text-2xl font-black">Da ist etwas schiefgelaufen.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Der Fehler wurde automatisch protokolliert. Du kannst die Seite neu laden und weiterarbeiten.
            </p>
            <button className="btn-primary mt-5" type="button" onClick={reset}>
              Erneut versuchen
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
