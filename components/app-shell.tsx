import Link from "next/link";
import {
  ArrowRight,
  BellPlus,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  type LucideIcon
} from "lucide-react";
import { getInitials } from "@/lib/utils";
import type { AppContext } from "@/lib/auth";
import { AppTopBar } from "@/components/app-top-bar";
import { CommandPalette, type CommandIconKey, type CommandPaletteAction } from "@/components/command-palette";
import { NavLink } from "@/components/nav-link";
import { PredictivePrefetch } from "@/components/performance/PredictivePrefetch";
import { VoiceDictation } from "@/components/voice-dictation";
import { hasAppPermission, type PermissionKey } from "@/lib/permissions";
import { DEMO_COMPANY_NAME } from "@/lib/demo/constants";

type NavItem = Omit<React.ComponentProps<typeof NavLink>, "variant">;

const adminPrimaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/team", label: "Benutzer", icon: "team" },
  { href: "/settings", label: "System", icon: "einstellungen" },
  { href: "/billing", label: "Abrechnung", icon: "angebote" },
  { href: "/suppliers", label: "Integrationen", icon: "lieferanten" },
  { href: "/privacy", label: "DSGVO", icon: "datenschutz" }
];

const adminQuickLinks: NavItem[] = [
  { href: "/onboarding", label: "Startassistent", icon: "onboarding" },
  { href: "/team", label: "Rollen/Rechte", icon: "team" },
  { href: "/settings/security", label: "Sicherheit & 2FA", icon: "datenschutz" },
  { href: "/debug/system", label: "Systemstatus", icon: "einstellungen" },
  { href: "/billing", label: "Lizenz & Abo", icon: "angebote" },
  { href: "/suppliers", label: "API & Lieferanten", icon: "lieferanten" },
  { href: "/privacy", label: "Datenschutz", icon: "datenschutz" },
  { href: "/hilfe", label: "Hilfe", icon: "datenschutz" }
];

const chefPrimaryNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/baustellen", label: "Baustellen", icon: "baustellen" },
  { href: "/plantafel", label: "Plantafel", icon: "plantafel" },
  { href: "/berichte", label: "Berichte", icon: "berichte" },
  { href: "/materials", label: "Material", icon: "material" },
  { href: "/calendar", label: "Kalender", icon: "kalender" }
];

const chefQuickLinks: NavItem[] = [
  { href: "/onboarding", label: "Startassistent", icon: "onboarding" },
  { href: "/customers", label: "Kunden", icon: "kunden" },
  { href: "/orders", label: "Aufträge", icon: "auftraege" },
  { href: "/fahrzeuge", label: "Fahrzeuge/Geräte", icon: "fahrzeuge" },
  { href: "/checklists", label: "Checklisten", icon: "checklisten" },
  { href: "/maengel", label: "Mängel", icon: "maengel" },
  { href: "/bring-lists", label: "Mitbringlisten", icon: "mitbringen" },
  { href: "/materials/control-center", label: "Lager-Zentrale", icon: "material" },
  { href: "/time-tracking", label: "Zeiterfassung", icon: "zeiten" },
  { href: "/time-tracking/daily", label: "Tagesstunden", icon: "zeiten" },
  { href: "/time-tracking/reports", label: "Stundenzettel", icon: "stundenzettel" },
  { href: "/materials/live-offers", label: "Lieferantenpreise", icon: "lieferanten" },
  { href: "/invoices", label: "Angebote/Rechnungen", icon: "angebote" },
  { href: "/ai/job-wizard", label: "Auftrag per KI", icon: "ki" },
  { href: "/hilfe", label: "Hilfe", icon: "datenschutz" }
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
  { href: "/checklists", label: "Checklisten", icon: "checklisten" },
  { href: "/maengel", label: "Mängel", icon: "maengel" },
  { href: "/material-melden", label: "Material melden", icon: "materialMelden" },
  { href: "/ai-assistant", label: "KI fragen", icon: "ki" },
  { href: "/privacy", label: "Datenschutz", icon: "datenschutz" },
  { href: "/hilfe", label: "Hilfe", icon: "datenschutz" }
];

