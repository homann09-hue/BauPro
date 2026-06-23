import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BriefcaseBusiness,
  Building2,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  Hammer,
  HardHat,
  LockKeyhole,
  PackageCheck,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Users,
  type LucideIcon
} from "lucide-react";
import { PublicNav } from "@/components/public/public-nav";
import { PublicFooter } from "@/components/public/public-footer";
import {
  marketingBenefits,
  marketingFaq,
  marketingFeatures,
  marketingPlans,
  marketingSecurityNotes,
  marketingUseCases,
  marketingWorkflow,
  type MarketingFeature
} from "@/lib/marketing";
import { cn } from "@/lib/utils";

const featureIconMap: Record<MarketingFeature["icon"], LucideIcon> = {
  briefcase: BriefcaseBusiness,
  clock: Clock3,
  package: PackageCheck,
  report: FileText,
  portal: Building2,
  camera: Camera,
  bot: Bot,
  users: Users,
  receipt: ReceiptText
};

export function MarketingShell({
  children,
  isLoggedIn = false
}: {
  children: React.ReactNode;
  isLoggedIn?: boolean;
}) {
  return (
    <main className="min-h-dvh bg-coal text-ink">
      <PublicNav isLoggedIn={isLoggedIn} />
      {children}
      <PublicFooter />
    </main>
  );
}

export function MarketingHero({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="absolute inset-0 opacity-70" aria-hidden="true">
        <div className="absolute inset-0 bg-[repeating-linear-gradient(-10deg,rgba(240,235,224,0.045)_0_1px,transparent_1px_64px)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(212,88,10,0.22),transparent_28rem),linear-gradient(180deg,rgba(17,17,16,0.2),#111110_86%)]" />
      </div>
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_0.92fr] lg:px-8 lg:py-20">
        <div className="flex flex-col justify-center">
          <div className="mb-5 inline-flex w-fit items-center gap-2 border border-primary/35 bg-primary/10 px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary">
            <HardHat className="h-4 w-4" aria-hidden="true" />
            Handwerker-SaaS für Baustelle und Büro
          </div>
          <h1 className="max-w-4xl text-6xl font-normal uppercase leading-[0.88] tracking-wide text-ink [font-family:var(--font-display)] sm:text-7xl lg:text-8xl">
            BauPro digitalisiert Dachdeckerbetriebe – von Auftrag bis Baustelle.
          </h1>
          <p className="mt-6 max-w-2xl text-base font-semibold leading-8 text-ash sm:text-lg">
            BauPro bündelt Aufträge, Zeiten, Material, Fotos, Bautagesberichte und Kundenkommunikation in einer mobilen Web-App.
            Klar genug für die Baustelle, strukturiert genug fürs Büro.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className="btn-primary w-full sm:w-auto">
              Demo starten
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="btn-secondary w-full sm:w-auto">
              {isLoggedIn ? "Zum Dashboard" : "Einloggen"}
            </Link>
          </div>
          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            <TrustMini icon={Smartphone} label="Mobile First" />
            <TrustMini icon={ShieldCheck} label="Rollenrechte" />
            <TrustMini icon={Hammer} label="Handwerksprozesse" />
          </div>
        </div>

        <ProductPreview />
      </div>
    </section>
  );
}

export function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -right-4 top-8 hidden h-32 w-32 border border-primary/30 bg-primary/10 lg:block" aria-hidden="true" />
      <div className="relative border border-line bg-basalt p-3 shadow-lift sm:p-4">
        <div className="border border-line bg-coal">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="border border-line bg-surface" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Heute im Betrieb</p>
                <p className="text-sm font-black text-ink">Müller Dachtechnik GmbH</p>
              </div>
            </div>
            <span className="border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-black text-primary">Live</span>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-3">
            <PreviewStat value="7" label="Baustellen" />
            <PreviewStat value="42h" label="Heute erfasst" />
            <PreviewStat value="3" label="Materialwarnungen" />
          </div>
          <div className="grid gap-px bg-line lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-surface p-4">
              <p className="meta-label">Aktive Baustelle</p>
              <h3 className="mt-2 text-3xl font-normal uppercase leading-none text-ink [font-family:var(--font-display)]">
                Dachsanierung Hauptstraße
              </h3>
              <p className="mt-2 text-sm font-semibold text-ash">5 Mitarbeiter · Unterspannbahn verlegt · Bericht offen</p>
              <div className="mt-4 grid gap-2">
                {["Zeit prüfen", "Material reserviert", "Fotos freigegeben"].map((item) => (
                  <div key={item} className="flex items-center justify-between border border-line bg-mint px-3 py-2 text-sm font-semibold text-ash">
                    <span>{item}</span>
                    <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-mint p-4">
              <p className="meta-label">Mobile Baustellenkarte</p>
              <div className="mt-3 space-y-2">
                <PreviewAction icon={Clock3} label="Zeit erfassen" />
                <PreviewAction icon={Camera} label="Foto hochladen" />
                <PreviewAction icon={PackageCheck} label="Material fehlt" />
                <PreviewAction icon={FileText} label="Bericht schreiben" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeatureGrid({ limit }: { limit?: number }) {
  const features = limit ? marketingFeatures.slice(0, limit) : marketingFeatures;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => {
        const Icon = featureIconMap[feature.icon];
        return <FeatureCard key={feature.title} icon={Icon} title={feature.title} description={feature.description} />;
      })}
    </div>
  );
}

