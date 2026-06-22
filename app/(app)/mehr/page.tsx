import Link from "next/link";
import {
  ArrowRight,
  BellPlus,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Clock3,
  FileText,
  HardHat,
  Handshake,
  HelpCircle,
  ListChecks,
  PackageCheck,
  PackageSearch,
  ReceiptText,
  Settings,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Warehouse,
  type LucideIcon
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireAppContext } from "@/lib/auth";
import { hasAppPermission, type PermissionKey } from "@/lib/permissions";

type Action = {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  primary?: boolean;
};

type Group = {
  title: string;
  description: string;
  actions: Action[];
};

type PermissionAction = Action & {
  permission: PermissionKey;
};

const managerFastActions: Action[] = [
  {
    href: "/orders/new",
    title: "Neuen Auftrag anlegen",
    description: "Kunde, Baustelle, Maße und Kalkulation",
    icon: BriefcaseBusiness,
    primary: true
  },
  {
    href: "/time-tracking/daily",
    title: "Tagesstunden prüfen",
    description: "Heute: Mitarbeiterzeiten ansehen und freigeben",
    icon: Clock3,
    primary: true
  },
  {
    href: "/materials/low-stock",
    title: "Material knapp",
    description: "Mindestbestand und Einkaufsvorschläge",
    icon: BellPlus,
    primary: true
  },
  {
    href: "/berichte/neu",
    title: "Tagesbericht schreiben",
    description: "Bericht, Fotos und Wetter dokumentieren",
    icon: ClipboardList
  }
];

const foremanFastActions: Action[] = [
  {
    href: "/time/new",
    title: "Arbeitszeit eintragen",
    description: "Start, Ende, Pause und Tätigkeit",
    icon: Clock3,
    primary: true
  },
  {
    href: "/berichte/neu",
    title: "Tagesbericht schreiben",
    description: "Text, Sprache, Fotos und Material",
    icon: ClipboardList,
    primary: true
  },
  {
    href: "/bring-lists",
    title: "Mitbringliste prüfen",
    description: "Material und Werkzeug für morgen",
    icon: ListChecks,
    primary: true
  },
  {
    href: "/material-melden",
    title: "Material fehlt melden",
    description: "Chef bekommt eine klare Warnung",
    icon: BellPlus
  }
];

const employeeFastActions: Action[] = [
  {
    href: "/time/new",
    title: "Arbeitszeit eintragen",
    description: "Heute schnell erfassen",
    icon: Clock3,
    primary: true
  },
  {
    href: "/berichte/neu",
    title: "Bericht oder Foto",
    description: "Baustelle dokumentieren",
    icon: ClipboardList,
    primary: true
  },
  {
    href: "/material-melden",
    title: "Material fehlt",
    description: "Schnell an Chef melden",
    icon: BellPlus,
    primary: true
  },
  {
    href: "/bring-lists",
    title: "Mitbringliste",
    description: "Was muss ins Fahrzeug?",
    icon: ListChecks
  }
];

