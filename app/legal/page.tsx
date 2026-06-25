import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicNav } from "@/components/public/public-nav";
import { legalPages } from "@/lib/legal/pages";

export const metadata: Metadata = {
  title: "Rechtliche Informationen",
  description:
    "Rechtliche BauPro Informationen: Impressum, Datenschutz, AGB, Cookies, AVV-Hinweis und Löschkonzept als prüfpflichtige Entwürfe."
};

export default function LegalIndexPage() {
  return (
    <main className="marketing-shell-bg min-h-dvh bg-coal text-ink">
      <PublicNav />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/" className="text-sm font-bold text-ocher transition hover:text-white">
          Zur Startseite
        </Link>
        <div className="mt-5 border border-line bg-surface-container p-5 text-ink shadow-lift sm:p-7">
          <ShieldCheck className="mb-3 h-7 w-7 text-ocher" aria-hidden="true" />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Rechtliche Informationen</h1>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-ash">
            Diese Seiten bündeln Datenschutz, Anbieterkennzeichnung, AGB, AVV und Aufbewahrungskonzept als prüfpflichtige
            Entwürfe. Sie ersetzen keine anwaltliche Prüfung, sind aber bewusst transparent statt versteckt.
          </p>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {legalPages.map((page) => (
            <Link key={page.slug} href={`/legal/${page.slug}`} className="border border-line bg-surface-container p-4 transition hover:border-ocher/60 hover:shadow-lift">
              <p className="font-black text-ink">{page.title}</p>
              <p className="mt-2 text-sm leading-6 text-ash">{page.summary}</p>
            </Link>
          ))}
        </div>
      </div>
      <PublicFooter />
    </main>
  );
}
