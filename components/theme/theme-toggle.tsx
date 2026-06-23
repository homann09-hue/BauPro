"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const THEME_STORAGE_KEY = "baupro-theme";
const THEME_CHANGE_EVENT = "baupro-theme-change";

type BauProTheme = "dark" | "light";

function readStoredTheme(): BauProTheme {
  if (typeof window === "undefined") return "dark";
  return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : "dark";
}

function readServerTheme(): BauProTheme {
  return "dark";
}

function subscribeTheme(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(THEME_CHANGE_EVENT, listener);

  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(THEME_CHANGE_EVENT, listener);
  };
}

function applyTheme(theme: BauProTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector<HTMLMetaElement>("meta[name='theme-color']")?.setAttribute("content", theme === "light" ? "#FEF9EE" : "#131313");
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useSyncExternalStore(subscribeTheme, readStoredTheme, readServerTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggleTheme() {
    const nextTheme: BauProTheme = theme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "White Mode aktivieren" : "Dark Mode aktivieren";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 border border-line bg-surface text-sm font-black text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-mint focus:outline-none focus:ring-4 focus:ring-primary/20 active:translate-y-0",
        compact ? "min-w-12 px-3" : "px-4"
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {compact ? null : <span className="hidden sm:inline">{theme === "dark" ? "White" : "Dark"}</span>}
    </button>
  );
}
