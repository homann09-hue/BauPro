import Link from "next/link";
import { ArrowRight, BellPlus, BriefcaseBusiness, Building2, CheckCircle2, Cog, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth-actions";
import { getInitials } from "@/lib/utils";
import type { AppContext } from "@/lib/auth";
import { FloatingActionButton } from "@/components/construction-ui";
import { NavLink } from "@/components/nav-link";
import { VoiceDictation } from "@/components/voice-dictation";

type NavItem = Omit<React.ComponentProps<typeof NavLink>, "variant">;

const managerPrimaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/baustellen", label: "Baustellen", icon: "baustellen" },
  { href: "/berichte", label: "Berichte", icon: "berichte" },
  { href: "/materials", label: "Material", icon: "material" },
  { href: "/team", label: "Team", icon: "team" },
  { href: "/settings", label: "Einstellungen", icon: "einstellungen" }
];

const managerQuickLinks: NavItem[] = [
  { href: "/customers", label: "Kunden", icon: "kunden" },
  { href: "/orders", label: "Aufträge", icon: "auftraege" },
  { href: "/calendar", label: "Kalender", icon: "kalender" },
  { href: "/bring-lists", label: "Mitbringlisten", icon: "mitbringen" },
  { href: "/time-tracking", label: "Zeiterfassung", icon: "zeiten" },
  { href: "/time-tracking/reports", label: "Stundenzettel", icon: "stundenzettel" },
  { href: "/materials/live-offers", label: "Preisquellen", icon: "lieferanten" },
  { href: "/billing", label: "Angebote/Rechnungen", icon: "angebote" },
  { href: "/ai/job-wizard", label: "KI Auftrag", icon: "ki" },
  { href: "/privacy", label: "Datenschutz", icon: "datenschutz" }
];

const foremanPrimaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/baustellen", label: "Baustellen", icon: "baustellen" },
  { href: "/berichte", label: "Berichte", icon: "berichte" },
  { href: "/bring-lists", label: "Mitbringen", icon: "mitbringen" },
  { href: "/time-tracking", label: "Zeiten", icon: "zeiten" },
  { href: "/profile", label: "Profil", icon: "profil" }
];

const employeePrimaryNav: NavItem[] = [
  { href: "/dashboard", label: "Heute", icon: "dashboard" },
  { href: "/baustellen", label: "Baustellen", icon: "baustellen" },
  { href: "/berichte", label: "Berichte", icon: "berichte" },
  { href: "/bring-lists", label: "Mitbringen", icon: "mitbringen" },
  { href: "/time-tracking", label: "Zeiten", icon: "zeiten" },
  { href: "/profile", label: "Profil", icon: "profil" }
];

const employeeQuickLinks: NavItem[] = [
  { href: "/material-melden", label: "Material melden", icon: "materialMelden" },
  { href: "/ai-assistant", label: "KI fragen", icon: "ki" },
  { href: "/privacy", label: "Datenschutz", icon: "datenschutz" }
];

const roleLabels = {
  admin: "Admin",
  chef: "Chef",
  vorarbeiter: "Vorarbeiter",
  mitarbeiter: "Mitarbeiter"
} as const;

function getShellNavigation(context: AppContext) {
  if (context.canManage) {
    return {
      primaryNav: managerPrimaryNav,
      mobileNav: managerPrimaryNav.slice(0, 5),
      quickLinks: managerQuickLinks,
      floatingAction: { href: "/orders/new", label: "Auftrag", icon: BriefcaseBusiness },
      notice: "Chef/Admin sieht Preise, Team, Einstellungen und operative Schnellzugriffe."
    };
  }

  if (context.profile.role === "vorarbeiter") {
    return {
      primaryNav: foremanPrimaryNav,
      mobileNav: foremanPrimaryNav.filter((item) => item.href !== "/profile").slice(0, 5),
      quickLinks: employeeQuickLinks,
      floatingAction: { href: "/material-melden", label: "Material fehlt", icon: BellPlus },
      notice: "Vorarbeiter sieht operative Baustellen, Zeiten, Berichte und Mitbringlisten ohne Preisdetails."
    };
  }

  return {
    primaryNav: employeePrimaryNav,
    mobileNav: employeePrimaryNav.filter((item) => item.href !== "/profile").slice(0, 5),
    quickLinks: employeeQuickLinks,
    floatingAction: { href: "/material-melden", label: "Material fehlt", icon: BellPlus },
    notice: "Mitarbeiter sieht nur zugeordnete Baustellen, eigene Zeiten, Berichte und Mitbringlisten."
  };
}