const managerGroups: Group[] = [
  {
    title: "Aufträge und Kunden",
    description: "Alles, was im Büro vor der Baustelle passiert.",
    actions: [
      { href: "/customers", title: "Kundenkartei", description: "Kunden suchen und anlegen", icon: Users },
      { href: "/customers/new", title: "Neuer Kunde", description: "Adresse und Kontakt erfassen", icon: Users },
      { href: "/orders", title: "Aufträge", description: "Angebote, Maße und Baustellen", icon: BriefcaseBusiness },
      { href: "/angebote-rechnungen", title: "Angebote und Rechnungen", description: "Kundenunterlagen vorbereiten", icon: ReceiptText }
    ]
  },
  {
    title: "Baustelle und Team",
    description: "Planen, zuweisen, kontrollieren.",
    actions: [
      { href: "/baustellen", title: "Baustellen", description: "Aktive und geplante Einsätze", icon: HardHat },
      { href: "/baustellen/neu", title: "Neue Baustelle", description: "Adresse, Kunde und Team", icon: HardHat },
      { href: "/plantafel", title: "Planung", description: "Team, Fahrzeuge und Termine", icon: CalendarDays },
      { href: "/team", title: "Mitarbeiter", description: "Zugänge und Rollen verwalten", icon: Users },
      { href: "/time-tracking", title: "Zeiterfassung", description: "Alle Zeiten im Überblick", icon: Clock3 },
      { href: "/time-tracking/reports", title: "Stundenzettel", description: "Monatsberichte als PDF/CSV", icon: FileText }
    ]
  },
  {
    title: "Material, Lager und Geräte",
    description: "Bestand, Fahrzeuge, Lieferscheine und Preise.",
    actions: [
      { href: "/materials/inventory", title: "Lagerbestand", description: "Was ist wo vorhanden?", icon: Warehouse },
      { href: "/materials/import", title: "Material erfassen", description: "Artikel schnell ins Lager aufnehmen", icon: PackageSearch },
      { href: "/materials/delivery-notes", title: "Lieferschein fotografieren", description: "Wareneingang prüfen", icon: PackageCheck },
      { href: "/materials/live-offers", title: "Lieferantenpreise", description: "CSV und Angebote vergleichen", icon: Handshake },
      { href: "/bring-lists", title: "Mitbringlisten", description: "Material und Werkzeug für Baustellen", icon: ListChecks },
      { href: "/fahrzeuge", title: "Fahrzeuge und Geräte", description: "Transporter, Maschinen, Werkzeug", icon: Truck }
    ]
  },
  {
    title: "Qualität und Einstellungen",
    description: "Nachweise, Sicherheit und Hilfe.",
    actions: [
      { href: "/berichte", title: "Tagesberichte", description: "Prüfen und freigeben", icon: ClipboardList },
      { href: "/checklists", title: "Checklisten", description: "Arbeitssicherheit und Abnahme", icon: ListChecks },
      { href: "/maengel", title: "Mängel", description: "Schäden und offene Punkte", icon: BellPlus },
      { href: "/settings", title: "Einstellungen", description: "Firma, Kalkulation, Standards", icon: Settings },
      { href: "/settings/security", title: "Sicherheit und 2FA", description: "Account schützen", icon: ShieldCheck },
      { href: "/hilfe", title: "Hilfe", description: "Kurze Antworten ohne Fachchinesisch", icon: HelpCircle }
    ]
  }
];

const operativeGroups: Group[] = [
  {
    title: "Heute auf der Baustelle",
    description: "Die wichtigsten Wege für Handy und Bauwagen.",
    actions: [
      { href: "/baustellen", title: "Meine Baustellen", description: "Adresse, Team und Status", icon: HardHat },
      { href: "/time-tracking", title: "Meine Zeiten", description: "Eigene Einträge ansehen", icon: Clock3 },
      { href: "/berichte", title: "Tagesberichte", description: "Erstellt, eingereicht, geprüft", icon: ClipboardList },
      { href: "/bring-lists", title: "Mitbringlisten", description: "Material und Werkzeug abhaken", icon: ListChecks }
    ]
  },
  {
    title: "Melden und dokumentieren",
    description: "Schnell Bescheid geben, ohne lange zu suchen.",
    actions: [
      { href: "/material-melden", title: "Material fehlt", description: "Chef bekommt eine Meldung", icon: BellPlus },
      { href: "/maengel", title: "Mängel", description: "Schäden und offene Punkte", icon: BellPlus },
      { href: "/checklists", title: "Checklisten", description: "Sicherheit, Abnahme, Tagesabschluss", icon: ListChecks },
      { href: "/ai-assistant", title: "KI fragen", description: "Text ordnen und Vorschläge holen", icon: Sparkles }
    ]
  },
  {
    title: "Mein Zugang",
    description: "Profil, Datenschutz und Hilfe.",
    actions: [
      { href: "/profile", title: "Profil", description: "Name, Rolle und Zugang", icon: Users },
      { href: "/privacy", title: "Datenschutz", description: "Eigene Daten und Export", icon: ShieldCheck },
      { href: "/hilfe", title: "Hilfe", description: "Kurz erklärt", icon: HelpCircle }
    ]
  }
];

