import Link from "next/link";
import { Building2, Clock3, Coins, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { whyBauProSalesHighlights } from "@/lib/why-baupro";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh bg-fog px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl">
            <div className="mb-7 inline-flex items-center gap-3 rounded-lg bg-anthracite p-3 text-white shadow-lift">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary">
                <Building2 className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-black">BauPro</p>
                <p className="text-sm text-white/70">Betriebszentrale für Dachdecker</p>
              </div>
            </div>
            <h1 className="text-4xl font-black tracking-normal text-ink">
              Baustellen, Berichte und Material an einem Ort.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Ein ruhiges, schnelles Werkzeug für kleine Handwerksbetriebe: mobil auf der Baustelle und klar im Büro.
            </p>
            <div className="mt-8 grid gap-3">
              {whyBauProSalesHighlights.map((highlight, index) => (
                <AuthFeature key={highlight.label} icon={salesIcons[index] ?? Sparkles} title={highlight.label} text={highlight.value} />
              ))}
            </div>
            <div className="mt-5 rounded-lg border border-primary/15 bg-mint p-4">
              <p className="text-sm font-black text-primary-dark">Demo-Gespraech</p>
              <p className="mt-1 text-sm leading-6 text-primary-dark/80">
                Zeige erst Dashboard, Materialwarnungen, Tagesstunden und Mitbringlisten. Danach oeffne einen Auftrag mit Maßen und
                erklaere, wo Zeit, Geld, Fehler und Automatisierung zusammenkommen.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-anthracite text-white">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <p className="text-2xl font-black text-ink">BauPro</p>
              <p className="text-sm text-slate-500">Handwerker-App für Dachdecker</p>
            </div>
          </div>
          {children}
          <div className="mt-5 rounded-lg border border-line bg-white p-4 shadow-sm lg:hidden">
            <h2 className="text-lg font-black text-ink">Warum BauPro?</h2>
            <div className="grid gap-2">
              {whyBauProSalesHighlights.slice(0, 3).map((highlight) => (
                <div key={highlight.label} className="rounded-md bg-fog p-3">
                  <p className="text-sm font-black text-ink">{highlight.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{highlight.value}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-md bg-mint px-3 py-2 text-xs font-bold leading-5 text-primary-dark">
              Demo-Tipp: Dashboard zeigen, dann Auftrag mit Maßen, Mitbringliste und Tagesstunden öffnen.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap justify-center gap-3 text-xs font-semibold text-slate-500">
            <Link href="/legal/impressum" className="hover:text-primary">
              Impressum
            </Link>
            <Link href="/legal/datenschutz" className="hover:text-primary">
              Datenschutz
            </Link>
            <Link href="/legal/agb" className="hover:text-primary">
              AGB
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

const salesIcons: LucideIcon[] = [Clock3, Coins, ShieldCheck, Sparkles];

function AuthFeature({
  icon: Icon,
  title,
  text
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-white/70 bg-white/75 p-4 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-bold text-ink">{title}</p>
        <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
      </div>
    </div>
  );
}
