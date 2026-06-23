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
    <div>
      <div className="mb-5 inline-flex items-center gap-2 border border-ocher/40 bg-ocher/10 px-3 py-2 text-sm font-black text-ocher">
        <Sparkles className="h-4 w-4" aria-hidden="true" />
        Demo mit vorbereiteter Dachdeckerfirma
      </div>
      <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-ink">BauPro in 2 Minuten verstehen.</h1>
      <p className="mt-3 text-sm font-semibold leading-7 text-ash">
        Starte als Chef einer realistischen Demo-Firma. Baustellen, Team, Lager, Zeiten, Bautagesberichte,
        Kundenportal und KI-Hilfen sind bereits gefüllt.
      </p>

      <div className="mt-5">
        <MessageBox error={error} success={success} />
      </div>

      <form action="/api/auth/demo/start" method="post" className="mt-5">
        <input type="hidden" name="return_to" value="/demo" />
        <SubmitButton className="min-h-14 w-full justify-center text-base">
          Demo als Chef starten
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </SubmitButton>
      </form>

      <div className="mt-5 grid gap-2">
        {demoValueCards.map((item) => (
          <div key={item} className="flex gap-3 border border-line bg-surface-container p-3 text-sm font-semibold text-ash">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ocher" aria-hidden="true" />
            <span>{item}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 border border-moss/30 bg-moss/10 p-3 text-sm font-semibold text-moss">
        Die Demo enthält ausschließlich Beispieldaten. Keine echten Kunden, keine echten Passwörter, keine produktiven Aufträge.
      </div>

      <div className="mt-5 grid gap-3">
        <p className="section-kicker">Demo-Vorschau</p>
        {previewItems.slice(0, 4).map((item) => (
          <DemoPreviewCard key={item.title} {...item} />
        ))}
      </div>

      <section className="mt-5 border border-line bg-surface-container p-4 shadow-soft">
        <p className="font-black text-ink">So nutzt du die Demo am besten</p>
        <p className="mt-2 text-sm leading-6 text-ash">
          Klicke zuerst auf „Demo als Chef starten“. Danach führt dich die Demo-Tour durch Dashboard,
          Baustelle, Materialbedarf, Zeit/Bericht, Kundenportal und Chef-Auswertung.
        </p>
        <div className="mt-3 grid gap-2">
          {DEMO_USER_SHORTCUTS.map((user) => (
            <div key={user.email} className="grid gap-1 border border-line bg-surface-container-high px-3 py-2 text-xs font-semibold text-ash">
              <span>{user.label}</span>
              <span className="truncate font-mono">{user.email}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-5 flex flex-col gap-2 text-sm font-semibold">
        <Link href="/features" className="btn-secondary">
          Funktionen ansehen
        </Link>
        <Link href="/pricing" className="btn-secondary">
          Tarife ansehen
        </Link>
      </div>
    </div>
  );
}

function DemoPreviewCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="border border-line bg-surface-container p-4 shadow-sm">
      <div className="flex h-11 w-11 items-center justify-center border border-line bg-surface-container-high text-ocher">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-black text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ash">{text}</p>
    </article>
  );
}
