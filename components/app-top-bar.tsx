"use client";

import { FormEvent, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, LogOut, UserRound } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth-actions";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn, getInitials } from "@/lib/utils";

type AppTopBarProps = {
  userName?: string | null;
  userEmail?: string | null;
  roleLabel: string;
  companyName: string;
  canManage: boolean;
};

const routeTitles: Array<{ prefix: string; title: string; fallback: string }> = [
  { prefix: "/time-tracking/daily", title: "Tagesstunden", fallback: "/time-tracking" },
  { prefix: "/time-tracking/reports", title: "Stundenzettel", fallback: "/time-tracking" },
  { prefix: "/time-tracking/new", title: "Arbeitszeit eintragen", fallback: "/time-tracking" },
  { prefix: "/time/new", title: "Arbeitszeit eintragen", fallback: "/time-tracking" },
  { prefix: "/time-tracking", title: "Zeiterfassung", fallback: "/dashboard" },
  { prefix: "/materials/control-center", title: "Lager-Zentrale", fallback: "/materials" },
  { prefix: "/materials/delivery-notes", title: "Lieferscheine", fallback: "/materials" },
  { prefix: "/materials/inventory", title: "Lagerbestand", fallback: "/materials" },
  { prefix: "/materials/live-offers", title: "Preisquellen", fallback: "/materials" },
  { prefix: "/materials/online-discovery", title: "Online-Preise", fallback: "/materials" },
  { prefix: "/materials/locations", title: "Lagerorte", fallback: "/materials" },
  { prefix: "/materials/catalog", title: "Materialkatalog", fallback: "/materials" },
  { prefix: "/materials", title: "Material", fallback: "/dashboard" },
  { prefix: "/material-melden", title: "Material melden", fallback: "/dashboard" },
  { prefix: "/material", title: "Material", fallback: "/materials" },
  { prefix: "/baustellen", title: "Baustellen", fallback: "/dashboard" },
  { prefix: "/berichte", title: "Berichte", fallback: "/dashboard" },
  { prefix: "/bring-lists", title: "Mitbringlisten", fallback: "/dashboard" },
  { prefix: "/morgen", title: "Morgen", fallback: "/bring-lists" },
  { prefix: "/orders/new", title: "Neuer Auftrag", fallback: "/orders" },
  { prefix: "/orders", title: "Aufträge", fallback: "/dashboard" },
  { prefix: "/customers", title: "Kunden", fallback: "/dashboard" },
  { prefix: "/plantafel", title: "Plantafel", fallback: "/dashboard" },
  { prefix: "/team", title: "Team", fallback: "/dashboard" },
  { prefix: "/fahrzeuge", title: "Fahrzeuge und Geräte", fallback: "/dashboard" },
  { prefix: "/checklists", title: "Checklisten", fallback: "/dashboard" },
  { prefix: "/maengel", title: "Mängel", fallback: "/dashboard" },
  { prefix: "/invoices", title: "Angebote & Rechnungen", fallback: "/dashboard" },
  { prefix: "/angebote-rechnungen", title: "Angebote", fallback: "/dashboard" },
  { prefix: "/ai/job-wizard", title: "KI-Auftrag", fallback: "/ai-assistant" },
  { prefix: "/ai-assistant", title: "KI-Assistent", fallback: "/dashboard" },
  { prefix: "/calendar", title: "Kalender", fallback: "/dashboard" },
  { prefix: "/billing", title: "Abo", fallback: "/settings" },
  { prefix: "/settings/security", title: "Sicherheit", fallback: "/settings" },
  { prefix: "/settings", title: "Einstellungen", fallback: "/dashboard" },
  { prefix: "/profile", title: "Profil", fallback: "/dashboard" },
  { prefix: "/privacy", title: "Datenschutz", fallback: "/settings" },
  { prefix: "/suppliers", title: "Lieferanten", fallback: "/materials" },
  { prefix: "/onboarding", title: "Startassistent", fallback: "/dashboard" },
  { prefix: "/demo-tour", title: "Demo-Tour", fallback: "/dashboard" },
  { prefix: "/hilfe", title: "Hilfe", fallback: "/dashboard" },
  { prefix: "/faq", title: "FAQ", fallback: "/hilfe" },
  { prefix: "/mehr", title: "Alle Funktionen", fallback: "/dashboard" },
  { prefix: "/dashboard", title: "Dashboard", fallback: "/dashboard" }
];

function routeInfo(pathname: string) {
  const fallback = routeTitles[routeTitles.length - 1];
  if (!fallback) throw new Error("Routen-Navigation ist nicht konfiguriert.");

  return routeTitles.find((route) => pathname === route.prefix || pathname.startsWith(`${route.prefix}/`)) ?? fallback;
}

function hasSameOriginReferrer() {
  if (typeof window === "undefined" || typeof document === "undefined" || !document.referrer) return false;

  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

export function AppTopBar({ userName, userEmail, roleLabel, companyName, canManage }: AppTopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const previousPathRef = useRef<string | null>(null);
  const currentPathRef = useRef(pathname);
  const displayName = userName || userEmail || "BauPro Nutzer";
  const initials = getInitials(userName, userEmail);
  const info = routeInfo(pathname);

  useEffect(() => {
    if (currentPathRef.current === pathname) return;
    previousPathRef.current = currentPathRef.current;
    currentPathRef.current = pathname;
  }, [pathname]);

  function handleBack() {
    if (previousPathRef.current || hasSameOriginReferrer()) {
      router.back();
      return;
    }

    router.push(info.fallback);
  }

  function confirmLogout(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Möchtest du dich wirklich abmelden?")) {
      event.preventDefault();
    }
  }

  return (
    <header className="native-topbar">
      <div className="mx-auto grid min-h-14 max-w-[1600px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
        <div className="flex min-w-0 items-center justify-start">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 border border-line bg-surface px-3 text-sm font-black text-ink shadow-sm transition hover:border-primary/50 hover:bg-mint focus:outline-none focus:ring-4 focus:ring-primary/15"
            aria-label={`Zurück, falls keine vorherige Seite vorhanden ist zu ${info.fallback}`}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            <span className="hidden sm:inline">Zurück</span>
          </button>
        </div>

        <div className="min-w-0 text-center">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.16em] text-primary sm:hidden">{companyName}</p>
          <p className="truncate text-2xl font-normal uppercase leading-none tracking-wide text-ink [font-family:var(--font-display)] sm:text-3xl">{info.title}</p>
          <p className="hidden truncate text-xs font-bold text-ash sm:block">{companyName}</p>
        </div>

        <div className="flex min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          <ThemeToggle compact />

          <div className="min-w-0 border border-line bg-surface px-1.5 py-1.5 shadow-sm sm:px-3">
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center text-xs font-black text-white",
                  canManage ? "bg-primary" : "bg-coal"
                )}
                aria-hidden="true"
              >
                {initials || <UserRound className="h-4 w-4" />}
              </div>
              <div className="min-w-0">
                <p className="max-w-[3.4rem] truncate text-[11px] font-black text-ink sm:max-w-[11rem] sm:text-sm">{displayName}</p>
                <p className="hidden text-xs font-bold text-ash sm:block">{roleLabel}</p>
              </div>
            </div>
          </div>

          <form action={signOutAction} onSubmit={confirmLogout}>
            <button
              type="submit"
              aria-label="Abmelden"
              className="inline-flex min-h-12 min-w-12 items-center justify-center gap-2 border border-line bg-primary px-3 text-sm font-black text-white shadow-sm transition hover:border-primary/50 hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/20 sm:px-4"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
              <span className="hidden md:inline">Abmelden</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