const permissionQuickLinks: Array<NavItem & { permission: PermissionKey }> = [
  { href: "/orders", label: "Aufträge", icon: "auftraege", permission: "orders.view" },
  { href: "/customers", label: "Kunden", icon: "kunden", permission: "customers.view" },
  { href: "/invoices", label: "Angebote", icon: "angebote", permission: "quotes.view" },
  { href: "/materials/inventory", label: "Lager", icon: "material", permission: "inventory.view" },
  { href: "/time-tracking/daily", label: "Tagesstunden", icon: "zeiten", permission: "time.team.view" },
  { href: "/fahrzeuge", label: "Fahrzeuge/Geräte", icon: "fahrzeuge", permission: "vehicles.manage" },
  { href: "/settings", label: "Einstellungen", icon: "einstellungen", permission: "settings.edit" }
];

const roleLabels = {
  admin: "Systemadmin",
  chef: "Chef",
  vorarbeiter: "Vorarbeiter",
  mitarbeiter: "Mitarbeiter",
  kunde: "Kunde"
} as const;

type MobileAction = {
  href: string;
  label: string;
  icon: LucideIcon;
  primary?: boolean;
};

type CommandActionInput = Omit<CommandPaletteAction, "keywords"> & {
  keywords?: string[];
};

function navIconToCommandIcon(icon: NavItem["icon"]): CommandIconKey {
  const mappedIcons: Partial<Record<NavItem["icon"], CommandIconKey>> = {
    datenschutz: "sicherheit",
    lieferanten: "material",
    materialMelden: "material",
    onboarding: "ki",
    plantafel: "kalender",
    profil: "kunden",
    stundenzettel: "zeiten"
  };

  return mappedIcons[icon] ?? (icon as CommandIconKey);
}

function getShellNavigation(context: AppContext) {
  const can = (permission: PermissionKey) => hasAppPermission(context.profile.role, context.permissions, permission);
  const permittedQuickLinks = permissionQuickLinks
    .filter((item) => can(item.permission))
    .map((item) => ({ href: item.href, label: item.label, icon: item.icon }));

  if (context.isAdmin) {
    return {
      primaryNav: adminPrimaryNav,
      mobileNav: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/team", label: "Benutzer", icon: "team" },
        { href: "/settings", label: "System", icon: "einstellungen" },
        { href: "/billing", label: "Abo", icon: "angebote" },
        { href: "/suppliers", label: "API", icon: "lieferanten" },
        { href: "/mehr", label: "Mehr", icon: "mehr" }
      ].filter(Boolean) as NavItem[],
      quickLinks: adminQuickLinks,
      mobileActions: [
        { href: "/team", label: "Benutzer", icon: Users, primary: true },
        { href: "/settings/security", label: "2FA", icon: ShieldCheck },
        { href: "/settings", label: "Setup", icon: Settings }
      ] satisfies MobileAction[],
      notice: "Systemadmin verwaltet firmenübergreifend Benutzer, Rechte, Abrechnung, Integrationen und Sicherheit."
    };
  }

  if (context.isChef) {
    return {
      primaryNav: chefPrimaryNav,
      mobileNav: [
        { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
        { href: "/baustellen", label: "Baustellen", icon: "baustellen" },
        { href: "/time-tracking/daily", label: "Zeiten", icon: "zeiten" },
        { href: "/berichte", label: "Berichte", icon: "berichte" },
        { href: "/materials/inventory", label: "Lager", icon: "lager" },
        { href: "/mehr", label: "Mehr", icon: "mehr" }
      ].filter(Boolean) as NavItem[],
      quickLinks: chefQuickLinks,
      mobileActions: [
        { href: "/orders/new", label: "Auftrag", icon: BriefcaseBusiness, primary: true },
        { href: "/time-tracking/daily", label: "Zeiten", icon: Clock3 },
        { href: "/materials/inventory", label: "Lager", icon: ClipboardList }
      ] satisfies MobileAction[],
      notice: "Chef steuert Baustellen, Aufträge, Material, Team-Einsatz, Zeiten, Angebote und Rechnungen."
    };
  }

  if (context.profile.role === "vorarbeiter") {
    return {
      primaryNav: foremanPrimaryNav,
      mobileNav: [
        { href: "/dashboard", label: "Heute", icon: "dashboard" },
        { href: "/baustellen", label: "Baustellen", icon: "baustellen" },
        { href: "/time-tracking", label: "Zeiten", icon: "zeiten" },
        { href: "/material-melden", label: "Material", icon: "materialMelden" },
        { href: "/berichte", label: "Berichte", icon: "berichte" }
      ].filter(Boolean) as NavItem[],
      quickLinks: [...permittedQuickLinks, ...employeeQuickLinks],
      mobileActions: [
        { href: "/time/new", label: "Zeit", icon: Clock3, primary: true },
        { href: "/berichte/neu", label: "Foto", icon: Camera },
        { href: "/bring-lists", label: "Mitbringen", icon: ClipboardList }
      ] satisfies MobileAction[],
      notice: "Vorarbeiter sieht operative Baustellen, Zeiten, Berichte und Mitbringlisten ohne Preisdetails."
    };
  }

  return {
    primaryNav: employeePrimaryNav,
    mobileNav: [
      { href: "/dashboard", label: "Heute", icon: "dashboard" },
      { href: "/baustellen", label: "Baustellen", icon: "baustellen" },
      { href: "/time-tracking", label: "Zeiten", icon: "zeiten" },
      { href: "/material-melden", label: "Material", icon: "materialMelden" },
      { href: "/berichte", label: "Berichte", icon: "berichte" }
    ].filter(Boolean) as NavItem[],
    quickLinks: [...permittedQuickLinks, ...employeeQuickLinks],
    mobileActions: [
      { href: "/time/new", label: "Zeit", icon: Clock3, primary: true },
      { href: "/berichte/neu", label: "Foto", icon: Camera },
      { href: "/material-melden", label: "Material", icon: BellPlus }
    ] satisfies MobileAction[],
    notice: "Mitarbeiter sieht nur zugeordnete Baustellen, eigene Zeiten, Berichte und Mitbringlisten."
  };
}

