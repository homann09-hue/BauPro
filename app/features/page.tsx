import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPageHeader, MarketingShell, SectionIntro } from "@/components/marketing/marketing-site";
import { CtaSection } from "@/components/public/cta-section";
import { FeatureGrid } from "@/components/public/feature-grid";

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
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
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
    <article className="surface p-5">
      <h2 className="text-3xl font-normal uppercase text-ink [font-family:var(--font-display)]">{title}</h2>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="border border-line bg-mint px-3 py-2 text-sm font-semibold text-ash">
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
