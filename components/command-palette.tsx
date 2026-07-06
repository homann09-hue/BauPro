"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  BellPlus,
  BriefcaseBusiness,
  CalendarDays,
  CheckSquare,
  Clock3,
  Cog,
  FileText,
  HardHat,
  HelpCircle,
  Home,
  Layers3,
  ListChecks,
  Menu,
  PackageSearch,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  Users,
  Warehouse,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";

const commandIcons = {
  dashboard: Home,
  baustellen: HardHat,
  auftraege: BriefcaseBusiness,
  kunden: UserRound,
  kalender: CalendarDays,
  berichte: FileText,
  zeiten: Clock3,
  material: Layers3,
  lager: Warehouse,
  mitbringen: ListChecks,
  team: Users,
  fahrzeuge: Truck,
  checklisten: CheckSquare,
  maengel: BellPlus,
  angebote: ReceiptText,
  ki: Sparkles,
  sicherheit: ShieldCheck,
  einstellungen: Cog,
  hilfe: HelpCircle,
  katalog: PackageSearch,
  mehr: Menu
};

const RECENT_COMMANDS_STORAGE_KEY = "baupro:recent-command-hrefs:v1";
const MAX_RECENT_COMMANDS = 5;
const COMMAND_PALETTE_LIST_ID = "baupro-command-palette-results";
const COMMAND_DIALOG_DESCRIPTION_ID = "baupro-command-palette-description";
const COMMAND_PREFETCH_LIMIT = 5;
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");

export type CommandIconKey = keyof typeof commandIcons;

export type CommandPaletteAction = {
  href: string;
  label: string;
  description: string;
  group: string;
  keywords: string[];
  icon: CommandIconKey;
  primary?: boolean;
};

type RecentCommandEntry = {
  href: string;
  openedAt: number;
};

function readRecentCommandEntries(): RecentCommandEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(RECENT_COMMANDS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is RecentCommandEntry => {
        return (
          typeof entry === "object" &&
          entry !== null &&
          typeof entry.href === "string" &&
          entry.href.startsWith("/") &&
          typeof entry.openedAt === "number"
        );
      })
      .sort((left, right) => right.openedAt - left.openedAt)
      .slice(0, MAX_RECENT_COMMANDS);
  } catch {
    return [];
  }
}

function writeRecentCommandEntries(entries: RecentCommandEntry[]) {
  try {
    window.localStorage.setItem(RECENT_COMMANDS_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_RECENT_COMMANDS)));
  } catch {
    // Lokaler Komfort darf nie die Navigation blockieren.
  }
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss");
}