export function FeatureCard({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <article className="interactive-surface p-4 sm:p-5">
      <div className="mb-4 flex h-12 w-12 items-center justify-center border border-line bg-mint text-primary">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-lg font-black text-ink">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ash">{description}</p>
    </article>
  );
}

export function BenefitSection() {
  return (
    <section id="vorteile" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionIntro kicker="Vorteile" title="Weniger Chaos. Mehr Steuerung." description="BauPro ersetzt keine Fachentscheidung, aber es macht die tägliche Arbeit nachvollziehbarer und schneller erreichbar." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {marketingBenefits.map((benefit) => (
          <div key={benefit} className="flex min-h-20 items-center gap-3 border border-line bg-surface p-4 shadow-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="font-black text-ink">{benefit}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProblemSolutionSection() {
  return (
    <section className="border-y border-line bg-basalt">
      <div className="mx-auto grid max-w-7xl gap-px bg-line px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
        <ProblemSolutionCard
          title="Alte Arbeitsweise"
          tone="muted"
          items={["Zettel im Fahrzeug", "WhatsApp-Fotos ohne Auftrag", "unklare Stunden", "Material fehlt erst morgens", "Berichte werden abends nachgetragen"]}
        />
        <ProblemSolutionCard
          title="Mit BauPro"
          tone="strong"
          items={["Auftrag und Baustelle verbunden", "Fotos und Dokumente sauber zugeordnet", "Zeiten prüfbar", "Materialwarnungen sichtbar", "Berichte als Nachweis exportierbar"]}
        />
      </div>
    </section>
  );
}

export function WorkflowSection() {
  return (
    <section id="ablauf" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionIntro kicker="Ablauf" title="Vom ersten Kontakt bis zum Nachweis" description="Der typische Betriebsablauf bleibt handwerklich, wird aber digital geführt." />
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {marketingWorkflow.map((step, index) => (
          <div key={step} className="relative border border-line bg-surface p-4">
            <p className="text-4xl font-normal leading-none text-primary [font-family:var(--font-display)]">{String(index + 1).padStart(2, "0")}</p>
            <p className="mt-3 font-black text-ink">{step}</p>
            {index < marketingWorkflow.length - 1 ? <ChevronRight className="absolute right-3 top-4 hidden h-5 w-5 text-ash lg:block" aria-hidden="true" /> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

export function SecurityTrustSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <SectionIntro kicker="Vertrauen" title="Sicherheit und Datenschutz mitgedacht" description="BauPro ist technisch auf Rollen, Firmen-Trennung und prüfbare Prozesse ausgelegt. Rechtliche Texte bleiben bewusst prüfpflichtig statt großspurig." />
          <Link href="/security" className="btn-secondary mt-5 w-full sm:w-auto">
            Sicherheit ansehen
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {marketingSecurityNotes.map((note) => (
            <div key={note.title} className="surface p-4">
              <LockKeyhole className="mb-3 h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="font-black text-ink">{note.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ash">{note.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PricingTeaserSection() {
  return (
    <section className="border-y border-line bg-surface">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_0.8fr] lg:px-8">
        <div>
          <p className="section-kicker">Tarife</p>
          <h2 className="mt-3 text-5xl font-normal uppercase leading-none tracking-wide text-ink [font-family:var(--font-display)] sm:text-6xl">
            Preise werden sauber vorbereitet.
          </h2>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-ash">
            BauPro ist auf SaaS-Tarife vorbereitet. Aktuell steht die Demo im Vordergrund, damit Betriebe den Nutzen ohne lange Einrichtung sehen.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-3">
          <Link href="/pricing" className="btn-primary">
            Tarifseite öffnen
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/demo" className="btn-secondary">
            Demo starten
          </Link>
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionIntro kicker="FAQ" title="Häufige Fragen" description="Kurz und ohne Verkaufslärm beantwortet." />
      <div className="grid gap-3 lg:grid-cols-2">
        {marketingFaq.map((item) => (
          <article key={item.question} className="surface p-4 sm:p-5">
            <h3 className="font-black text-ink">{item.question}</h3>
            <p className="mt-2 text-sm leading-6 text-ash">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function UseCaseGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {marketingUseCases.map((useCase) => (
        <article key={useCase.title} className="interactive-surface p-5">
          <Building2 className="mb-4 h-6 w-6 text-primary" aria-hidden="true" />
          <h2 className="text-2xl font-black text-ink">{useCase.title}</h2>
          <p className="mt-2 text-sm leading-6 text-ash">{useCase.description}</p>
          <ul className="mt-4 space-y-2">
            {useCase.points.map((point) => (
              <li key={point} className="flex gap-2 text-sm font-semibold text-ash">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {point}
              </li>
            ))}
          </ul>
        </article>
      ))}
    </div>
  );
}

export function PricingCards() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {marketingPlans.map((plan) => (
        <article key={plan.name} className={cn("surface p-5", plan.highlighted && "border-primary bg-primary/10")}>
          <p className="section-kicker">{plan.name}</p>
          <h2 className="mt-3 text-3xl font-normal uppercase text-ink [font-family:var(--font-display)]">{plan.price}</h2>
          <p className="mt-2 text-sm leading-6 text-ash">{plan.description}</p>
          <ul className="mt-5 space-y-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-2 text-sm font-semibold text-ash">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
          <Link href="/demo" className={cn("mt-6 w-full", plan.highlighted ? "btn-primary" : "btn-secondary")}>
            Demo ansehen
          </Link>
        </article>
      ))}
    </div>
  );
}

export function SectionIntro({ kicker, title, description }: { kicker: string; title: string; description?: string }) {
  return (
    <div className="mb-7 max-w-3xl">
      <p className="section-kicker">{kicker}</p>
      <h2 className="mt-3 text-5xl font-normal uppercase leading-none tracking-wide text-ink [font-family:var(--font-display)] sm:text-6xl">{title}</h2>
      {description ? <p className="mt-4 text-sm font-semibold leading-7 text-ash sm:text-base">{description}</p> : null}
    </div>
  );
}

export function MarketingPageHeader({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return (
    <section className="border-b border-line bg-basalt">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <p className="section-kicker">{kicker}</p>
        <h1 className="mt-4 max-w-4xl text-6xl font-normal uppercase leading-[0.9] tracking-wide text-ink [font-family:var(--font-display)] sm:text-7xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-ash">{description}</p>
      </div>
    </section>
  );
}

export function MarketingCta() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="grid gap-6 border border-line bg-primary p-5 text-white shadow-lift sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-white/75">In 2 Minuten sehen, ob es passt</p>
          <h2 className="mt-3 text-5xl font-normal uppercase leading-none tracking-wide [font-family:var(--font-display)]">Demo-Firma öffnen statt Daten eintippen.</h2>
          <p className="mt-3 max-w-2xl text-sm font-semibold leading-7 text-white/80">
            Mit vorbereiteten Baustellen, Team, Lager und Berichten erkennst du schneller, ob BauPro zum Betrieb passt.
          </p>
        </div>
        <Link href="/demo" className="inline-flex min-h-14 items-center justify-center gap-2 border border-white/30 bg-white px-5 py-3 text-lg font-normal uppercase text-coal [font-family:var(--font-display)]">
          Demo starten
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function TrustMini({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-3 border border-line bg-surface px-3 py-3">
      <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      <span className="text-sm font-black text-ink">{label}</span>
    </div>
  );
}

function PreviewStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface p-4">
      <p className="text-4xl font-normal leading-none text-ink [font-family:var(--font-display)]">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-ash">{label}</p>
    </div>
  );
}

function PreviewAction({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border border-line bg-surface px-3">
      <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
      <span className="text-sm font-black text-ink">{label}</span>
    </div>
  );
}

function ProblemSolutionCard({ title, items, tone }: { title: string; items: string[]; tone: "muted" | "strong" }) {
  return (
    <article className={cn("p-5 sm:p-6", tone === "strong" ? "bg-primary text-white" : "bg-surface text-ink")}>
      <h2 className="text-4xl font-normal uppercase leading-none [font-family:var(--font-display)]">{title}</h2>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className={cn("flex gap-3 text-sm font-semibold", tone === "strong" ? "text-white/85" : "text-ash")}>
            <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "strong" ? "text-white" : "text-primary")} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
