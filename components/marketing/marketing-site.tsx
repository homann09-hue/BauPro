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

const heroImageUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBt2LF4I9x1eaaYVmh3hkFNc4UPY9otMry5tgXhuixGAOrajFTBeGEPztuDlR1cZuNu9gTB5DrRTOSMaDU0jD_nmcCNZXDc1ZsCIrZfQMNb6CSBjlzMHr_YI2OY8TR2QojYsewdRLU7Gq-CS0u_kFQzRVVNZiHXvkJZtKrR-gfhfTl8H4KUjLHE2L1RB40Y-HuOWxCaEgu-XPAq6GS-mQLPaTRUEVlAR3-ijo74qNwS-N4C2StVA1aXiwMs1ugeoMSfPykKHJKm0YA";

const roofWorkerImageUrl =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCE4K46tm04j6MI2aY6nTCFWhN4RsIZZwu4Fyb-4VYfPFY5kXaJF4tVxePN8YM7gyJ8HE8N5i-bXXQKJnbDfb3uJqCb2W5CUGOoF07zl6bMybZcEQAVuq3hVi8TwXtesuPYEG4aZw-Qo8Y8qeCdC1_UyU5aBuhXc11jrllq84QITiz5avXT34KY75ZyD9HIAHXvIf3pNkymQS96zM6ixkqKDRr6z1BNk5nNo5lYRwUMPFeXBxlkp73Sg1gzqpflamRC4j7QbeRYufg";

const roofStoryCards = [
  {
    title: "Neues Dach sauber dokumentieren",
    text: "Fotos, Wetter, Zeiten und Bericht landen direkt am Auftrag, statt später aus Chats zusammengesucht zu werden.",
    label: "Dokumentation",
    position: "center top"
  },
  {
    title: "Ziegel runter, Material im Blick",
    text: "Materialbedarf, Mitbringliste und Lagerwarnungen helfen morgens, bevor etwas auf der Baustelle fehlt.",
    label: "Baustelle",
    position: "58% center"
  },
  {
    title: "Chef sieht Fortschritt ohne Nachtelefonieren",
    text: "Status, offene Punkte und Kundenfreigaben bleiben in BauPro nachvollziehbar und rollenbasiert geschützt.",
    label: "Überblick",
    position: "right center"
  }
];

const whyBauProCards = [
  {
    icon: Clock3,
    title: "Stunden ohne Zettelchaos",
    text: "Mitarbeiter erfassen Zeiten direkt am Handy. Chef sieht offene Freigaben, Pausen und Tagesstunden sauber an einem Ort."
  },
  {
    icon: PackageCheck,
    title: "Material früher im Griff",
    text: "BauPro zeigt knappe Lagerbestände, Mitbringlisten und Materialbedarf, bevor morgens auf der Baustelle etwas fehlt."
  },
  {
    icon: Camera,
    title: "Fotos bleiben beim Auftrag",
    text: "Dachflächen, Schäden, Abnahmen und Tagesberichte werden nicht mehr in Chats gesucht, sondern sauber der Baustelle zugeordnet."
  },
  {
    icon: ShieldCheck,
    title: "Preise bleiben Chefsache",
    text: "Mitarbeiter arbeiten operativ. EK, VK, Marge und Kalkulationen bleiben für Chef/Admin geschützt."
  }
];

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
    <main className="marketing-shell-bg min-h-dvh bg-coal text-ink">
      <PublicNav isLoggedIn={isLoggedIn} />
      {children}
      <PublicFooter />
    </main>
  );
}

