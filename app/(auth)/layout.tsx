import Link from "next/link";
import { Building2, ClipboardCheck, CloudSun, ShieldCheck } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-fog px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-7 inline-flex items-center gap-3 rounded-lg bg-ink p-3 text-white shadow-lift">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/10">
                <Building2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-black">BauPro</p>
                <p className="text-sm text-white/70">Betriebszentrale fuer Dachdecker</p>
              </div>
            </div>
            <h1 className="text-4xl font-black tracking-normal text-ink">
              Baustellen, Berichte und Material an einem Ort.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Ein ruhiges, schnelles Werkzeug fuer kleine Handwerksbetriebe: mobil auf der Baustelle und klar im Büro.
            </p>
            <div className="mt-8 grid gap-3">
              <AuthFeature icon={ClipboardCheck} title="Tagesberichte" text="Zeiten, Tätigkeiten und Fotos direkt dokumentieren." />
              <AuthFeature icon={CloudSun} title="Baustellenfokus" text="Status, Team und Aufgaben bleiben sichtbar." />
              <AuthFeature icon={ShieldCheck} title="Rollen sauber getrennt" text="Admin, Chef, Vorarbeiter und Mitarbeiter mit klaren Rechten." />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-ink text-white">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-ink">BauPro</p>
              <p className="text-sm text-slate-500">Handwerker-App fuer Dachdecker</p>
            </div>
          </div>
          {children}
          <div className="mt-5 flex flex-wrap justify-center gap-3 text-xs font-semibold text-slate-500">
            <Link href="/legal/impressum" className="hover:text-moss">
              Impressum
            </Link>
            <Link href="/legal/datenschutz" className="hover:text-moss">
              Datenschutz
            </Link>
            <Link href="/legal/agb" className="hover:text-moss">
              AGB
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthFeature({
  icon: Icon,
  title,
  text
}: {
  icon: typeof ClipboardCheck;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-mint text-moss">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-bold text-ink">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}
