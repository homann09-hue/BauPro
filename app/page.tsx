import type { Metadata } from "next";
import Link from "next/link";
import { Bot, Building2, ShieldCheck, type LucideIcon } from "lucide-react";
import {
  BenefitSection,
  MarketingShell,
  PricingTeaserSection,
  ProblemSolutionSection,
  RoofStorySection,
  SectionIntro,
  WhyBauProSection
} from "@/components/marketing/marketing-site";
import { CtaSection } from "@/components/public/cta-section";
import { FaqSection } from "@/components/public/faq-section";
import { FeatureGrid } from "@/components/public/feature-grid";
import { HeroSection } from "@/components/public/hero-section";
import { SecuritySection } from "@/components/public/security-section";
import { WorkflowSection } from "@/components/public/workflow-section";
import { getOptionalAppContext } from "@/lib/auth";
import { MessageBox } from "@/components/message-box";
import { searchParamMessage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BauPro digitalisiert Dachdeckerbetriebe",
  description:
    "BauPro ist eine mobile-first SaaS für Dachdecker- und Handwerksbetriebe: Aufträge, Baustellen, Zeiten, Material, Bautagesberichte, Kundenportal und Rollenrechte."
};

async function getLandingContext() {
  try {
    return await getOptionalAppContext();
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const context = await getLandingContext();
  const isLoggedIn = Boolean(context);
  const { error, success } = searchParamMessage(await searchParams);

  return (
    <MarketingShell isLoggedIn={isLoggedIn}>
      <HeroSection isLoggedIn={isLoggedIn} />
      <div className="mx-auto max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
        <MessageBox error={error} success={success} />
      </div>

      <WhyBauProSection />

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionIntro
          kicker="Was ist BauPro?"
          title="Die Betriebszentrale für Baustelle und Büro"
          description="BauPro bringt die wichtigsten Abläufe eines Handwerksbetriebs in eine gemeinsame Web-App: Auftrag anlegen, Baustelle planen, Mitarbeiter informieren, Zeiten erfassen, Material prüfen und Nachweise sauber ablegen."
        />
        <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="border border-line bg-surface-container p-5 shadow-lift sm:p-6">
            <h2 className="text-3xl font-extrabold leading-tight text-ink">
              Für Chefs, die nicht mehr hinter jeder Info herlaufen wollen.
            </h2>
            <p className="mt-4 text-sm font-semibold leading-7 text-ash">
              BauPro ist bewusst nicht als schweres ERP gedacht. Die App soll kleine und mittlere Betriebe schnell arbeitsfähig machen:
              mit klaren Rollen, mobilen Formularen, großen Aktionen und sauberem Überblick über heute, morgen und offene Punkte.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <Link href="/features" className="btn-primary">
                Funktionen ansehen
              </Link>
              <Link href="/use-cases" className="btn-secondary">
                Anwendungsfälle
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <MiniProof value="3 Klicks" label="zu Kernfunktionen" />
            <MiniProof value="Mobil" label="für Baustelle" />
            <MiniProof value="Rollen" label="statt Einheitszugang" />
          </div>
        </div>
      </section>

      <RoofStorySection />

      <section id="funktionen" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <SectionIntro
          kicker="Hauptfunktionen"
          title="Alles, was im Alltag ständig gebraucht wird"
          description="Nicht als verstecktes Menü, sondern als klare Arbeitsbereiche für Chef, Vorarbeiter, Mitarbeiter und Kunden."
        />
        <FeatureGrid />
      </section>

      <section className="border-y border-line bg-basalt">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionIntro
            kicker="Smarte Unterstützung"
            title="KI, Kundenportal und Rollenmodell klar getrennt"
            description="BauPro macht moderne Funktionen nutzbar, ohne sensible Betriebsdaten ungeordnet sichtbar zu machen."
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <TrustPillar
              icon={Bot}
              title="KI-Erklärung"
              text="KI ist optional und liefert Vorschläge für Berichte, Materialbedarf und strukturierte Texte. Nutzer prüfen und bearbeiten alles, bevor es gespeichert wird."
            />
            <TrustPillar
              icon={Building2}
              title="Kundenportal"
              text="Kunden sehen freigegebene Fotos, Dokumente, Termine und Fortschritt ihrer Baustelle. Interne Notizen, Lagerdaten und Preise bleiben intern."
            />
            <TrustPillar
              icon={ShieldCheck}
              title="Rollenmodell"
              text="Chef/Admin sieht kaufmännische Daten und Einstellungen. Vorarbeiter arbeitet operativ. Mitarbeiter sieht nur das, was er auf der Baustelle braucht."
            />
          </div>
        </div>
      </section>

      <BenefitSection />
      <ProblemSolutionSection />
      <WorkflowSection />
      <SecuritySection />
      <PricingTeaserSection />
      <FaqSection />
      <CtaSection />
    </MarketingShell>
  );
}

function TrustPillar({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="border border-line bg-surface-container p-5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center border border-line bg-surface-container-high text-ocher">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-black text-ink">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-7 text-ash">{text}</p>
    </article>
  );
}

function MiniProof({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex min-h-36 flex-col justify-between border border-line bg-surface-container p-4 shadow-soft">
      <p className="text-5xl font-black leading-none text-ocher">{value}</p>
      <p className="text-sm font-black uppercase tracking-[0.14em] text-ash">{label}</p>
    </div>
  );
}
