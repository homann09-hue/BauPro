import Link from "next/link";
import {
  ArrowRight,
  BellPlus,
  CalendarDays,
  Camera,
  ClipboardList,
  Clock3,
  CloudSun,
  ListChecks,
  MapPin,
  Mic2,
  Navigation,
  ShieldAlert,
  Users,
  type LucideIcon
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { cn, formatDate } from "@/lib/utils";
import type { Jobsite } from "@/types/app";

type Tone = "green" | "warning" | "danger" | "info" | "neutral" | "dark";

const toneStyles: Record<Tone, { card: string; icon: string; accent: string }> = {
  green: {
    card: "border-line bg-surface text-ink",
    icon: "bg-primary/15 text-primary",
    accent: "bg-primary"
  },
  warning: {
    card: "border-primary/40 bg-primary/10 text-ink",
    icon: "bg-primary/20 text-primary",
    accent: "bg-warning"
  },
  danger: {
    card: "border-red-500/30 bg-red-950/30 text-red-100",
    icon: "bg-red-500/15 text-red-300",
    accent: "bg-danger"
  },
  info: {
    card: "border-line bg-surface text-ink",
    icon: "bg-white/10 text-info",
    accent: "bg-info"
  },
  neutral: {
    card: "border-line bg-surface text-ink",
    icon: "bg-mint text-slate-300",
    accent: "bg-slate-300"
  },
  dark: {
    card: "border-line bg-coal text-white",
    icon: "bg-white/10 text-white",
    accent: "bg-primary"
  }
};

export function StatCard({
  href,
  icon: Icon,
  label,
  value,
  detail,
  tone = "neutral"
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  value: number | string;
  detail?: string;
  tone?: Tone;
}) {
  const content = (
    <>
      <div className={cn("absolute inset-y-0 left-0 w-1.5", toneStyles[tone].accent)} />
      <div className="flex items-center gap-3">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center border border-line", toneStyles[tone].icon)}>
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className={cn("text-4xl font-normal leading-none [font-family:var(--font-display)]", tone === "dark" ? "text-white" : "text-ink")}>{value}</p>
          <p className={cn("text-sm font-black", tone === "dark" ? "text-white/80" : "text-slate-600")}>{label}</p>
          {detail ? <p className={cn("mt-1 text-xs font-semibold", tone === "dark" ? "text-white/60" : "text-slate-500")}>{detail}</p> : null}
        </div>
      </div>
    </>
  );

  const className = cn(
    "construction-rail min-h-28 border p-4 pl-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lift focus:outline-none focus:ring-4 focus:ring-primary/15",
    toneStyles[tone].card
  );

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function QuickActionButton({
  href,
  icon: Icon,
  title,
  description,
  primary = false
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description?: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-h-28 flex-col justify-between border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lift focus:outline-none focus:ring-4 focus:ring-primary/15 active:translate-y-0",
        primary
          ? "border-primary-dark bg-primary text-white hover:bg-primary-dark"
          : "border-line bg-surface text-ink hover:border-primary/45 hover:bg-mint"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={cn("flex h-10 w-10 items-center justify-center border border-line", primary ? "bg-white/15 text-white" : "bg-mint text-primary")}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowRight className={cn("h-4 w-4 transition group-hover:translate-x-0.5", primary ? "text-white/70" : "text-primary")} aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-normal uppercase leading-none tracking-wide [font-family:var(--font-display)]">{title}</p>
        {description ? <p className={cn("mt-1 text-sm", primary ? "text-white/75" : "text-slate-500")}>{description}</p> : null}
      </div>
    </Link>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  actionHref,
  actionLabel
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-2 inline-flex items-center gap-2 border border-line bg-mint px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-primary">
            <span className="h-1.5 w-1.5 rotate-45 bg-primary" aria-hidden="true" />
            {eyebrow}
          </p>
        ) : null}
        <h2 className="section-title">{title}</h2>
        {description ? <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {actionHref && actionLabel ? (
        <Link href={actionHref} className="btn-secondary w-full sm:w-auto">
          {actionLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}

export function TodayJobsiteFocus({
  jobsite,
  roleLabel
}: {
  jobsite?: Jobsite;
  roleLabel: string;
}) {
  if (!jobsite) {
    return (
      <section className="role-surface">
        <SectionHeader
          eyebrow={roleLabel}
          title="Heute keine Baustelle zugeordnet"
          description="Wenn du heute eingesetzt bist, aktualisiert Chef oder Vorarbeiter die Zuordnung. Du kannst trotzdem Zeiten, Materialmeldungen oder Berichte vorbereiten."
        />
        <div className="mobile-touch-grid">
          <QuickActionButton href="/time/new" icon={Clock3} title="Zeit erfassen" description="Manuell eintragen" primary />
          <QuickActionButton href="/material-melden" icon={BellPlus} title="Material fehlt" description="Schnell melden" />
          <QuickActionButton href="/berichte/neu" icon={ClipboardList} title="Bericht schreiben" description="Dokumentieren" />
        </div>
      </section>
    );
  }

  const mapsQuery = jobsite.latitude && jobsite.longitude ? `${jobsite.latitude},${jobsite.longitude}` : jobsite.address;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
  const weatherText =
    jobsite.latitude && jobsite.longitude
      ? "Wettervorschlag wird beim Bericht passend zur Baustelle gespeichert."
      : "Adresse ist da. Koordinaten fehlen noch, Wetter kann notfalls manuell ergänzt werden.";

  return (
    <section className="overflow-hidden border border-line bg-surface shadow-lift">
      <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="construction-rail p-5 pl-6 sm:p-6 sm:pl-7">
          <p className="section-kicker">{roleLabel}</p>
          <h2 className="mt-2 text-4xl font-normal uppercase leading-none tracking-wide text-ink [font-family:var(--font-display)] sm:text-5xl">Heute: {jobsite.name}</h2>
          <p className="mt-2 text-sm font-bold text-ash">{jobsite.customer}</p>
          <p className="mt-3 flex items-start gap-2 text-sm leading-6 text-ash">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            {jobsite.address}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Link href={`/baustellen/${jobsite.id}`} className="btn-primary w-full sm:w-auto">
              Baustelle öffnen
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <a href={mapsHref} target="_blank" rel="noreferrer" className="btn-secondary w-full sm:w-auto">
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Navigation starten
            </a>
            <Link href="/bring-lists" className="btn-secondary w-full sm:w-auto">
              Mitbringliste
            </Link>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ConstructionHint icon={CloudSun} title="Wetter" text={weatherText} />
            <ConstructionHint icon={ListChecks} title="Mitbringen" text="Material, Werkzeug und Hinweise für morgen direkt prüfen." />
            <ConstructionHint icon={ShieldAlert} title="Nachweis" text="Fotos, Mängel und Besonderheiten direkt im Bericht sichern." />
          </div>
        </div>
        <div className="border-t border-line bg-mint p-4 sm:p-5 lg:border-l lg:border-t-0">
          <p className="mb-3 text-xs font-black uppercase tracking-normal text-slate-500">Baustellenmodus</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <QuickActionButton href="/time/new" icon={Clock3} title="Arbeit starten" description="Zeit erfassen" primary />
            <QuickActionButton href="/berichte/neu" icon={Mic2} title="Bericht sprechen" description="Text oder Sprache" />
            <QuickActionButton href="/berichte/neu" icon={Camera} title="Foto hochladen" description="Nachweis sichern" />
            <QuickActionButton href="/material-melden" icon={BellPlus} title="Material fehlt" description="Chef warnen" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ConstructionHint({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <div className="min-h-24 border border-line bg-coal p-3 text-ink shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-line bg-surface text-primary">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-sm font-black text-ink">{title}</p>
      </div>
      <p className="mt-2 text-xs font-semibold leading-5 text-ash">{text}</p>
    </div>
  );
}

export function JobsiteCard({ jobsite, canManage = false }: { jobsite: Jobsite; canManage?: boolean }) {
  return (
    <article className="construction-rail border border-line bg-surface shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lift">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-black text-ink">{jobsite.name}</h2>
            <p className="mt-1 text-sm font-bold text-ash">{jobsite.customer}</p>
            <p className="mt-2 flex items-start gap-2 text-sm text-ash">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
              {jobsite.address}
            </p>
          </div>
          <StatusBadge value={jobsite.status} />
        </div>

        <div className="mt-5 grid gap-2 text-sm text-ash sm:grid-cols-2">
          <div className="border border-line bg-mint p-3">
            <p className="meta-label">Start</p>
            <p className="mt-1 flex items-center gap-2 font-black text-ink">
              <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
              {formatDate(jobsite.start_date)}
            </p>
          </div>
          <div className="border border-line bg-mint p-3">
            <p className="meta-label">Team</p>
            <p className="mt-1 flex items-center gap-2 font-black text-ink">
              <Users className="h-4 w-4 text-primary" aria-hidden="true" />
              {jobsite.assigned_employee_ids?.length ?? 0} Mitarbeiter
            </p>
          </div>
        </div>

        {jobsite.notes ? (
          <p className="mt-3 line-clamp-3 border border-line bg-surface p-3 text-sm text-ash">{jobsite.notes}</p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Link href={`/baustellen/${jobsite.id}`} className="btn-primary w-full sm:w-auto">
            Öffnen
          </Link>
          <Link href="/berichte/neu" className="btn-secondary w-full sm:w-auto">
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Tagesbericht
          </Link>
          {canManage ? (
            <Link href={`/baustellen/${jobsite.id}/bearbeiten`} className="btn-secondary w-full sm:w-auto">
              Bearbeiten
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function AlertCard({
  icon: Icon,
  title,
  description,
  meta,
  tone = "warning",
  action
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  meta?: string;
  tone?: Tone;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("border p-4 shadow-sm", toneStyles[tone].card)}>
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center border border-line", toneStyles[tone].icon)}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black">{title}</p>
          {description ? <p className="mt-1 text-sm leading-6 text-ash">{description}</p> : null}
          {meta ? <p className="mt-2 text-xs font-bold text-slate-500">{meta}</p> : null}
          {action ? <div className="mt-3">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function FormSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="form-step-card">
      <div className="mb-4">
        <p className="section-kicker">Eingabe</p>
        <h2 className="section-title">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function ResponsiveTableCard({
  title,
  meta,
  children
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-line bg-surface p-4 shadow-sm transition hover:border-primary/45 hover:shadow-soft">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-black text-ink">{title}</p>
          {meta ? <p className="mt-1 text-xs font-bold text-slate-500">{meta}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

export function FloatingActionButton({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex min-h-14 items-center justify-center gap-2 bg-primary px-4 text-sm font-black text-white shadow-lift transition hover:-translate-y-0.5 hover:bg-primary-dark lg:hidden"
      aria-label={label}
      title={label}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
