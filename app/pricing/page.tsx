import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Info } from "lucide-react";
import { MarketingPageHeader, MarketingShell, PricingCards, SectionIntro } from "@/components/marketing/marketing-site";
import { CtaSection } from "@/components/public/cta-section";
import { marketingPricingComparison } from "@/lib/marketing";

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
            Die angezeigten Tarife sind Beispieltarife für die Produkt- und Vertriebsstruktur. Vor produktiver Abrechnung
            müssen Stripe, Rechnungsstellung, Vertragsunterlagen und Leistungsumfang final konfiguriert werden.
          </p>
        </div>
        <PricingCards />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <SectionIntro
          kicker="Vergleich"
          title="Welcher Tarif passt zu welchem Betrieb?"
          description="Die Tarife sind bewusst einfach gehalten: kleiner Betrieb, wachsendes Team oder größerer Betrieb mit mehr Automatisierung."
        />
        <div className="overflow-hidden border border-line bg-surface-container shadow-lift">
          <div className="hidden grid-cols-4 border-b border-line bg-surface-container-high text-sm font-black text-ink md:grid">
            <div className="p-4">Bereich</div>
            <div className="p-4">Starter</div>
            <div className="p-4">Professional</div>
            <div className="p-4">Business</div>
          </div>
          <div className="divide-y divide-line">
            {marketingPricingComparison.map((row) => (
              <div key={row.label} className="grid gap-3 p-4 text-sm md:grid-cols-4 md:gap-0">
                <p className="font-black text-ink">{row.label}</p>
                <PlanValue label="Starter" value={row.starter} />
                <PlanValue label="Professional" value={row.professional} strong />
                <PlanValue label="Business" value={row.business} />
              </div>
            ))}
          </div>
        </div>
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
              <div key={item} className="border border-line bg-surface-container flex gap-3 p-4 text-sm font-semibold leading-6 text-ash">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ocher" aria-hidden="true" />
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

function PlanValue({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 border border-line bg-surface-container-high px-3 py-2 md:min-h-0 md:border-0 md:bg-transparent md:p-0">
      <span className="text-xs font-black uppercase tracking-[0.12em] text-ash md:hidden">{label}</span>
      <span className={strong ? "font-black text-ocher" : "font-semibold text-ash"}>{value}</span>
    </div>
  );
}
