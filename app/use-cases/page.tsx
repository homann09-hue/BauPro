import type { Metadata } from "next";
import { MarketingPageHeader, MarketingShell, SectionIntro, UseCaseGrid } from "@/components/marketing/marketing-site";
import { CtaSection } from "@/components/public/cta-section";

export const metadata: Metadata = {
  title: "Anwendungsfälle für Dachdecker, Zimmereien und Handwerk",
  description:
    "Typische BauPro Anwendungsfälle: Dachdeckerbetrieb, Zimmerei, Klempner/Spengler und kleine bis mittlere Handwerksbetriebe mit mobilen Baustellenprozessen."
};

export default function UseCasesPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        kicker="Anwendungsfälle"
        title="Für Betriebe, die draußen arbeiten und drinnen Überblick brauchen."
        description="BauPro ist zuerst für Dachdecker gedacht, passt aber auch zu vielen Betrieben mit Baustellen, Teams, Material, Fahrzeugen und Nachweispflichten."
      />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <UseCaseGrid />
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionIntro
            kicker="Typische Situationen"
            title="Wo BauPro im Alltag hilft"
            description="BauPro wird interessant, wenn Informationen heute über Zettel, WhatsApp, Fotos auf privaten Handys oder Excel-Listen verteilt sind."
          />
          <div className="grid gap-3 md:grid-cols-3">
            {["Morgens ist unklar, was mitgenommen werden muss.", "Fotos liegen irgendwo im Chat und fehlen beim Nachweis.", "Zeiten werden am Freitag aus dem Gedächtnis nachgetragen."].map((text) => (
              <div key={text} className="surface p-4 text-sm font-semibold leading-6 text-ash">
                {text}
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaSection />
    </MarketingShell>
  );
}
