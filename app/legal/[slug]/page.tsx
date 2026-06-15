import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { getLegalPage, legalPages } from "@/lib/legal/pages";

export function generateStaticParams() {
  return legalPages.map((page) => ({ slug: page.slug }));
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = getLegalPage(slug);
  if (!page) notFound();

  return (
    <main className="min-h-screen bg-fog px-4 py-8">
      <article className="mx-auto max-w-4xl">
        <Link href="/legal" className="text-sm font-bold text-moss">
          Rechtliche Seiten
        </Link>
        <header className="mt-5 surface-strong p-5 sm:p-7">
          <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Pruefpflichtiger Entwurf
          </div>
          <h1 className="text-3xl font-black text-ink">{page.title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">{page.summary}</p>
        </header>

        <div className="mt-5 space-y-4">
          {page.sections.map((section) => (
            <section key={section.heading} className="surface p-5">
              <h2 className="section-title">{section.heading}</h2>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
