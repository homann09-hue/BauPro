import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Info } from "lucide-react";
import { MarketingPageHeader, MarketingShell, PricingCards, SectionIntro } from "@/components/marketing/marketing-site";
import { CtaSection } from "@/components/public/cta-section";

export const metadata: Metadata = {
  title: "Preise und Tarife",
  description:
    "BauPro Preis- und Tarifseite: geplante SaaS-Pakete für Starter, Professional und Business mit Fokus auf Dachdecker- und Handwerksbetriebe."
};

export default function PricingPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        kicker="Preise"
        title="Klare Tarife für kleine und wachsende Handwerksbetriebe."
        description="BauPro ist auf SaaS-Tarife für Handwerksbetriebe ausgelegt. Die Demo zeigt den Produktnutzen ohne Vertragsdruck und ohne echte Betriebsdaten."
      />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start gap-3 border border-primary/30 bg-primary/10 p-4 text-sm font-semibold leading-6 text-ash">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Die angezeigten Tarife dienen als transparente Produktstruktur für Pilot- und Verkaufsdemos. Abrechnung und Stripe-Aboverwaltung
            bleiben sauber getrennt im geschützten App-Bereich.
          </p>
        </div>
        <PricingCards />
      </section>

      <section className="border-y border-line bg-basalt">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionIntro
            kicker="Was zählt?"
            title="Der Tarif soll zum Betriebsalltag passen"
            description="Nicht jeder Betrieb braucht sofort KI, Kundenportal oder umfangreiche Rechteverwaltung. Deshalb sind die Pakete als klare Stufen gedacht."
          />
          <div className="grid gap-3 md:grid-cols-3">
            {["Faire Einstiegshürde für kleine Betriebe", "Team- und Lagerfunktionen für wachsende Betriebe", "Erweiterte Automatisierung für größere Abläufe"].map((item) => (
              <div key={item} className="surface flex gap-3 p-4 text-sm font-semibold leading-6 text-ash">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {item}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className="btn-primary">
              Demo starten
            </Link>
            <Link href="/features" className="btn-secondary">
              Funktionen vergleichen
            </Link>
          </div>
        </div>
      </section>

      <CtaSection />
    </MarketingShell>
  );
}
