import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { MarketingPageHeader, MarketingShell, SectionIntro } from "@/components/marketing/marketing-site";
import { CtaSection } from "@/components/public/cta-section";
import { FeatureGrid } from "@/components/public/feature-grid";
import { marketingFeatureDetails } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Funktionen für Dachdecker und Handwerksbetriebe",
  description:
    "BauPro Funktionen im Überblick: Aufträge, Baustellen, Zeiterfassung, Material, Lager, Bautagesberichte, Kundenportal, KI-Unterstützung und Rollenverwaltung."
};

export default function FeaturesPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        kicker="Funktionen"
        title="BauPro deckt die wichtigsten Abläufe im Handwerksbetrieb ab."
        description="Von der ersten Anfrage bis zum Baustellenbericht: BauPro verbindet operative Arbeit auf dem Handy mit Überblick im Büro."
      />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <FeatureGrid />
      </section>

      <section className="border-y border-line bg-basalt">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionIntro
            kicker="Im Detail"
            title="Jede Funktion soll einen echten Arbeitsschritt leichter machen"
            description="BauPro ist nicht als Sammlung bunter Buttons gedacht. Jede Funktion folgt einem typischen Handwerker-Ablauf: planen, mitnehmen, ausführen, dokumentieren, prüfen und Kunden informieren."
          />
          <div className="grid gap-4 lg:grid-cols-2">
            {marketingFeatureDetails.map((feature) => (
              <article key={feature.title} className="bp-motion-card flex min-h-80 flex-col border border-line bg-surface-container p-5 shadow-soft sm:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="section-kicker">{feature.title}</p>
                    <h2 className="mt-3 text-2xl font-black leading-tight text-ink">{feature.lead}</h2>
                  </div>
                  <ArrowRight className="mt-1 h-5 w-5 -rotate-45 text-ocher" aria-hidden="true" />
                </div>
                <p className="text-sm font-semibold leading-7 text-ash">{feature.body}</p>
                <div className="mt-auto flex gap-3 border-t border-line pt-5 text-sm font-black text-ink">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-moss" aria-hidden="true" />
                  <span>{feature.outcome}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionIntro
          kicker="Rollen"
          title="Chef, Vorarbeiter und Mitarbeiter arbeiten nicht mit derselben Ansicht"
          description="Ein häufiger Fehler bei Handwerker-Software: Alle sehen zu viel. BauPro trennt operative Baustellenarbeit von kaufmännischen und administrativen Bereichen."
        />
        <div className="grid gap-5 lg:grid-cols-3">
          <FeatureCluster title="Chef/Admin" items={["Alle Baustellen und Aufträge", "Preise, Kalkulation und Margen", "Team, Rechte und Einstellungen", "Stundenzettel und Exporte"]} />
          <FeatureCluster title="Vorarbeiter" items={["Baustellen des Tages", "Team-Aufgaben", "Berichte prüfen", "Mitbringlisten packen"]} />
          <FeatureCluster title="Mitarbeiter" items={["Eigene Baustellen", "Zeiten erfassen", "Bericht schreiben", "Material fehlt melden"]} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionIntro
          kicker="Einfach starten"
          title="Kein Software-Projekt, sondern ein Arbeitsablauf"
          description="BauPro ist auf schnelle Einführung ausgelegt: Demo-Daten, Startassistent, klare Rollen und mobile Formulare reduzieren die Einstiegshürde."
        />
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/demo" className="btn-primary">
            Demo starten
          </Link>
          <Link href="/pricing" className="btn-secondary">
            Tarife ansehen
          </Link>
        </div>
      </section>

      <CtaSection />
    </MarketingShell>
  );
}

function FeatureCluster({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="border border-line bg-surface-container p-5 shadow-soft">
      <h2 className="text-2xl font-black text-ink">{title}</h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="border border-line bg-surface-container-high px-3 py-2 text-sm font-semibold text-ash">
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