function matches(action: CommandPaletteAction, query: string) {
  if (!query.trim()) return true;
  const haystack = normalize([action.label, action.description, action.group, ...action.keywords].join(" "));
  return normalize(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}

function isSafeCommandHref(href: string) {
  if (!href.startsWith("/")) return false;
  if (href.startsWith("/api/")) return false;
  if (href.startsWith("/_next")) return false;
  if (href.length > 240) return false;
  return true;
}

function shouldSkipCommandPrefetch() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return Boolean(connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g");
}

export function CommandPalette({
  actions,
  roleLabel,
  companyName
}: {
  actions: CommandPaletteAction[];
  roleLabel: string;
  companyName: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentEntries, setRecentEntries] = useState<RecentCommandEntry[]>([]);

  const actionByHref = useMemo(() => new Map(actions.map((action) => [action.href, action])), [actions]);
  const recentActionHrefs = useMemo(() => new Set(recentEntries.map((entry) => entry.href)), [recentEntries]);
  const recentActions = useMemo(
    () =>
      recentEntries.flatMap((entry) => {
        const action = actionByHref.get(entry.href);
        if (!action) return [];

        return [
          {
            ...action,
            group: "Zuletzt geöffnet",
            keywords: [...action.keywords, "zuletzt", "verlauf", "schnell"]
          }
        ];
      }),
    [actionByHref, recentEntries]
  );

  const filteredActions = useMemo(() => {
    const orderedActions = query.trim()
      ? actions
      : [...recentActions, ...actions.filter((action) => !recentActionHrefs.has(action.href))];

    return orderedActions.filter((action) => matches(action, query)).slice(0, 12);
  }, [actions, query, recentActionHrefs, recentActions]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const entries = readRecentCommandEntries().filter((entry) => actionByHref.has(entry.href));
      setRecentEntries(entries);
    }, 0);

    return () => window.clearTimeout(id);
  }, [actionByHref]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => {
          if (!current) {
            setQuery("");
            setActiveIndex(0);
          }

          return !current;
        });
      }

      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = "hidden";
    const id = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      window.clearTimeout(id);
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus({ preventScroll: true });
      restoreFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    if (!open || shouldSkipCommandPrefetch()) return;

    const id = window.setTimeout(() => {
      const warmedHrefs = new Set<string>();

      for (const action of filteredActions) {
        if (!isSafeCommandHref(action.href) || warmedHrefs.has(action.href)) continue;
        warmedHrefs.add(action.href);
        router.prefetch(action.href);
        if (warmedHrefs.size >= COMMAND_PREFETCH_LIMIT) break;
      }
    }, 120);

    return () => window.clearTimeout(id);
  }, [filteredActions, open, router]);

  function choose(action: CommandPaletteAction) {
    rememberAction(action);
    setOpen(false);
    setQuery("");
    router.push(action.href);
  }

  function rememberAction(action: CommandPaletteAction) {
    const nextEntries = [
      { href: action.href, openedAt: Date.now() },
      ...recentEntries.filter((entry) => entry.href !== action.href)
    ].slice(0, MAX_RECENT_COMMANDS);

    setRecentEntries(nextEntries);
    writeRecentCommandEntries(nextEntries);
  }

  function openPalette() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(filteredActions.length - 1, 0)));
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    }

    if (event.key === "Enter" && filteredActions[activeIndex]) {
      event.preventDefault();
      choose(filteredActions[activeIndex]);
    }
  }

  function handleDialogKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusableElements = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
      return !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true";
    });
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (!firstElement || !lastElement) return;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
      return;
    }

    if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <>
      <button
        type="button"
        className="fixed bottom-[calc(9rem+env(safe-area-inset-bottom))] right-3 z-40 inline-flex min-h-12 items-center justify-center gap-2 border border-primary/40 bg-primary px-4 text-sm font-black text-white shadow-lift transition hover:-translate-y-0.5 hover:bg-primary-dark focus:outline-none focus:ring-4 focus:ring-primary/25 lg:bottom-6 lg:right-6 lg:min-h-14"
        onClick={openPalette}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Schnellzugriff öffnen"
      >
        <Search className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">Schnellzugriff</span>
        <span className="hidden rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-black text-white/80 lg:inline">⌘K</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/55 px-3 py-[calc(1rem+env(safe-area-inset-top))] backdrop-blur-sm"
          role="presentation"
          onMouseDown={() => setOpen(false)}
        >
          <section
            ref={dialogRef}
            className="mx-auto flex max-h-[min(82vh,720px)] w-full max-w-2xl flex-col overflow-hidden border border-line bg-surface shadow-lift"
            role="dialog"
            aria-modal="true"
            aria-label="BauPro Schnellzugriff"
            aria-describedby={COMMAND_DIALOG_DESCRIPTION_ID}
            onKeyDown={handleDialogKeyDown}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-line bg-basalt p-4 text-ink">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="meta-label text-primary">BauPro Schnellzugriff</p>
                  <h2 className="mt-1 text-2xl font-black">Was möchtest du tun?</h2>
                  <p id={COMMAND_DIALOG_DESCRIPTION_ID} className="mt-1 text-sm font-semibold text-ash">
                    {companyName} · {roleLabel}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center border border-line bg-surface text-ink hover:bg-mint focus:outline-none focus:ring-4 focus:ring-primary/20"
                  onClick={() => setOpen(false)}
                  aria-label="Schnellzugriff schließen"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <label className="mt-4 flex min-h-14 items-center gap-3 border border-line bg-surface px-3 shadow-sm focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
                <Search className="h-5 w-5 text-primary" aria-hidden="true" />
                <input
                  ref={inputRef}
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls={COMMAND_PALETTE_LIST_ID}
                  aria-expanded={open}
                  aria-activedescendant={filteredActions[activeIndex] ? `command-palette-action-${activeIndex}` : undefined}
                  className="min-w-0 flex-1 bg-transparent text-base font-bold text-ink outline-none placeholder:text-ash"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={handleInputKeyDown}
                  placeholder="Aktion, Baustelle, Material, Zeit suchen..."
                  autoComplete="off"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {filteredActions.length > 0 ? (
                <div id={COMMAND_PALETTE_LIST_ID} className="space-y-2" role="listbox" aria-label="Schnellaktionen">
                  {filteredActions.map((action, index) => {
                    const Icon = commandIcons[action.icon] ?? Search;
                    const active = index === activeIndex;
                    return (
                      <Link
                        key={`${action.href}-${action.label}`}
                        id={`command-palette-action-${index}`}
                        href={action.href}
                        role="option"
                        aria-selected={active}
                        className={cn(
                          "group flex min-h-16 items-center gap-3 border px-3 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-primary/15",
                          active ? "border-primary bg-mint text-ink" : "border-line bg-surface hover:border-primary/50 hover:bg-mint"
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => {
                          rememberAction(action);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center border", action.primary ? "border-primary bg-primary text-white" : "border-line bg-basalt text-primary")}>
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-ink">{action.label}</span>
                          <span className="mt-0.5 line-clamp-2 block text-xs font-semibold text-ash">{action.description}</span>
                        </span>
                        <span className="hidden rounded border border-line px-2 py-1 text-[10px] font-black uppercase tracking-wide text-ash sm:inline">
                          {action.group}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="surface-strong construction-rail p-5">
                  <p className="text-lg font-black text-ink">Nichts gefunden.</p>
                  <p className="mt-2 text-sm font-semibold text-ash">
                    Probiere Begriffe wie Zeit, Bericht, Material, Auftrag oder Hilfe.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-line bg-basalt px-4 py-3 text-xs font-semibold text-ash">
              Tipp: mit Pfeiltasten auswählen, Enter öffnen, Escape schließen.
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
