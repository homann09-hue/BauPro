"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { cn } from "@/lib/utils";

const mainLinks = [
  { href: "/features", label: "Funktionen" },
  { href: "/#vorteile", label: "Vorteile" },
  { href: "/#ablauf", label: "Ablauf" },
  { href: "/security", label: "Sicherheit" },
  { href: "/pricing", label: "Preise" },
  { href: "/#faq", label: "FAQ" }
];

const legalLinks = [
  { href: "/legal/impressum", label: "Impressum" },
  { href: "/legal/datenschutz", label: "Datenschutz" },
  { href: "/legal/agb", label: "AGB" },
  { href: "/legal/cookies", label: "Cookies" }
];

export function PublicNav({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    };

    const restoreFocusTarget = menuButtonRef.current;
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      restoreFocusTarget?.focus();
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-coal/95 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-h-12 items-center gap-3" onClick={closeMenu}>
          <Image src="/icons/icon-192.png" alt="" width={32} height={32} className="border border-line bg-surface-container object-cover" priority />
          <span className="text-xl font-extrabold tracking-tight text-white">BauPro</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Hauptnavigation">
          {mainLinks.map((link) => (
            <PublicNavLink key={link.href} href={link.href} label={link.label} active={isActive(pathname, link.href)} />
          ))}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <ThemeToggle compact />
          <Link href="/demo" className="inline-flex min-h-11 items-center justify-center bg-ocher px-4 py-2 text-xs font-black uppercase tracking-wide text-coal transition hover:-translate-y-0.5 hover:bg-signal">
            Demo starten
          </Link>
          <Link href={isLoggedIn ? "/dashboard" : "/login"} className="inline-flex min-h-11 items-center justify-center border border-white/15 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/10">
            {isLoggedIn ? "Zum Dashboard" : "Einloggen"}
          </Link>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          aria-label={open ? "Menü schließen" : "Menü öffnen"}
          aria-expanded={open}
          aria-controls="public-mobile-menu"
          onClick={() => setOpen((current) => !current)}
          className="touch-target inline-flex items-center justify-center border border-line bg-surface-container text-ink shadow-sm transition hover:border-ocher/60 focus:outline-none focus:ring-4 focus:ring-ocher/25 sm:hidden"
        >
          {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-coal/70 backdrop-blur-sm sm:hidden"
          role="presentation"
          onPointerDown={(event) => {
            if (event.target === event.currentTarget) closeMenu();
          }}
        >
          <aside
            id="public-mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="public-mobile-menu-title"
            className="ml-auto flex h-dvh w-[min(92vw,390px)] flex-col border-l border-line bg-coal shadow-lift"
          >
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-4">
              <div>
                <p className="section-kicker">BauPro</p>
                <h2 id="public-mobile-menu-title" className="text-3xl font-extrabold leading-none text-white">
                  Menü
                </h2>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Menü schließen"
                onClick={closeMenu}
                className="touch-target inline-flex items-center justify-center border border-line bg-surface-container text-ink focus:outline-none focus:ring-4 focus:ring-ocher/25"
              >
                <X className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="mb-5">
                <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">Darstellung</p>
                <ThemeToggle />
              </div>

              <MobileNavGroup title="Wichtige Informationen">
                {mainLinks.map((link) => (
                  <MobileNavLink key={link.href} href={link.href} label={link.label} active={isActive(pathname, link.href)} onClick={closeMenu} />
                ))}
              </MobileNavGroup>

              <MobileNavGroup title="Rechtliches">
                {legalLinks.map((link) => (
                  <MobileNavLink key={link.href} href={link.href} label={link.label} active={isActive(pathname, link.href)} onClick={closeMenu} />
                ))}
              </MobileNavGroup>
            </div>

            <div className="safe-bottom-space border-t border-line px-4 py-4">
              <div className="grid gap-2">
                <Link href="/demo" onClick={closeMenu} className="btn-primary w-full">
                  Demo starten
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href={isLoggedIn ? "/dashboard" : "/login"} onClick={closeMenu} className="btn-secondary w-full">
                  {isLoggedIn ? "Zum Dashboard" : "Einloggen"}
                </Link>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  );
}

function PublicNavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "px-3 py-2 text-[11px] font-black uppercase tracking-[0.16em] transition focus:outline-none focus:ring-4 focus:ring-ocher/20",
        active ? "text-ocher" : "text-white/62 hover:text-ocher"
      )}
    >
      {label}
    </Link>
  );
}

function MobileNavGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.16em] text-primary">{title}</p>
      <nav className="grid gap-2" aria-label={title}>
        {children}
      </nav>
    </div>
  );
}

function MobileNavLink({
  href,
  label,
  active,
  onClick
}: {
  href: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-14 items-center justify-between border px-4 text-base font-black transition focus:outline-none focus:ring-4 focus:ring-primary/20",
        active ? "border-ocher/60 bg-ocher/10 text-ink" : "border-line bg-surface-container text-ash hover:border-ocher/45 hover:text-ink"
      )}
    >
      <span>{label}</span>
      <ArrowRight className="h-4 w-4 text-ocher" aria-hidden="true" />
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href.includes("#")) return false;
  return pathname === href;
}
