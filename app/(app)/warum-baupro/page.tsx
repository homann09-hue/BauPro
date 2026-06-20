import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  Coins,
  FileCheck2,
  PackageCheck,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
  WandSparkles
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { bauProValueDrivers, valueDriverCountByCategory, whyBauProDemoFlow, whyBauProSalesHighlights } from "@/lib/why-baupro";

const categoryIcons = {
  Zeiterfassung: Clock3,
  Dokumentation: FileCheck2,
  "Auftrag und Kalkulation": WandSparkles,
  Baustellenlogistik: PackageCheck,
  Lager: PackageCheck,
  Bürosteuerung: CheckCircle2,
  Sicherheit: ShieldCheck,
  "Mobile Arbeit": Bot,
  Kundenkommunikation: Sparkles,
  Planung: TriangleAlert
} as const;

export default function WhyBauProPage() {
  const categories = valueDriverCountByCategory();

  return (
    <>
      <PageHeader
        title="Warum BauPro?"
        description="Die wichtigsten Wechselgruende für Dachdecker- und Handwerksbetriebe: Zeit sparen, Kosten senken, Fehler vermeiden und Abläufe automatisieren."
      />

      <section className="overflow-hidden rounded-lg border border-slate-800 bg-anthracite text-white shadow-lift">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-5 sm:p-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs font-black text-white ring-1 ring-white/10">
              <Sparkles className="h-4 w-4 text-warning" aria-hidden="true" />
              Vertriebsargumente für echte Betriebe
            </div>
            <h1 className="max-w-3xl text-3xl font-black tracking-normal text-white sm:text-4xl">
              BauPro ersetzt Zettel, Chat-Chaos und doppelte Tabellen durch einen mobilen Betriebsablauf.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/70 sm:text-base">
              Der Wechsel lohnt sich, wenn ein Betrieb Stunden, Berichte, Material, Baustellen und Kundennachweise heute in
              mehreren Systemen pflegt oder wichtige Informationen erst zu spät im Büro ankommen.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href="/dashboard" className="btn-primary bg-primary text-white hover:bg-primary-dark">
                Demo am Dashboard zeigen
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href="/orders/new" className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15">
                Auftrag mit Maßen vorfuehren
              </Link>
            </div>
          </div>
          <aside className="border-t border-white/10 bg-slate-900 p-5 sm:p-7 lg:border-l lg:border-t-0">
            <p className="text-sm font-semibold text-white/70">Kernnutzen</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {whyBauProSalesHighlights.map((highlight) => (
                <div key={highlight.label} className="rounded-md bg-white/10 p-3 ring-1 ring-white/10">
                  <p className="text-sm font-black text-white">{highlight.label}</p>
                  <p className="mt-1 text-xs leading-5 text-white/65">{highlight.value}</p>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <BenefitMetric icon={Clock3} title="Zeitersparnis" text="Weniger Suchen, Nachfragen und Nachtragen." />
        <BenefitMetric icon={Coins} title="Geldersparnis" text="Weniger Fehlfahrten, Expresskaeufe und unbezahlte Nacharbeit." />
        <BenefitMetric icon={ShieldCheck} title="Fehlervermeidung" text="Pflichtfelder, Rollenrechte, RLS und klare Status." />
        <BenefitMetric icon={WandSparkles} title="Automatisierung" text="Berechnung, Warnungen, Exporte, Wetter und KI-Vorschläge." />
      </section>

      <section className="mt-6 dashboard-band">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-kicker">Wechselgruende</p>
            <h2 className="section-title">Kernfunktionen mit konkretem Nutzen</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {bauProValueDrivers.length} Funktionen · {Object.keys(categories).length} Nutzenbereiche
          </p>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {bauProValueDrivers.map((driver) => {
            const Icon = categoryIcons[driver.category as keyof typeof categoryIcons] ?? CheckCircle2;

            return (
              <article key={driver.id} className="interactive-surface overflow-hidden p-0">
                <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-mint text-moss">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="meta-label">{driver.category}</p>
                      <h3 className="mt-1 text-lg font-black text-ink">{driver.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{driver.switchReason}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <ValueBox label="Zeitersparnis" text={driver.timeSaving} />
                    <ValueBox label="Geldersparnis" text={driver.moneySaving} />
                    <ValueBox label="Fehlervermeidung" text={driver.errorPrevention} />
                    <ValueBox label="Automatisierung" text={driver.automation} />
                  </div>

                  <p className="mt-3 rounded-md border border-primary/15 bg-mint px-3 py-2 text-sm font-semibold text-primary-dark">
                    Demo: {driver.demoProof}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="surface p-4 sm:p-5">
          <p className="section-kicker">Demo-Version</p>
          <h2 className="section-title">So zeigst du BauPro im Verkaufsgespraech</h2>
          <ol className="mt-4 space-y-3">
            {whyBauProDemoFlow.map((step, index) => (
              <li key={step} className="flex gap-3 rounded-md border border-line bg-white p-3 text-sm font-semibold text-slate-700">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-black text-white">
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="surface-strong p-4 sm:p-5">
          <p className="section-kicker">Vertriebsbotschaft</p>
          <h2 className="section-title">Was Betriebe sofort verstehen</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <SalesMessage title="Für den Chef" text="Mehr Überblick über Baustellen, Zeiten, Material, Kosten und offene Risiken." />
            <SalesMessage title="Für Mitarbeiter" text="Weniger Tippen, klare Tagesaufgaben, Mitbringliste und schnelle Materialmeldung." />
            <SalesMessage title="Für das Büro" text="Weniger Nachtragen, weniger Sucherei, bessere PDFs und strukturierte Kundendaten." />
            <SalesMessage title="Für Kunden" text="Sauber freigegebene Fotos, Status und Arbeitsaufträge ohne interne Preis- oder Lagerdaten." />
          </div>
        </div>
      </section>
    </>
  );
}

function BenefitMetric({ icon: Icon, title, text }: { icon: typeof Clock3; title: string; text: string }) {
  return (
    <div className="surface p-4">
      <Icon className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
      <p className="font-black text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}

function ValueBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-md border border-line bg-fog p-3">
      <p className="meta-label">{label}</p>
      <p className="mt-1 text-sm leading-6 text-slate-700">{text}</p>
    </div>
  );
}

function SalesMessage({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-md border border-line bg-white p-4">
      <p className="font-black text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-slate-600">{text}</p>
    </div>
  );
}
