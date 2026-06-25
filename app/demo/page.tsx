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
import { MarketingShell } from "@/components/marketing/marketing-site";
import { MessageBox } from "@/components/message-box";
import { SubmitButton } from "@/components/submit-button";
import { DEMO_USER_SHORTCUTS } from "@/lib/demo/constants";
import { getOptionalAppContext } from "@/lib/auth";
import { searchParamMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

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

const demoHeroImageUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCE4K46tm04j6MI2aY6nTCFWhN4RsIZZwu4Fyb-4VYfPFY5kXaJF4tVxePN8YM7gyJ8HE8N5i-bXXQKJnbDfb3uJqCb2W5CUGOoF07zl6bMybZcEQAVuq3hVi8TwXtesuPYEG4aZw-Qo8Y8qeCdC1_UyU5aBuhXc11jrllq84QITiz5avXT34KY75ZyD9HIAHXvIf3pNkymQS96zM6ixkqKDRr6z1BNk5nNo5lYRwUMPFeXBxlkp73Sg1gzqpflamRC4j7QbeRYufg";

const demoValueCards = [
  "Papierzettel werden zu digitalen Abläufen.",
  "Chef sieht sofort, was heute fehlt.",
  "Mitarbeiter sehen nur das, was sie brauchen.",
  "Kundenportal zeigt professionell den Baustellenstand."
];

const demoTourSteps = [
  {
    title: "Dashboard öffnen",
    text: "Du siehst aktive Baustellen, Teamstatus, Materialwarnungen, offene Zeiten und schnelle Aktionen."
  },
  {
    title: "Baustelle prüfen",
    text: "Adresse, Aufmaß, Fotos, Berichte, Mitbringliste und nächster Schritt sind an einem Ort verbunden."
  },
  {
    title: "Materialbedarf verstehen",
    text: "Die Demo zeigt Lagerbestand, knappe Materialien und vorbereitete Mitbringlisten ohne echte Preise für Mitarbeiter."
  },
  {
    title: "Zeit und Bericht erfassen",
    text: "Mobile Formulare zeigen, wie Mitarbeiter auf der Baustelle Zeiten, Tätigkeiten, Fotos und Wetter dokumentieren."
  },
  {
    title: "Kundenportal ansehen",
    text: "Freigegebene Fotos, Dokumente und Baustellenstatus wirken professionell, ohne interne Notizen offenzulegen."
  },
  {
    title: "Chef-Auswertung prüfen",
    text: "Freigaben, Berichte, Materialwarnungen und offene Punkte zeigen, wo der Betrieb heute Aufmerksamkeit braucht."
  }
];

async function getDemoLandingContext() {
  try {
    return await getOptionalAppContext();
  } catch {
    return null;
  }
}

export default async function DemoPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getDemoLandingContext();
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <MarketingShell isLoggedIn={Boolean(context)}>
      <section className="relative overflow-hidden border-b border-line bg-coal">
        <div className="absolute inset-0 opacity-55" aria-hidden="true">
          <div className="h-full w-full bg-cover bg-center grayscale-[0.25]" style={{ backgroundImage: `url(${demoHeroImageUrl})` }} />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(19,19,19,0.98)_0%,rgba(19,19,19,0.86)_48%,rgba(19,19,19,0.55)_100%)]" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.65fr)] lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 border border-ocher/40 bg-ocher/10 px-3 py-2 text-sm font-black text-ocher">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              Demo mit vorbereiteter Dachdeckerfirma
            </div>
            <h1 className="text-5xl font-extrabold leading-[0.98] tracking-tight text-white sm:text-7xl">
              BauPro in <span className="text-ocher">2 Minuten</span> verstehen.
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-8 text-white/75">
              Starte direkt als Chef einer realistischen Demo-Firma. Dashboard, Baustellen, Team, Lager, Zeiten,
              Bautagesberichte, Kundenportal und KI-Hilfen sind bereits gefüllt.
            </p>

            <div className="mt-6">
              <MessageBox error={error} success={success} />
            </div>

            <form action="/api/auth/demo/start" method="post" className="mt-6">
              <input type="hidden" name="return_to" value="/demo" />
              <SubmitButton className="min-h-14 w-full justify-center bg-ocher text-base text-coal hover:bg-signal sm:w-auto">
                Demo als Chef starten
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </SubmitButton>
            </form>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {demoValueCards.map((item) => (
                <div key={item} className="flex gap-3 border border-white/10 bg-white/[0.06] p-3 text-sm font-semibold text-white/74">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ocher" aria-hidden="true" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="border border-line bg-surface/95 p-4 shadow-lift backdrop-blur-md sm:p-5">
            <p className="section-kicker">Was du sofort siehst</p>
            <div className="mt-4 grid gap-3">
              {previewItems.map((item) => (
                <DemoPreviewCard key={item.title} {...item} />
              ))}
            </div>
            <div className="mt-4 border border-moss/30 bg-moss/10 p-3 text-sm font-semibold text-moss">
              Die Demo enthält ausschließlich Beispieldaten. Keine echten Kunden, keine echten Passwörter, keine produktiven Aufträge.
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div>
          <p className="section-kicker">Demo-Login</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight text-ink">Direkt ins Dashboard, keine alte Zwischenseite.</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-ash">
            Nach dem Start landest du im echten Chef-Dashboard der Demo-Firma. Von dort kannst du Aufträge,
            Materialwarnungen, Zeiten, Berichte und Kundenportal prüfen.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/features" className="btn-secondary">
              Funktionen ansehen
            </Link>
            <Link href="/pricing" className="btn-secondary">
              Tarife ansehen
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {DEMO_USER_SHORTCUTS.map((user) => (
            <div key={user.email} className="border border-line bg-surface-container p-4 shadow-sm">
              <p className="font-black text-ink">{user.label}</p>
              <p className="mt-2 truncate font-mono text-xs font-semibold text-ash">{user.email}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-basalt">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-8 max-w-3xl">
            <p className="section-kicker">2-Minuten-Tour</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              Die Demo zeigt den Nutzen ohne eigene Daten einzugeben.
            </h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-ash sm:text-base">
              Der Ablauf ist bewusst kurz: Erst Überblick, dann Baustelle, dann Material, Zeit, Bericht und Kundenansicht.
              So erkennt ein Betrieb schnell, ob BauPro Papier, Nachtelefonieren und Sucharbeit reduziert.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {demoTourSteps.map((step, index) => (
              <article key={step.title} className="bp-motion-card border border-line bg-surface-container p-5 shadow-soft">
                <p className="text-4xl font-black leading-none text-ocher">{String(index + 1).padStart(2, "0")}</p>
                <h3 className="mt-4 text-xl font-black text-ink">{step.title}</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-ash">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function DemoPreviewCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="flex gap-3 border border-line bg-surface-container p-3 shadow-sm">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-line bg-surface-container-high text-ocher">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-black text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-6 text-ash">{text}</p>
      </div>
    </article>
  );
}
