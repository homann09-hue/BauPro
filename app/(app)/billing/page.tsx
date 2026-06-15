import Link from "next/link";
import { FileText, ReceiptText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireManager } from "@/lib/auth";

export default async function BillingPage() {
  await requireManager();

  return (
    <>
      <PageHeader
        title="Angebote und Rechnungen"
        description="Vorbereiteter Bereich fuer Angebots- und Rechnungsprozesse. Aktuell bleiben Auftrags- und Materialkalkulation die verbindliche Arbeitsbasis."
      />

      <section className="surface-strong overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-moss via-steel to-signal" />
        <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
          <div className="p-5 sm:p-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-md bg-mint px-3 py-1.5 text-xs font-black text-moss">
              <ReceiptText className="h-4 w-4" aria-hidden="true" />
              Vorbereitet
            </div>
            <h2 className="text-2xl font-black text-ink">Dokumentenstrecke kommt nach der Betriebszentrale</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Die App erfasst bereits Kunden, Aufträge, Maße, Materialbedarf, EK/VK-Grundlagen, Zeiten und PDF-Stundenzettel.
              Daraus kann später sauber eine Angebots- und Rechnungslogik entstehen.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href="/orders" className="btn-primary">
                Aufträge öffnen
              </Link>
              <Link href="/settings" className="btn-secondary">
                Firmendaten prüfen
              </Link>
            </div>
          </div>
          <aside className="border-t border-line bg-fog p-5 sm:p-7 lg:border-l lg:border-t-0">
            <ShieldCheck className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
            <h3 className="font-black text-ink">Keine Scheinfunktion</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Dieser Bereich ist sichtbar, aber bewusst als vorbereitet markiert. Es werden keine halbfertigen Rechnungen erzeugt.
            </p>
          </aside>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {[
          "Firmenprofil und Zahlungsbedingungen erweitern",
          "Angebotsnummern und Rechnungsnummern erzeugen",
          "PDF mit Material, Zeiten und Preisen ausgeben"
        ].map((item) => (
          <div key={item} className="surface p-4">
            <FileText className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
            <p className="font-black text-ink">{item}</p>
          </div>
        ))}
      </div>
    </>
  );
}
