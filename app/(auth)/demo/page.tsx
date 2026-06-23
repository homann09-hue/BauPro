import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  HardHat,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon
} from "lucide-react";
import { MessageBox } from "@/components/message-box";
import { SubmitButton } from "@/components/submit-button";
import { DEMO_USER_SHORTCUTS } from "@/lib/demo/constants";
import { searchParamMessage } from "@/lib/utils";

export const metadata: Metadata = {
  title: "BauPro Demo für Dachdecker testen",
  description:
    "Starte BauPro mit einer vorbereiteten Demo-Firma: Baustellen, Team, Lager, Zeiten, Bautagesberichte, Kundenportal und KI-Funktionen."
};

const previewItems = [
  {
    icon: HardHat,
    title: "Baustellen",
    text: "Aktive Aufträge mit Adresse, Aufmaß, Status und nächstem Schritt."
  },
  {
    icon: Users,
    title: "Team",
    text: "Chef, Vorarbeiter und Mitarbeiter mit rollenbasierter Sicht."
  },
  {
    icon: PackageCheck,
    title: "Material & Lager",
    text: "Mindestbestände, Mitbringlisten und klare Materialwarnungen."
  },
  {
    icon: Clock3,
    title: "Zeiten",
    text: "Eingereichte Tagesstunden, Pausen und Freigaben auf einen Blick."
  },
  {
    icon: FileText,
    title: "Bautagesberichte",
    text: "Wetter, Tätigkeiten, Materialverbrauch und Nachweise vorbereitet."
  },
  {
    icon: ShieldCheck,
    title: "Kundenportal",
    text: "Kunden sehen nur freigegebene Fotos, Dokumente und Arbeitsaufträge."
  },
  {
    icon: Bot,
    title: "KI-Funktionen",
    text: "Sprache, Materialvorschläge und Berichtsentwürfe als optionale Hilfe."
  }
];

const demoValueCards = [
  "Papierzettel werden zu digitalen Abläufen.",
  "Chef sieht sofort, was heute fehlt.",
  "Mitarbeiter sehen nur das, was sie brauchen.",
  "Kundenportal zeigt professionell den Baustellenstand."
];

export default async function DemoPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <main className="min-h-screen bg-fog text-ink">
      <section className="border-b border-slate-800 bg-anthracite text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-12">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-sm font-black ring-1 ring-white/10">
              <Sparkles className="h-4 w-4 text-mint" aria-hidden="true" />
              Demo mit vorbereiteter Dachdeckerfirma
            </div>
            <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
              In zwei Minuten sehen, wie BauPro Papier, Zeit und Chaos spart.
            </h1>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-7 text-white/75">
              Starte als Chef einer realistischen Demo-Firma. Baustellen, Team, Lager, Zeiten, Bautagesberichte,
              Kundenportal und KI-Hilfen sind bereits gefüllt, damit du sofort den Ablauf verstehst.
            </p>

            <div className="mt-6">
              <MessageBox error={error} success={success} />
            </div>

            <form action="/api/auth/demo/start" method="post" className="mt-6">
              <input type="hidden" name="return_to" value="/demo" />
              <SubmitButton className="min-h-14 w-full justify-center text-base sm:w-auto">
                Demo als Chef starten
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </SubmitButton>
            </form>

            <div className="mt-5 flex flex-wrap gap-3 text-sm font-semibold text-white/75">
              <Link href="/features" className="rounded-md bg-white/10 px-3 py-2 ring-1 ring-white/10">
                Funktionen ansehen
              </Link>
              <Link href="/login" className="rounded-md bg-white/10 px-3 py-2 ring-1 ring-white/10">
                Einloggen
              </Link>
              <Link href="/register" className="rounded-md bg-white/10 px-3 py-2 ring-1 ring-white/10">
                Eigene Firma anlegen
              </Link>
            </div>
          </div>

          <aside className="rounded-lg border border-white/10 bg-white/10 p-4 shadow-lift sm:p-5">
            <p className="text-sm font-black uppercase tracking-normal text-mint">Was du in der Demo siehst</p>
            <div className="mt-4 grid gap-3">
              {demoValueCards.map((item) => (
                <div key={item} className="flex gap-3 rounded-md bg-white/10 p-3 text-sm font-semibold text-white/85 ring-1 ring-white/10">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-md border border-mint/30 bg-mint/10 p-3 text-sm font-semibold text-mint">
              Hinweis: Die Demo enthält ausschließlich Beispieldaten. Keine echten Kunden, keine echten Passwörter, keine produktiven Aufträge.
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Demo-Vorschau</p>
            <h2 className="section-title mt-2 text-2xl sm:text-3xl">Ein kompletter Dachdecker-Alltag, vorbereitet.</h2>
          </div>
          <Link href="/pricing" className="btn-secondary w-full sm:w-auto">
            Tarife ansehen
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {previewItems.map((item) => (
            <DemoPreviewCard key={item.title} {...item} />
          ))}
        </div>

        <section className="mt-6 rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr] lg:items-center">
            <div>
              <p className="font-black text-ink">So nutzt du die Demo am besten</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Klicke zuerst auf „Demo als Chef starten“. Danach führt dich die Demo-Tour durch Dashboard,
                Baustelle, Materialbedarf, Zeit/Bericht, Kundenportal und Chef-Auswertung.
              </p>
            </div>
            <div className="grid gap-2">
              {DEMO_USER_SHORTCUTS.map((user) => (
                <div key={user.email} className="flex items-center justify-between gap-3 rounded-md border border-line bg-fog px-3 py-2 text-xs font-semibold text-slate-600">
                  <span>{user.label}</span>
                  <span className="truncate font-mono">{user.email}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}

function DemoPreviewCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="rounded-lg border border-line bg-white p-4 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center rounded-md bg-mint text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-black text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
    </article>
  );
}