export function AppShell({
  context,
  children
}: {
  context: AppContext;
  children: React.ReactNode;
}) {
  const { primaryNav, mobileNav, quickLinks, floatingAction, notice } = getShellNavigation(context);
  const roleLabel = roleLabels[context.profile.role];

  return (
    <div className="min-h-screen bg-fog text-ink">
      <aside className="fixed inset-y-0 left-0 z-20 hidden border-r border-slate-800 bg-anthracite px-4 py-5 shadow-lift lg:flex lg:w-80 lg:flex-col">
        <div className="mb-4 rounded-lg border border-white/10 bg-slate-900 p-4 text-white shadow-lift">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-primary text-white ring-1 ring-white/20">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-white">BauPro</p>
              <p className="truncate text-sm font-semibold text-white/70">{context.companyName}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-white/80">
            <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
              <Sparkles className="h-4 w-4 text-signal" aria-hidden="true" />
              Einsatzbereit
            </div>
            <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-mint" aria-hidden="true" />
              {roleLabel}
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-white">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
            <p className="font-semibold">{notice}</p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pb-4">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-2 shadow-sm">
            <p className="px-3 pb-2 pt-1 text-[11px] font-black uppercase tracking-normal text-slate-500">
              Hauptbereiche
            </p>
            <div className="space-y-1">
              {primaryNav.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] p-3 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-normal text-slate-500">Schnellzugriff</p>
              <span className="text-[11px] font-bold text-mint">sichtbar</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map((item) => (
                <QuickAccessLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        </nav>

        <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.04] p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
              {getInitials(context.profile.full_name, context.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {context.profile.full_name || context.email}
              </p>
              <p className="text-xs text-slate-400">{roleLabels[context.profile.role]}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <button className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/15" type="submit">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Abmelden
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-400">
            <Link href="/legal/datenschutz" className="hover:text-white">
              Datenschutz
            </Link>
            <Link href="/legal/impressum" className="hover:text-white">
              Impressum
            </Link>
            <Link href="/legal/agb" className="hover:text-white">
              AGB
            </Link>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-line bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-anthracite text-white">
              <Building2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-ink">BauPro</p>
              <p className="truncate text-xs font-bold text-slate-500">{context.companyName}</p>
            </div>
          </div>
          <Link href={context.canManage ? "/settings" : "/profile"} className="flex h-11 w-11 items-center justify-center rounded-md border border-line bg-white text-ink shadow-sm" aria-label={context.canManage ? "Einstellungen" : "Profil"}>
            <Cog className="h-5 w-5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="pb-32 lg:ml-80 lg:pb-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      <VoiceDictation />

      <Link
        href="/ai-assistant"
        className="fixed bottom-6 right-24 z-40 hidden min-h-14 items-center justify-center gap-2 rounded-md bg-anthracite px-4 text-sm font-black text-white shadow-lift transition hover:-translate-y-0.5 hover:bg-slate-800 lg:inline-flex"
        aria-label="KI fragen"
        title="KI fragen"
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" />
        <span>KI fragen</span>
      </Link>

      <FloatingActionButton href={floatingAction.href} icon={floatingAction.icon} label={floatingAction.label} />

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-16px_40px_rgba(23,33,27,0.12)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-5 gap-1 pb-1">
          {mobileNav.map((item) => (
            <NavLink key={item.href} {...item} variant="mobile" />
          ))}
        </div>
      </nav>
    </div>
  );
}

function QuickAccessLink({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      className="group flex min-h-12 items-center justify-between gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-white/15"
    >
      <span className="line-clamp-2">{item.label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-mint transition group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
