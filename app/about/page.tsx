import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Hammer, ShieldCheck, type LucideIcon } from "lucide-react";
import { MarketingPageHeader, MarketingShell, SectionIntro } from "@/components/marketing/marketing-site";
import { CtaSection } from "@/components/public/cta-section";

export const metadata: Metadata = {
  title: "Über BauPro",
  description:
    "BauPro Mission: eine klare, mobile und professionelle Handwerker-Software für Dachdeckerbetriebe, Baustellen-Teams und Büroabläufe."
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        kicker="Über BauPro"
        title="Software soll dem Betrieb helfen, nicht den Betrieb ausbremsen."
        description="BauPro entsteht aus einem einfachen Gedanken: Baustellenarbeit ist schnell, mobil und dokumentationspflichtig. Die Software dafür muss genauso klar sein."
      />

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:px-8">
        <div>
          <SectionIntro
            kicker="Mission"
            title="Handwerk digital, ohne Bürokratiedeutsch"
            description="Viele Betriebe arbeiten mit Zettel, WhatsApp, Excel und Bauchgefühl. BauPro soll diese Informationen zusammenführen, ohne daraus ein schweres ERP-Projekt zu machen."
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className="btn-primary">
              Demo öffnen
            </Link>
            <Link href="/use-cases" className="btn-secondary">
              Für wen ist es?
            </Link>
          </div>
        </div>
        <div className="grid gap-3">
          <MissionCard icon={Hammer} title="Baustellentauglich" text="Große Aktionen, mobile Formulare, Foto-Upload, Spracheingabe und klare Tagesansichten." />
          <MissionCard icon={Building2} title="Bürotauglich" text="Aufträge, Kunden, Zeiten, Material, Berichte, PDFs und Rollenrechte in nachvollziehbaren Prozessen." />
          <MissionCard icon={ShieldCheck} title="Vertrauenswürdig vorbereitet" text="Mandantentrennung, Datenschutzseiten, Audit-Spuren und Preisbereiche mit Rollenlogik." />
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-5xl font-normal uppercase leading-none text-ink [font-family:var(--font-display)]">Wofür BauPro bewusst steht</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              "Klare Sprache statt Software-Fachchinesisch.",
              "Mobile Nutzung zuerst, Desktop für Überblick und Auswertung.",
              "KI als Vorschlag, nicht als Ersatz für fachliche Prüfung."
            ].map((text) => (
              <div key={text} className="border border-line bg-basalt p-4 text-sm font-semibold leading-6 text-ash">
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

function MissionCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="surface p-5">
      <Icon className="mb-4 h-7 w-7 text-primary" aria-hidden="true" />
      <h2 className="text-2xl font-black text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ash">{text}</p>
    </article>
  );
}
