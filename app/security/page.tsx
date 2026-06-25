import type { Metadata } from "next";
import Link from "next/link";
import { Database, EyeOff, FileClock, LockKeyhole, ServerCog, ShieldCheck, Users, type LucideIcon } from "lucide-react";
import { MarketingPageHeader, MarketingShell } from "@/components/marketing/marketing-site";
import { CtaSection } from "@/components/public/cta-section";
import { SecuritySection } from "@/components/public/security-section";
import { marketingSecurityNotes } from "@/lib/marketing";

export const metadata: Metadata = {
  title: "Sicherheit, Rollen und Datenschutz",
  description:
    "BauPro Sicherheit im Überblick: Rollenrechte, Supabase Row Level Security, Mandantentrennung, Upload-Schutz, Audit-Logs und DSGVO-orientierte Dokumentation."
};

export default function SecurityPage() {
  return (
    <MarketingShell>
      <MarketingPageHeader
        kicker="Sicherheit"
        title="BauPro behandelt Betriebsdaten nicht wie eine offene Tabelle."
        description="Handwerksdaten enthalten Kundenadressen, Mitarbeiterzeiten, Fotos, Dokumente und Preise. Deshalb sind Rollen, Firmen-Trennung und sichere Serverprozesse Teil des Produkts."
      />

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-14 sm:px-6 lg:grid-cols-3 lg:px-8">
        <SecurityPillar icon={Users} title="Rollenrechte" text="Chef/Admin, Vorarbeiter, Mitarbeiter und Kunde erhalten unterschiedliche Oberflächen und Serverrechte." />
        <SecurityPillar icon={LockKeyhole} title="Mandantentrennung" text="Supabase RLS ist auf Firmen-Scoping ausgelegt, damit Daten nicht zwischen Betrieben vermischt werden." />
        <SecurityPillar icon={ShieldCheck} title="Prüfbare Prozesse" text="Audit-Logs, Soft-Delete, PDF-/CSV-Exporte und Datenschutzseiten sind technisch vorbereitet." />
      </section>

      <SecuritySection />

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-2">
          <SecurityDetail
            icon={Database}
            title="Supabase und Row Level Security"
            text="BauPro ist so aufgebaut, dass Datenbankzugriffe nach Firma und Rolle geprüft werden. Row Level Security ergänzt die Prüfungen im Code und verhindert, dass ein Betrieb versehentlich Daten eines anderen Betriebs lesen kann."
          />
          <SecurityDetail
            icon={EyeOff}
            title="Preis- und Chefbereiche"
            text="EK-Preise, VK-Preise, Margen, Aufschläge, Lieferantenangebote und Preisvergleiche sind kaufmännische Daten. Sie gehören in Manager-Ansichten und werden für Mitarbeiter, Vorarbeiter und Kunden nicht als normale Arbeitsdaten angezeigt."
          />
          <SecurityDetail
            icon={ServerCog}
            title="Serverseitige Kontrollen"
            text="Wichtige Aktionen werden nicht nur über die Oberfläche versteckt. Server Actions und API-Routen prüfen Rolle, Firma und Zielressource, bevor gespeichert, exportiert oder freigegeben wird."
          />
          <SecurityDetail
            icon={FileClock}
            title="Backups, Löschkonzept und Nachvollziehbarkeit"
            text="Für produktive Nutzung braucht jeder SaaS-Betrieb ein geprüftes Backup-Konzept, klare Aufbewahrungsfristen und nachvollziehbare Änderungen. BauPro bereitet Audit-Logs, Archivierung und Exporte technisch vor."
          />
        </div>
      </section>

      <section className="border-y border-line bg-basalt">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">Wichtig: ehrlich statt vollmundig.</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {marketingSecurityNotes.map((note) => (
              <article key={note.title} className="border border-line bg-surface-container p-5 shadow-soft">
                <h3 className="font-black text-ink">{note.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ash">{note.text}</p>
              </article>
            ))}
          </div>
          <p className="mt-5 max-w-3xl text-sm font-semibold leading-7 text-ash">
            BauPro ist DSGVO-orientiert aufgebaut. Rechtsverbindliche Aussagen, Impressum, AVV, Löschfristen und Datenschutzerklärung müssen vor produktiver Nutzung final geprüft werden.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link href="/legal/datenschutz" className="btn-secondary">
              Datenschutz-Entwurf
            </Link>
            <Link href="/legal/avv" className="btn-secondary">
              AVV-Hinweis
            </Link>
          </div>
        </div>
      </section>

      <CtaSection />
    </MarketingShell>
  );
}

function SecurityPillar({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="border border-line bg-surface-container p-5 shadow-soft">
      <Icon className="mb-4 h-7 w-7 text-ocher" aria-hidden="true" />
      <h2 className="text-2xl font-black text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ash">{text}</p>
    </article>
  );
}

function SecurityDetail({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <article className="bp-motion-card border border-line bg-surface-container p-5 shadow-soft sm:p-6">
      <div className="mb-5 flex h-12 w-12 items-center justify-center border border-ocher/35 bg-ocher/10 text-ocher">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="text-2xl font-black leading-tight text-ink">{title}</h2>
      <p className="mt-3 text-sm font-semibold leading-7 text-ash">{text}</p>
    </article>
  );
}
