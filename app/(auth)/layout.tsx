import Link from "next/link";
import { Clock3, Coins, ShieldCheck, Sparkles, type LucideIcon } from "lucide-react";
import { whyBauProSalesHighlights } from "@/lib/why-baupro";

const salesIcons: LucideIcon[] = [Clock3, Coins, ShieldCheck, Sparkles];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="bp-auth-root min-h-dvh overflow-hidden bg-coal text-ink">
      <div className="pointer-events-none absolute inset-0 opacity-75" aria-hidden="true">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(-8deg,rgba(240,235,224,0.045)_0_1px,transparent_1px_60px)]" />
        <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(212,88,10,0.14),transparent_42%),linear-gradient(90deg,transparent,rgba(212,88,10,0.06))]" />
      </div>

      <div className="relative grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="flex min-h-[44vh] flex-col justify-between px-5 py-6 sm:px-8 lg:min-h-dvh lg:px-14 lg:py-12">
          <Link href="/" className="flex w-fit items-center gap-3 text-xl font-extrabold tracking-tight text-ink">
            <span className="h-2.5 w-2.5 rotate-45 bg-ocher" aria-hidden="true" />
            BauPro
          </Link>

          <div className="py-10 lg:py-14">
            <p className="section-kicker mb-5">Betriebssoftware für Dachdecker</p>
            <h1 className="max-w-3xl text-5xl font-extrabold leading-[0.96] tracking-tight text-ink sm:text-7xl xl:text-[5rem]">
              Baustelle.
              <br />
              Bericht.
              <br />
              <span className="text-ocher">Fertig.</span>
            </h1>
            <p className="mt-7 max-w-md text-sm font-medium leading-7 text-ash">
              Zeiten, Material und Berichte direkt vom Dach. Klar im Büro, schnell auf dem Gerüst, ohne Software-Theater.
            </p>

            <div className="mt-9 grid max-w-2xl grid-cols-3 gap-px bg-line">
              <AuthStat value="0h" label="Nacharbeit" />
              <AuthStat value="1×" label="Alles erfassen" />
              <AuthStat value="∞" label="Kontrolle" />
            </div>

            <div className="mt-8 flex max-w-2xl flex-wrap gap-2.5">
              {["Mitbringlisten", "Tagesberichte & PDF", "Materialwarnungen", "Chef-Ansicht & Margen", "Lagerabgleich", "Audit-Spuren"].map((label) => (
                <span key={label} className="inline-flex min-h-9 items-center gap-2 border border-line bg-surface-container px-4 text-sm font-semibold text-ash">
                  <span className="h-1.5 w-1.5 rotate-45 bg-ocher" aria-hidden="true" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="hidden text-xs font-semibold tracking-wide text-ash lg:flex lg:items-center lg:gap-4">
            <span>© 2026 BauPro</span>
            <Link href="/legal/impressum" className="hover:text-ash">
              Impressum
            </Link>
            <Link href="/legal/datenschutz" className="hover:text-ash">
              Datenschutz
            </Link>
          </div>
        </section>

        <section className="border-t border-line bg-basalt px-5 py-6 shadow-lift sm:px-8 lg:border-l lg:border-t-0 lg:px-10 lg:py-12">
          <div className="mx-auto flex min-h-full max-w-md flex-col justify-center">
            {children}

            <div className="mt-6 border-t border-line pt-5 lg:hidden">
              <h2 className="text-3xl font-extrabold tracking-tight text-ink">Warum BauPro?</h2>
              <div className="mt-3 grid gap-2">
                {whyBauProSalesHighlights.slice(0, 3).map((highlight, index) => (
                  <AuthFeature key={highlight.label} icon={salesIcons[index] ?? Sparkles} title={highlight.label} text={highlight.value} />
                ))}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap justify-between gap-3 border-t border-line pt-5 text-xs font-semibold text-ash">
              <span>Noch Fragen?</span>
              <div className="flex gap-3">
                <Link href="/legal/impressum" className="hover:text-ash">
                  Impressum
                </Link>
                <Link href="/legal/datenschutz" className="hover:text-ash">
                  Datenschutz
                </Link>
                <Link href="/legal/agb" className="hover:text-ash">
                  AGB
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-coal px-4 py-5 sm:px-6">
      <p className="text-4xl font-black leading-none text-ink">
        {value.replace(/[a-z×]/gi, "")}
        <span className="text-ocher">{value.replace(/[^a-z×]/gi, "")}</span>
      </p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ash">{label}</p>
    </div>
  );
}

function AuthFeature({
  icon: Icon,
  title,
  text
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-3 border border-line bg-surface-container p-3 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-surface-container-high text-ocher">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="font-black text-ink">{title}</p>
        <p className="mt-1 text-xs leading-5 text-ash">{text}</p>
      </div>
    </div>
  );
}