export function MarketingHero({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <section className="relative overflow-hidden border-b border-line bg-coal">
      <div className="absolute inset-0 z-0" aria-hidden="true">
        <div className="bp-parallax-image h-full w-full bg-cover bg-center opacity-70 grayscale-[0.35]" style={{ backgroundImage: `url(${heroImageUrl})` }} />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(19,19,19,0.98)_0%,rgba(19,19,19,0.86)_42%,rgba(19,19,19,0.42)_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,19,19,0)_0%,rgba(19,19,19,0.42)_42%,rgba(19,19,19,0.94)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[760px] max-w-7xl items-center gap-8 px-4 pb-10 pt-12 sm:px-6 lg:min-h-[820px] lg:grid-cols-[minmax(0,1fr)_500px] lg:px-8">
        <div className="max-w-3xl">
          <div className="bp-reveal mb-5 inline-flex w-fit items-center gap-2 border border-moss/40 bg-moss/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-moss">
            <HardHat className="h-4 w-4" aria-hidden="true" />
            Baustellentauglich · mobil · rollenbasiert
          </div>
          <h1 className="bp-reveal bp-reveal-delay-1 max-w-4xl text-5xl font-extrabold leading-[0.96] tracking-tight text-white sm:text-7xl lg:text-[5.9rem]">
            Die Software für <span className="text-ocher">Dachdecker</span>, die draußen wirklich funktioniert.
          </h1>
          <p className="bp-reveal bp-reveal-delay-2 mt-6 max-w-2xl text-base font-semibold leading-8 text-white/75 sm:text-lg">
            BauPro digitalisiert Dachdeckerbetriebe von der Baustelle bis zum Büro:
            Auftrag, Team, Material, Zeiten, Fotos und Kundenportal in einer App.
            Weniger Nachtelefonieren, weniger Papierkram, mehr Überblick im Betrieb.
          </p>
          <div className="bp-reveal bp-reveal-delay-3 mt-9 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className="btn-primary bp-hero-shine w-full bg-ocher text-coal hover:bg-signal sm:w-auto">
              Demo als Chef starten
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href={isLoggedIn ? "/dashboard" : "/features"} className="btn-secondary w-full border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white sm:w-auto">
              {isLoggedIn ? "Zum Dashboard" : "Funktionen entdecken"}
            </Link>
          </div>
          <div className="bp-reveal bp-reveal-delay-3 mt-8 grid max-w-2xl gap-2 sm:grid-cols-3">
            <TrustMini icon={Smartphone} label="Große Buttons fürs Handy" />
            <TrustMini icon={ShieldCheck} label="EK/VK bleiben geschützt" />
            <TrustMini icon={Hammer} label="Für Dachdecker-Abläufe" />
          </div>
        </div>

        <HeroOperationsPanel />
      </div>

      <div className="relative z-10 border-t border-white/10 bg-coal/82 backdrop-blur">
        <div className="mx-auto grid max-w-7xl gap-px bg-white/10 px-4 sm:px-6 md:grid-cols-3 lg:px-8">
          <HeroProof value="3 Klicks" label="zu Zeit, Bericht und Material" />
          <HeroProof value="Live" label="Baustellen, Team und Warnungen" />
          <HeroProof value="Chefmodus" label="Kosten und Rechte bleiben geschützt" />
        </div>
      </div>
    </section>
  );
}

function HeroOperationsPanel() {
  return (
    <aside className="bp-soft-pop bp-reveal-delay-2 overflow-hidden border border-white/12 bg-surface/92 shadow-lift backdrop-blur-md">
      <div className="relative min-h-64 border-b border-line bg-cover bg-center" style={{ backgroundImage: `url(${roofWorkerImageUrl})` }}>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(19,19,19,0.08)_0%,rgba(19,19,19,0.82)_100%)]" />
        <div className="absolute left-4 top-4 border border-moss/35 bg-coal/75 px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-moss backdrop-blur">
          Dachsanierung live
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ocher">Morgen 07:00 Uhr</p>
          <h2 className="mt-1 text-3xl font-black leading-tight text-white">Hauptstraße 18</h2>
          <p className="mt-1 text-sm font-semibold text-white/72">Team bereit · Material fast vollständig · Wetter trocken</p>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ocher">BauPro Übersicht</p>
            <h3 className="mt-2 text-2xl font-black leading-tight text-ink">Was heute wichtig ist</h3>
          </div>
          <span className="border border-moss/35 bg-moss/10 px-2 py-1 text-[11px] font-black uppercase text-moss">Live</span>
        </div>

        <div className="grid gap-3">
          <HeroPanelRow icon={Clock3} title="42 h erfasst" text="3 Zeiten warten auf Freigabe" tone="moss" />
          <HeroPanelRow icon={PackageCheck} title="2 Materialwarnungen" text="Unterspannbahn und Dachlatten knapp" tone="ocher" />
          <HeroPanelRow icon={FileText} title="Bericht bereit" text="Fotos, Wetter und Tätigkeiten gebündelt" tone="moss" />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-px bg-line text-center">
          <HeroMiniMetric value="7" label="Baustellen" />
          <HeroMiniMetric value="18" label="Aufgaben" />
          <HeroMiniMetric value="4" label="Berichte" />
        </div>
      </div>
    </aside>
  );
}

