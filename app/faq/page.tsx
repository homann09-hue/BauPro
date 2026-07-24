import type { Metadata } from "next";
import { MarketingShell, SectionIntro } from "@/components/marketing/marketing-site";
import { FaqSection } from "@/components/public/faq-section";
import { hasActiveSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQ zu BauPro | Häufige Fragen",
  description:
    "Antworten auf häufige Fragen zu BauPro: Funktionen, mobile Nutzung, Preise, Rollenrechte, Kundenportal, Datenschutz und KI-Unterstützung."
};

async function hasFaqSession() {
  try {
    return await hasActiveSession();
  } catch {
    return false;
  }
}

export default async function PublicFaqPage() {
  const isLoggedIn = await hasFaqSession();

  return (
    <MarketingShell isLoggedIn={isLoggedIn}>
      <section className="border-b border-line bg-basalt">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionIntro
            kicker="FAQ"
            title="Häufige Fragen zu BauPro"
            description="Kurz beantwortet für Chefs, Vorarbeiter, Mitarbeiter und Kunden: was BauPro kann, was sichtbar ist und wie der Einstieg funktioniert."
          />
        </div>
      </section>
      <FaqSection />
    </MarketingShell>
  );
}
