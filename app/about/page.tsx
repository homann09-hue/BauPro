import type { Metadata } from "next";
import Link from "next/link";
import { Building2, CheckCircle2, Hammer, ShieldCheck, type LucideIcon } from "lucide-react";
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

      <section className="border-y border-line bg-basalt">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">Wofür BauPro bewusst steht</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <ValueCard title="Papier reduzieren" text="Stundenzettel, Baustellenfotos, Materialmeldungen und Tagesberichte sollen nicht mehr über mehrere Zettel, Chatverläufe und private Handys verteilt sein." />
            <ValueCard title="Baustellen digitalisieren" text="Die App soll auf dem iPhone genauso verständlich sein wie im Büro: große Aktionen, klare Statusanzeigen und möglichst wenig Tipparbeit." />
            <ValueCard title="Betriebe einfacher organisieren" text="Chef, Vorarbeiter, Mitarbeiter und Kunden brauchen unterschiedliche Informationen. BauPro trennt diese Rollen sichtbar und technisch." />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <p className="section-kicker">Produktgedanke</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
              BauPro soll nicht noch ein kompliziertes Verwaltungsprogramm sein.
            </h2>
          </div>
          <div className="space-y-4 text-sm font-semibold leading-7 text-ash sm:text-base">
            <p>
              Viele Handwerksbetriebe haben die gleiche Lage: Die eigentliche Arbeit läuft sauber, aber Informationen
              liegen verteilt. Ein Foto ist im Chat, der Stundenzettel im Fahrzeug, die Materialnotiz auf Papier und der
              Kunde fragt trotzdem nach dem aktuellen Stand.
            </p>
            <p>
              BauPro soll diese Brüche reduzieren. Nicht mit überladenen Tabellen, sondern mit klaren Arbeitsabläufen:
              Auftrag öffnen, Baustelle sehen, Zeit erfassen, Material melden, Bericht schreiben und Kunden nur das
              freigeben, was wirklich nach außen gehört.
            </p>
            <p>
              Der Anspruch ist ein professionelles SaaS-Produkt für echte Betriebe: schnell, mobil, verständlich,
              rollenbasiert und mit genug Struktur, damit Dokumentation und Nachweise später nicht zur Sucharbeit werden.
            </p>
          </div>
        </div>
      </section>

      <CtaSection />
    </MarketingShell>
  );
}

function ValueCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="border border-line bg-surface-container p-5 shadow-soft">
      <CheckCircle2 className="mb-4 h-6 w-6 text-moss" aria-hidden="true" />
      <h2 className="text-2xl font-black text-ink">{title}</h2>
      <p className="mt-3 text-sm font-semibold leading-7 text-ash">{text}</p>
    </article>
  );
}

function MissionCard({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="border border-line bg-surface-container p-5 shadow-soft">
      <Icon className="mb-4 h-7 w-7 text-ocher" aria-hidden="true" />
      <h2 className="text-2xl font-black text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ash">{text}</p>
    </article>
  );
}