function commandAction(action: CommandActionInput): CommandPaletteAction {
  return {
    ...action,
    keywords: action.keywords ?? [action.label, action.description, action.group]
  };
}

function quickLinkCommand(item: NavItem): CommandPaletteAction {
  return commandAction({
    href: item.href,
    label: item.label,
    description: "Direkt zu diesem Bereich springen.",
    group: "Navigation",
    icon: navIconToCommandIcon(item.icon)
  });
}

function uniqueCommandActions(actions: CommandPaletteAction[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = `${action.href}:${action.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getCommandPaletteActions(context: AppContext, quickLinks: NavItem[]): CommandPaletteAction[] {
  const common = [
    commandAction({
      href: "/dashboard",
      label: context.isChef ? "Betriebsdashboard öffnen" : "Heute öffnen",
      description: "Zur wichtigsten Übersicht für deinen aktuellen Arbeitstag.",
      group: "Start",
      icon: "dashboard",
      primary: true,
      keywords: ["dashboard", "heute", "start", "übersicht", "uebersicht"]
    }),
    commandAction({
      href: "/hilfe",
      label: "Hilfe öffnen",
      description: "Anleitungen und Hilfetexte für BauPro öffnen.",
      group: "Hilfe",
      icon: "hilfe",
      keywords: ["hilfe", "support", "frage", "anleitung"]
    })
  ];

  if (context.isAdmin) {
    return uniqueCommandActions([
      ...common,
      commandAction({
        href: "/team",
        label: "Benutzer und Rollen verwalten",
        description: "Systemadmin-Bereich für Benutzer, Rollen und Rechte.",
        group: "System",
        icon: "team",
        primary: true,
        keywords: ["benutzer", "rollen", "rechte", "admin", "team"]
      }),
      commandAction({
        href: "/settings/security",
        label: "Sicherheit und 2FA prüfen",
        description: "Sicherheitsoptionen und Zwei-Faktor-Authentifizierung öffnen.",
        group: "System",
        icon: "sicherheit",
        keywords: ["sicherheit", "2fa", "mfa", "admin"]
      }),
      commandAction({
        href: "/debug/system",
        label: "Systemstatus öffnen",
        description: "Supabase, Profil, Firma und Tabellenstatus prüfen.",
        group: "System",
        icon: "einstellungen",
        keywords: ["debug", "system", "status", "supabase"]
      }),
      commandAction({
        href: "/billing",
        label: "Lizenz und Abrechnung öffnen",
        description: "Tarif, Nutzerlimit und Abonnement verwalten.",
        group: "Abrechnung",
        icon: "angebote",
        keywords: ["billing", "abo", "lizenz", "stripe"]
      }),
      ...quickLinks.map(quickLinkCommand)
    ]);
  }

  if (context.isChef) {
    return uniqueCommandActions([
      ...common,
      commandAction({
        href: "/orders/new",
        label: "Neuen Auftrag erstellen",
        description: "Kunde, Baustelle, Aufmaß und Kalkulation erfassen.",
        group: "Aufträge",
        icon: "auftraege",
        primary: true,
        keywords: ["auftrag", "neu", "angebot", "kalkulation", "aufmaß", "aufmass"]
      }),
      commandAction({
        href: "/customers/new",
        label: "Neuen Kunden anlegen",
        description: "Kundendaten und Baustellenadresse schnell erfassen.",
        group: "Kunden",
        icon: "kunden",
        keywords: ["kunde", "neu", "adresse"]
      }),
      commandAction({
        href: "/baustellen/neu",
        label: "Neue Baustelle anlegen",
        description: "Baustelle mit Adresse, Status und Notizen erstellen.",
        group: "Baustellen",
        icon: "baustellen",
        keywords: ["baustelle", "neu", "adresse"]
      }),
      commandAction({
        href: "/time-tracking/daily",
        label: "Tagesstunden prüfen",
        description: "Heutige Zeiten je Mitarbeiter prüfen und freigeben.",
        group: "Zeiten",
        icon: "zeiten",
        keywords: ["zeit", "stunden", "freigabe", "tagesstunden"]
      }),
      commandAction({
        href: "/materials/control-center",
        label: "Lager-Zentrale öffnen",
        description: "Fehlmengen, Reservierungen und Bestände kontrollieren.",
        group: "Material",
        icon: "lager",
        keywords: ["lager", "material", "fehlmenge", "bestand"]
      }),
      commandAction({
        href: "/ai/job-wizard",
        label: "Auftrag per KI vorbereiten",
        description: "Text oder Sprache in Auftragsentwurf und Materialbedarf umwandeln.",
        group: "KI",
        icon: "ki",
        keywords: ["ki", "sprache", "auftrag", "materialbedarf"]
      }),
      ...quickLinks.map(quickLinkCommand)
    ]);
  }

  return uniqueCommandActions([
    ...common,
    commandAction({
      href: "/time/new",
      label: "Arbeitszeit eintragen",
      description: "Heute, Baustelle, Start, Ende und Pause erfassen.",
      group: "Baustelle",
      icon: "zeiten",
      primary: true,
      keywords: ["zeit", "stunden", "arbeitszeit", "heute"]
    }),
    commandAction({
      href: "/berichte/neu",
      label: "Tagesbericht schreiben",
      description: "Arbeiten, Fotos, Wetter, Material und Besonderheiten dokumentieren.",
      group: "Baustelle",
      icon: "berichte",
      keywords: ["bericht", "foto", "tagesbericht", "dokumentieren"]
    }),
    commandAction({
      href: "/material-melden",
      label: "Material fehlt melden",
      description: "Fehlendes Material ohne Preisdetails an Chef/Vorarbeiter melden.",
      group: "Material",
      icon: "material",
      keywords: ["material", "fehlt", "melden", "lager"]
    }),
    commandAction({
      href: "/bring-lists",
      label: "Mitbringlisten öffnen",
      description: "Material, Werkzeuge und Aufgaben für die Baustelle prüfen.",
      group: "Baustelle",
      icon: "mitbringen",
      keywords: ["mitbringen", "morgen", "liste", "werkzeug"]
    }),
    ...quickLinks.map(quickLinkCommand)
  ]);
}

export function AppShell({
  context,
  children
}: {
  context: AppContext;
  children: React.ReactNode;
}) {
  const { primaryNav, mobileNav, quickLinks, mobileActions, notice } = getShellNavigation(context);
  const commandActions = getCommandPaletteActions(context, quickLinks);
  const roleLabel = roleLabels[context.profile.role];
  const isDemoContext = context.companyName === DEMO_COMPANY_NAME;
  const mobileNavGridClass = mobileNav.length === 6 ? "grid-cols-6" : "grid-cols-5";

  return (
    <div className="app-shell-bg">
      <aside className="fixed inset-y-0 left-0 z-20 hidden border-r border-line bg-[var(--bp-sidebar)] px-4 py-5 shadow-lift lg:flex lg:w-72 xl:w-80 lg:flex-col">
        <div className="mb-4 border border-white/10 bg-white/[0.08] p-4 text-white shadow-lift">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border border-white/10 bg-white/10 text-white ring-1 ring-white/15">
              <span className="h-3 w-3 rotate-45 bg-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-3xl font-normal uppercase tracking-[0.16em] text-white [font-family:var(--font-display)]">BauPro</p>
              <p className="truncate text-sm font-semibold text-white/70">{context.companyName}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-semibold text-white/80">
            <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
              <Sparkles className="h-4 w-4 text-signal" aria-hidden="true" />
              Einsatzbereit
            </div>
            <div className="flex items-center gap-2 rounded-md bg-white/10 px-3 py-2">
              <ShieldCheck className="h-4 w-4 text-moss" aria-hidden="true" />
              {roleLabel}
            </div>
          </div>
        </div>

        <div className="mb-4 border border-primary/30 bg-primary/10 p-3 text-sm text-white">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-moss" aria-hidden="true" />
            <p className="font-semibold">{notice}</p>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto pb-4">
          <div className="sidebar-panel p-2">
            <p className="sidebar-kicker">
              Einsatzsteuerung
            </p>
            <div className="space-y-1">
              {primaryNav.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>

          <div className="sidebar-panel mt-4 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-black uppercase tracking-normal text-slate-400">Schnellzugriff</p>
              <span className="text-[11px] font-bold text-moss">sichtbar</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map((item) => (
                <QuickAccessLink key={item.href} item={item} />
              ))}
            </div>
          </div>
        </nav>

        <div className="mt-auto rounded-lg border border-white/10 bg-white/[0.05] p-3 shadow-sm">
          <Link href={context.isAdmin ? "/settings" : "/profile"} className="mb-3 flex items-center gap-3 rounded-md p-1 transition hover:bg-white/10">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-white">
              {getInitials(context.profile.full_name, context.email)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {context.profile.full_name || context.email}
              </p>
              <p className="text-xs text-slate-400">{roleLabels[context.profile.role]}</p>
            </div>
          </Link>
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

      <div className="lg:ml-72 xl:ml-80">
        <AppTopBar
          canManage={context.canManage}
          companyName={context.companyName}
          roleLabel={roleLabel}
          userEmail={context.email}
          userName={context.profile.full_name}
          logoutReturnTo={isDemoContext ? "/demo" : "/login"}
        />

        <main id="main-content" className="pb-[calc(11.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>

      <VoiceDictation />
      <PredictivePrefetch role={context.profile.role} canManage={context.canManage} />
      <CommandPalette actions={commandActions} roleLabel={roleLabel} companyName={context.companyName} />

      <Link
        href="/ai-assistant"
        className="fixed bottom-6 right-24 z-40 hidden min-h-14 items-center justify-center gap-2 border border-white/10 bg-anthracite px-4 text-sm font-black text-white shadow-lift transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary lg:inline-flex"
        aria-label="KI fragen"
        title="KI fragen"
      >
        <Sparkles className="h-5 w-5" aria-hidden="true" />
        <span>KI fragen</span>
      </Link>

      <div className="fixed inset-x-0 bottom-[calc(4.9rem+env(safe-area-inset-bottom))] z-30 px-3 lg:hidden">
        <div className="mobile-action-dock mx-auto grid max-w-3xl grid-cols-3 gap-2">
          {mobileActions.map((action) => (
            <MobileActionLink key={action.href + action.label} action={action} />
          ))}
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-basalt/95 px-2 pb-[calc(0.25rem+env(safe-area-inset-bottom))] pt-1 shadow-[0_-16px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl lg:hidden">
        <div className={`mx-auto grid max-w-3xl ${mobileNavGridClass} gap-1 pb-1`}>
          {mobileNav.map((item) => (
            <NavLink key={item.href} {...item} variant="mobile" />
          ))}
        </div>
      </nav>
    </div>
  );
}

function MobileActionLink({ action }: { action: MobileAction }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className={
        action.primary
          ? "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md bg-primary px-2 py-2 text-center text-xs font-black text-white shadow-soft transition active:scale-[0.98]"
          : "flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border border-line bg-surface px-2 py-2 text-center text-xs font-black text-ink shadow-sm transition active:scale-[0.98]"
      }
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="leading-tight">{action.label}</span>
    </Link>
  );
}

function QuickAccessLink({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      className="group flex min-h-12 items-center justify-between gap-2 rounded-md border border-white/10 bg-white/10 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-white/15 focus:outline-none focus:ring-4 focus:ring-white/10"
    >
      <span className="line-clamp-2">{item.label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-moss transition group-hover:translate-x-0.5" aria-hidden="true" />
    </Link>
  );
}
