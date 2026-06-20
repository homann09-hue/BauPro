import Link from "next/link";
import { HardHat, RefreshCw, WifiOff } from "lucide-react";

export const metadata = {
  title: "Offline"
};

export const dynamic = "force-static";

export default function OfflinePage() {
  return (
    <main className="min-h-dvh bg-fog px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))] sm:px-6">
      <section className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-lg flex-col justify-center">
        <div className="surface-strong construction-rail p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-anthracite text-white">
              <HardHat className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-2xl font-black text-ink">BauPro</p>
              <p className="text-sm font-semibold text-slate-500">Offline-Modus</p>
            </div>
          </div>

          <div className="rounded-lg border border-warning/30 bg-amber-50 p-4">
            <WifiOff className="mb-3 h-7 w-7 text-amber-700" aria-hidden="true" />
            <h1 className="text-2xl font-black text-ink">Gerade keine Verbindung</h1>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              BauPro ist installiert und bereit. Für aktuelle Baustellen, Berichte, Zeiten und Supabase-Daten brauchst du wieder
              Empfang. Bereits geöffnete statische App-Teile können weiter angezeigt werden.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            <Link href="/dashboard" className="btn-primary min-h-14">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Erneut versuchen
            </Link>
            <p className="rounded-md bg-mint p-3 text-sm font-semibold leading-6 text-primary-dark">
              Tipp: Wenn du offline ein Formular ausfüllst, zeigt BauPro oben einen Hinweis und sendet vorbereitete Offline-Aktionen,
              sobald wieder Empfang da ist.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
