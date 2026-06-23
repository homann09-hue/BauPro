import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { ConsentSettingsCard } from "@/components/consent-settings-card";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicNav } from "@/components/public/public-nav";
import { getLegalPage, legalPages } from "@/lib/legal/pages";

export function generateStaticParams() {
  return legalPages.map((page) => ({ slug: page.slug }));
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getLegalPage(slug);
  if (!page) notFound();

  return (
    <main className="marketing-shell-bg min-h-dvh bg-coal text-ink">
      <PublicNav />
      <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/legal" className="text-sm font-bold text-ocher transition hover:text-white">
          Rechtliche Seiten
        </Link>
        <header className="mt-5 border border-line bg-surface-container p-5 shadow-lift sm:p-7">
          <div className="mb-3 inline-flex items-center gap-2 border border-ocher/40 bg-ocher/10 px-3 py-1.5 text-xs font-black text-ocher">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Prüfpflichtiger Entwurf
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">{page.title}</h1>
          <p className="mt-3 text-sm font-semibold leading-7 text-ash">{page.summary}</p>
        </header>

        <div className="mt-5 space-y-4">
          {slug === "datenschutz" || slug === "cookies" ? <ConsentSettingsCard /> : null}

          {page.sections.map((section) => (
            <section key={section.heading} className="border border-line bg-surface-container p-5 shadow-soft">
              <h2 className="text-2xl font-black text-ink">{section.heading}</h2>
              <div className="mt-3 space-y-2 text-sm font-semibold leading-7 text-ash">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
      <PublicFooter />
    </main>
  );
}