const permissionActions: PermissionAction[] = [
  { href: "/orders", title: "Aufträge", description: "Freigegebene Aufträge ansehen", icon: BriefcaseBusiness, permission: "orders.view" },
  { href: "/orders/new", title: "Neuer Auftrag", description: "Auftrag erfassen", icon: BriefcaseBusiness, permission: "orders.create" },
  { href: "/customers", title: "Kunden", description: "Kundenkartei öffnen", icon: Users, permission: "customers.view" },
  { href: "/angebote-rechnungen", title: "Angebote", description: "Kalkulationen und Angebote", icon: ReceiptText, permission: "quotes.view" },
  { href: "/materials/inventory", title: "Lagerbestand", description: "Material und Lagerorte", icon: Warehouse, permission: "inventory.view" },
  { href: "/time-tracking/daily", title: "Tagesstunden", description: "Teamzeiten prüfen", icon: Clock3, permission: "time.team.view" },
  { href: "/fahrzeuge", title: "Fahrzeuge und Geräte", description: "Ressourcen verwalten", icon: Truck, permission: "vehicles.manage" },
  { href: "/settings", title: "Einstellungen", description: "Betrieb konfigurieren", icon: Settings, permission: "settings.edit" }
];

export default async function MorePage() {
  const context = await requireAppContext();
  const isManager = context.canManage;
  const isForeman = context.profile.role === "vorarbeiter";
  const grantedActions = permissionActions.filter((action) =>
    hasAppPermission(context.profile.role, context.permissions, action.permission)
  );
  const fastActions = isManager ? managerFastActions : isForeman ? foremanFastActions : employeeFastActions;
  const groups = isManager
    ? managerGroups
    : grantedActions.length > 0
      ? [
          {
            title: "Freigeschaltete Bereiche",
            description: "Diese Funktionen hat Chef/Admin für dich freigegeben.",
            actions: grantedActions
          },
          ...operativeGroups
        ]
      : operativeGroups;

  return (
    <div>
      <PageHeader
        title="Alle Funktionen"
        description="Der schnelle Weg, wenn du nicht lange suchen willst. Die wichtigsten Aufgaben sind direkt oben."
      />

      <section className="rounded-lg border border-slate-800 bg-anthracite p-4 text-white shadow-lift sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-normal text-mint">Schnellstart</p>
            <h2 className="mt-1 text-2xl font-black">Was möchtest du tun?</h2>
          </div>
          <p className="max-w-md text-sm font-semibold leading-6 text-white/70">
            Ziel: jede wichtige Funktion in höchstens drei Klicks. Unten sind die Wege nach Meister-Alltag sortiert.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {fastActions.map((action) => (
            <ActionCard key={action.href + action.title} action={action} dark />
          ))}
        </div>
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        {groups.map((group) => (
          <section key={group.title} className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
            <div className="mb-4">
              <p className="section-kicker">{group.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{group.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.actions.map((action) => (
                <ActionCard key={action.href + action.title} action={action} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ActionCard({ action, dark = false }: { action: Action; dark?: boolean }) {
  const Icon = action.icon;

  return (
    <Link
      href={action.href}
      className={
        dark
          ? "group flex min-h-28 flex-col justify-between rounded-md border border-white/10 bg-white/10 p-4 text-white transition hover:-translate-y-0.5 hover:bg-white/15"
          : "group flex min-h-28 flex-col justify-between rounded-md border border-line bg-fog p-4 text-ink transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-mint"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <span className={dark ? "rounded-md bg-primary p-2.5 text-white" : "rounded-md bg-primary/10 p-2.5 text-primary"}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <ArrowRight className={dark ? "h-4 w-4 text-white/70 transition group-hover:translate-x-0.5" : "h-4 w-4 text-primary transition group-hover:translate-x-0.5"} aria-hidden="true" />
      </div>
      <div>
        <p className="font-black">{action.title}</p>
        <p className={dark ? "mt-1 text-sm leading-5 text-white/70" : "mt-1 text-sm leading-5 text-slate-600"}>{action.description}</p>
      </div>
    </Link>
  );
}
