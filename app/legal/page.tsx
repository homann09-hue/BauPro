import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { legalPages } from "@/lib/legal/pages";

export default function LegalIndexPage() {
  return (
    <main className="min-h-screen bg-fog px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="text-sm font-bold text-moss">
          Zur App
        </Link>
        <div className="mt-5 rounded-lg bg-ink p-5 text-white shadow-lift">
          <ShieldCheck className="mb-3 h-6 w-6 text-mint" aria-hidden="true" />
          <h1 className="text-3xl font-black">Rechtliche Entwürfe</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">
            Diese Seiten sind prüfpflichtige Platzhalter für Datenschutz, AGB, AVV und Anbieterkennzeichnung. Sie ersetzen keine
            anwaltliche Prüfung.
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {legalPages.map((page) => (
            <Link key={page.slug} href={`/legal/${page.slug}`} className="surface p-4 transition hover:border-moss/40">
              <p className="font-black text-ink">{page.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{page.summary}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