function HeroPanelRow({
  icon: Icon,
  title,
  text,
  tone
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  tone: "moss" | "ocher";
}) {
  return (
    <div className="flex min-h-16 gap-3 border border-line bg-surface-container p-3">
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center border", tone === "moss" ? "border-moss/30 bg-moss/10 text-moss" : "border-ocher/35 bg-ocher/10 text-ocher")}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-sm font-black text-ink">{title}</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-ash">{text}</p>
      </div>
    </div>
  );
}

function HeroMiniMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface-container p-3">
      <p className="text-2xl font-black text-ocher">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-ash">{label}</p>
    </div>
  );
}

function HeroProof({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-coal/72 py-4">
      <p className="text-2xl font-black leading-none text-ocher">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-white/62">{label}</p>
    </div>
  );
}

export function ProductPreview() {
  return (
    <div className="relative">
      <div className="absolute -right-4 top-8 hidden h-32 w-32 border border-ocher/30 bg-ocher/10 lg:block" aria-hidden="true" />
      <div className="relative border border-line bg-surface-container p-3 shadow-lift sm:p-4">
        <div className="border border-line bg-coal">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div className="flex items-center gap-3">
              <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="border border-line bg-surface-container" />
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-ocher">Heute im Betrieb</p>
                <p className="text-sm font-black text-ink">Müller Dachtechnik GmbH</p>
              </div>
            </div>
            <span className="border border-moss/30 bg-moss/10 px-2 py-1 text-xs font-black text-moss">Live</span>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-3">
            <PreviewStat value="7" label="Baustellen" />
            <PreviewStat value="42h" label="Heute erfasst" />
            <PreviewStat value="3" label="Materialwarnungen" />
          </div>
          <div className="grid gap-px bg-line lg:grid-cols-[1.1fr_0.9fr]">
            <div className="bg-surface-container p-4">
              <p className="meta-label">Aktive Baustelle</p>
              <h3 className="mt-2 text-3xl font-extrabold leading-tight text-ink">
                Dachsanierung Hauptstraße
              </h3>
              <p className="mt-2 text-sm font-semibold text-ash">5 Mitarbeiter · Unterspannbahn verlegt · Bericht offen</p>
              <div className="mt-4 grid gap-2">
                {["Zeit prüfen", "Material reserviert", "Fotos freigegeben"].map((item) => (
                  <div key={item} className="flex items-center justify-between border border-line bg-surface-container-high px-3 py-2 text-sm font-semibold text-ash">
                    <span>{item}</span>
                    <CheckCircle2 className="h-4 w-4 text-moss" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-surface-container-high p-4">
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

export function RoofStorySection() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="border border-line bg-surface-container p-5 shadow-lift sm:p-6">
          <p className="section-kicker">Baustellengefühl</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">
            So sieht digitale Baustelle aus.
          </h2>
          <p className="mt-4 text-sm font-semibold leading-7 text-ash sm:text-base">
            Dachdecker brauchen keine verspielte Bürosoftware. Sie brauchen schnelle Eingaben, klare Nachweise,
            Material im Blick und eine Oberfläche, die auf dem Handy genauso funktioniert wie im Büro.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StoryMetric value="20%" label="Verschnitt vorbereitet" />
            <StoryMetric value="1 App" label="statt Zettel + Chat" />
            <StoryMetric value="mobil" label="für Baustelle und Büro" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {roofStoryCards.map((card, index) => (
            <article
              key={card.title}
              className={cn("bp-image-card bp-reveal min-h-[23rem] sm:min-h-[28rem]", index === 1 && "sm:translate-y-6", index === 2 && "sm:translate-y-12")}
              style={roofImageStyle(card.position)}
            >
              <div className="bp-image-card-content">
                <p className="mb-3 w-fit border border-ocher/40 bg-ocher/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-ocher">
                  {card.label}
                </p>
                <h3 className="text-2xl font-black leading-tight text-white">{card.title}</h3>
                <p className="mt-3 text-sm font-semibold leading-6 text-white/72">{card.text}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WhyBauProSection() {
  return (
    <section id="warum-baupro" className="border-y border-line bg-basalt">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="mb-8 grid gap-5 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="section-kicker">Warum BauPro?</p>
            <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">
              Weil Handwerksbetriebe nicht an Software scheitern sollten.
            </h2>
          </div>
          <p className="text-sm font-semibold leading-7 text-ash sm:text-base">
            BauPro ist für Chefs gebaut, die morgens wissen wollen, wer wo arbeitet, welches Material fehlt,
            welche Berichte offen sind und was der Kunde sehen darf. Ohne Excel-Suche, Chat-Chaos und doppelte Eingaben.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {whyBauProCards.map((item) => (
            <article key={item.title} className="bp-motion-card border border-line bg-surface-container p-5">
              <div className="mb-5 flex h-12 w-12 items-center justify-center border border-ocher/35 bg-ocher/10 text-ocher">
                <item.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <h3 className="text-xl font-black leading-tight text-ink">{item.title}</h3>
              <p className="mt-3 text-sm font-semibold leading-6 text-ash">{item.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeatureGrid({ limit }: { limit?: number }) {
  const features = limit ? marketingFeatures.slice(0, limit) : marketingFeatures;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature, index) => {
        const Icon = featureIconMap[feature.icon];
        return <FeatureCard key={feature.title} icon={Icon} title={feature.title} description={feature.description} index={index + 1} />;
      })}
    </div>
  );
}

export function FeatureCard({ icon: Icon, title, description, index }: { icon: LucideIcon; title: string; description: string; index?: number }) {
  return (
    <article className="group bp-motion-card flex min-h-72 flex-col border border-line bg-surface-container p-5 sm:p-6">
      <div className="mb-8 flex h-12 w-12 items-center justify-center border border-line bg-surface-container-high text-ocher transition group-hover:border-ocher/50 group-hover:bg-ocher group-hover:text-coal">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-xl font-black text-ink">{title}</h3>
      <p className="mt-3 text-sm font-semibold leading-6 text-ash">{description}</p>
      <div className="mt-auto flex items-center justify-between border-t border-line pt-5">
        <span className="text-[11px] font-black uppercase tracking-[0.16em] text-ash">Modul {String(index ?? 1).padStart(2, "0")}</span>
        <ArrowRight className="h-4 w-4 -rotate-45 text-ash transition group-hover:text-ocher" aria-hidden="true" />
      </div>
    </article>
  );
}

export function BenefitSection() {
  return (
    <section id="vorteile" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <SectionIntro kicker="Vorteile" title="Weniger Chaos. Mehr Steuerung." description="BauPro ersetzt keine Fachentscheidung, aber es macht die tägliche Arbeit nachvollziehbarer und schneller erreichbar." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {marketingBenefits.map((benefit) => (
          <div key={benefit} className="bp-motion-card flex min-h-20 items-center gap-3 border border-line bg-surface-container p-4 shadow-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-moss" aria-hidden="true" />
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {marketingWorkflow.map((step, index) => (
          <div key={step} className="bp-motion-card relative border border-line bg-surface-container p-4">
            <p className="text-4xl font-black leading-none text-ocher">{String(index + 1).padStart(2, "0")}</p>
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
            <div key={note.title} className="bp-motion-card border border-line bg-surface-container p-4">
              <LockKeyhole className="mb-3 h-5 w-5 text-moss" aria-hidden="true" />
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
    <section className="border-y border-line bg-basalt">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-14 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
        <div>
          <p className="section-kicker">Tarife</p>
          <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-6xl">
            Klare Pakete statt unklarer Lizenzlogik.
          </h2>
          <p className="mt-4 max-w-2xl text-sm font-semibold leading-7 text-ash">
            Starter, Professional und Business sind als einfache Beispieltarife aufgebaut. So versteht ein Betrieb schnell,
            welche Funktionen für Teamgröße, Kundenportal, KI und Support vorgesehen sind.
          </p>
          <p className="mt-4 max-w-2xl text-xs font-black uppercase tracking-[0.14em] text-ocher">
            Hinweis: Preise sind Beispieltarife, bis Billing und Vertragsunterlagen final produktiv eingerichtet sind.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/pricing" className="btn-primary">
              Tarifseite öffnen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/demo" className="btn-secondary">
              Demo starten
            </Link>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {marketingPlans.map((plan) => (
            <article key={plan.name} className={cn("border border-line bg-surface-container p-4 shadow-soft", plan.highlighted && "border-ocher bg-ocher/10")}>
              <p className="text-sm font-black text-ink">{plan.name}</p>
              <p className="mt-3 text-3xl font-black leading-none text-ocher">{plan.price}</p>
              <p className="mt-2 text-[10px] font-black uppercase tracking-[0.12em] text-ash">{plan.priceNote}</p>
              <p className="mt-3 text-sm font-semibold leading-6 text-ash">{plan.description}</p>
            </article>
          ))}
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
          <article key={item.question} className="bp-motion-card border border-line bg-surface-container p-4 sm:p-5">
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
        <article key={useCase.title} className="bp-motion-card border border-line bg-surface-container p-5">
          <Building2 className="mb-4 h-6 w-6 text-ocher" aria-hidden="true" />
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
        <article key={plan.name} className={cn("border border-line bg-surface-container p-5", plan.highlighted && "border-ocher bg-ocher/10")}>
          <p className="section-kicker">{plan.name}</p>
          <h2 className="mt-3 text-4xl font-black leading-none text-ink">{plan.price}</h2>
          <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-ocher">{plan.priceNote}</p>
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
      <h2 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-ink sm:text-5xl">{title}</h2>
      {description ? <p className="mt-4 text-sm font-semibold leading-7 text-ash sm:text-base">{description}</p> : null}
    </div>
  );
}

export function MarketingPageHeader({ kicker, title, description }: { kicker: string; title: string; description: string }) {
  return (
    <section className="border-b border-line bg-basalt">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <p className="section-kicker">{kicker}</p>
        <h1 className="mt-4 max-w-4xl text-5xl font-extrabold leading-[0.96] tracking-tight text-ink sm:text-7xl">
          {title}
        </h1>
        <p className="mt-5 max-w-3xl text-base font-semibold leading-8 text-ash">{description}</p>
      </div>
    </section>
  );
}

export function MarketingCta() {
  return (
    <section className="bg-ocher px-4 py-16 text-coal sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-8 text-center">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-coal/70">In 2 Minuten sehen, ob es passt</p>
          <h2 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight sm:text-6xl">Demo-Firma öffnen statt Daten eintippen.</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm font-semibold leading-7 text-coal/70">
            Mit vorbereiteten Baustellen, Team, Lager und Berichten erkennst du schneller, ob BauPro zum Betrieb passt.
          </p>
        </div>
        <Link href="/demo" className="mx-auto inline-flex min-h-14 items-center justify-center gap-2 bg-coal px-8 py-4 text-sm font-black uppercase tracking-wide text-ink shadow-lift transition hover:-translate-y-0.5">
          Demo starten
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

function roofImageStyle(position: string) {
  return {
    "--bp-card-image": `url(${heroImageUrl})`,
    "--bp-card-position": position
  } as React.CSSProperties;
}

function StoryMetric({ value, label }: { value: string; label: string }) {
  return (
    <div className="border border-line bg-surface-container-high p-3">
      <p className="text-3xl font-black leading-none text-ocher">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-[0.14em] text-ash">{label}</p>
    </div>
  );
}

function TrustMini({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex items-center gap-3 border border-white/10 bg-white/[0.06] px-3 py-3 backdrop-blur-sm">
      <Icon className="h-5 w-5 text-moss" aria-hidden="true" />
      <span className="text-sm font-black text-ink">{label}</span>
    </div>
  );
}

function PreviewStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-surface-container p-4">
      <p className="text-4xl font-black leading-none text-ocher">{value}</p>
      <p className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-ash">{label}</p>
    </div>
  );
}

function PreviewAction({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="flex min-h-12 items-center gap-3 border border-line bg-coal/55 px-3">
      <Icon className="h-4 w-4 text-ocher" aria-hidden="true" />
      <span className="text-sm font-black text-ink">{label}</span>
    </div>
  );
}

function ProblemSolutionCard({ title, items, tone }: { title: string; items: string[]; tone: "muted" | "strong" }) {
  return (
    <article className={cn("p-5 sm:p-6", tone === "strong" ? "bg-ocher text-coal" : "bg-surface-container text-ink")}>
      <h2 className="text-3xl font-black leading-tight">{title}</h2>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className={cn("flex gap-3 text-sm font-semibold", tone === "strong" ? "text-coal/75" : "text-ash")}>
            <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "strong" ? "text-coal" : "text-moss")} aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
