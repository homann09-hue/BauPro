import Link from "next/link";
import { Building2, CheckCircle2, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth-actions";
import { getInitials } from "@/lib/utils";
import type { AppContext } from "@/lib/auth";
import { NavLink } from "@/components/nav-link";
import { VoiceDictation } from "@/components/voice-dictation";

type NavItem = React.ComponentProps<typeof NavLink>;

const managerNavGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Betrieb",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
      { href: "/ai-assistant", label: "KI fragen", icon: "ki" },
      { href: "/ai/job-wizard", label: "KI Auftrag", icon: "auftraege" },
      { href: "/customers", label: "Kunden", icon: "kunden" },
      { href: "/orders", label: "Aufträge", icon: "auftraege" },
      { href: "/calendar", label: "Kalender", icon: "kalender" }
    ]
  },
  {
    label: "Material",
    items: [
      { href: "/materials/catalog", label: "Material", icon: "material" },
      { href: "/materials/inventory", label: "Lager", icon: "lager" },
      { href: "/bring-lists", label: "Mitbringlisten", icon: "mitbringen" },
      { href: "/materials/live-offers", label: "Preisquellen", icon: "lieferanten" }
    ]
  },
  {
    label: "Team und Verwaltung",
    items: [
      { href: "/team", label: "Mitarbeiter", icon: "team" },
      { href: "/time-tracking", label: "Zeiterfassung", icon: "zeiten" },
      { href: "/time-tracking/reports", label: "Stundenzettel", icon: "stundenzettel" },
      { href: "/billing", label: "Angebote/Rechnungen", icon: "angebote" },
      { href: "/privacy", label: "Datenschutz", icon: "datenschutz" },
      { href: "/settings", label: "Einstellungen", icon: "einstellungen" }
    ]
  }
];

const employeeNavGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Mein Arbeitstag",
    items: [
      { href: "/baustellen", label: "Meine Baustellen", icon: "baustellen" },
      { href: "/ai-assistant", label: "KI fragen", icon: "ki" },
      { href: "/time-tracking", label: "Meine Zeiten", icon: "zeiten" },
      { href: "/bring-lists", label: "Mitbringlisten", icon: "mitbringen" },
      { href: "/material-melden", label: "Material melden", icon: "materialMelden" },
      { href: "/berichte", label: "Tagesberichte", icon: "berichte" },
      { href: "/privacy", label: "Datenschutz", icon: "datenschutz" },
      { href: "/profile", label: "Profil", icon: "profil" }
    ]
  }
];

const roleLabels = {
  admin: "Admin",
  chef: "Chef",
  vorarbeiter: "Vorarbeiter",
  mitarbeiter: "Mitarbeiter"
} as const;

export function AppShell({
  context,
  children
}: {
  context: AppContext;
  children: React.ReactNode;
}) {
  const navGroups = context.canManage ? managerNavGroups : employeeNavGroups;
  const mobileNav = navGroups.flatMap((group) => group.items);
  const roleLabel = roleLabels[context.profile.role];

  return (
    <div className="min-h-screen bg-fog">
      <aside className="fixed inset-y-0 left-0 z-20 hidden border-r border-white/70 bg-white/85 px-4 py-5 shadow-soft backdrop-blur-xl lg:flex lg:w-80 lg:flex-col">
        <div className="mb-4 rounded-lg bg-ink p-3 text-white shadow-lift">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-white/10 text-white ring-1 ring-white/20">
              <Building2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-white">BauPro</p>
              <p className="truncate text-sm text-white/70">{context.companyName}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white/80">
              <Sparkles className="h-4 w-4 text-signal" aria-hidden="true" />
              Betriebszentrale
            </div>
            <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold text-white/80">
              <ShieldCheck className="h-4 w-4 text-mint" aria-hidden="true" />
              {roleLabel}
            </div>
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-emerald-100 bg-emerald-50/80 p-3 text-sm text-emerald-900">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="font-semibold">
              {context.canManage
                ? "Preise, Team und Einstellungen sind nur fuer Chef/Admin sichtbar."
                : context.profile.role === "vorarbeiter"
                  ? "Du siehst deine zugeordneten Baustellen, Zeiten, Berichte, Packlisten und Materialmeldungen ohne Preisdetails."
                : "Du siehst nur Baustellen, Zeiten, Berichte und Packlisten fuer deinen Einsatz."}
            </p>
          </div>
        </div>

        <nav className="space-y-4 overflow-y-auto rounded-lg border border-white/70 bg-white/70 p-2 shadow-sm">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1 pt-2 text-[11px] font-black uppercase tracking-normal text-slate-400">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-auto rounded-lg border border-white/80 bg-white/75 p-3 shadow-sm">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mint text-sm font-bold text-moss">
              {getInitials(context.profile.full_name, context.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">
                {context.profile.full_name || context.email}
              </p>
              <p className="text-xs text-slate-500">{roleLabels[context.profile.role]}</p>
            </div>
          </div>
          <form action={signOutAction}>
            <button className="btn-secondary w-full" type="submit">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Abmelden
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <Link href="/legal/datenschutz" className="hover:text-moss">
              Datenschutz
            </Link>
            <Link href="/legal/impressum" className="hover:text-moss">
              Impressum
            </Link>
            <Link href="/legal/agb" className="hover:text-moss">
              AGB
            </Link>
          </div>
        </div>
      </aside>

      <main className="pb-28 lg:ml-80 lg:pb-0">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>

      <VoiceDictation />

      <Link
        href="/ai-assistant"
        className="fixed bottom-24 right-20 z-40 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-moss px-4 text-sm font-black text-white shadow-lift transition hover:-translate-y-0.5 lg:bottom-6 lg:right-24"
        aria-label="KI fragen"
        title="KI fragen"
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" />
        <span>KI fragen</span>
      </Link>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/80 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-16px_40px_rgba(23,33,27,0.12)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-3xl gap-1 overflow-x-auto pb-1">
          {mobileNav.map((item) => (
            <NavLink key={item.href} {...item} variant="mobile" />
          ))}
        </div>
      </nav>
    </div>
  );
}
