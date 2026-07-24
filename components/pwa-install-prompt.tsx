"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISS_STORAGE_KEY = "baupro:pwa-install-dismissed-until:v1";
const DISMISS_FOR_MS = 7 * 24 * 60 * 60 * 1000;

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isBeforeInstallPromptEvent(event: Event): event is BeforeInstallPromptEvent {
  return "prompt" in event && typeof (event as BeforeInstallPromptEvent).prompt === "function";
}

function isStandaloneMode() {
  if (typeof window === "undefined") return false;
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isDismissed() {
  try {
    const dismissedUntil = Number(window.localStorage.getItem(DISMISS_STORAGE_KEY) ?? 0);
    return Date.now() < dismissedUntil;
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now() + DISMISS_FOR_MS));
  } catch {
    // Installation bleibt Komfort. Storage-Fehler dürfen die App nicht stören.
  }
}

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandaloneMode() || isDismissed()) return;

    function handleBeforeInstallPrompt(event: Event) {
      if (!isBeforeInstallPromptEvent(event) || isStandaloneMode() || isDismissed()) return;
      event.preventDefault();
      setInstallPrompt(event);
      setVisible(true);
    }

    function handleInstalled() {
      setVisible(false);
      setInstallPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;

    setVisible(false);
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice.catch(() => null);
    if (choice?.outcome !== "accepted") {
      rememberDismissal();
    }
    setInstallPrompt(null);
  }

  function dismissPrompt() {
    rememberDismissal();
    setVisible(false);
    setInstallPrompt(null);
  }

  if (!visible || !installPrompt) return null;

  return (
    <aside
      className="fixed bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-3 right-3 z-[75] mx-auto max-w-sm border border-line bg-surface p-3 text-ink shadow-lift sm:left-5 sm:right-auto sm:bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:w-[24rem]"
      aria-label="BauPro als App installieren"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-primary/30 bg-primary/10 text-primary">
          <Download className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-ink">BauPro als App nutzen</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-ash">
            Für schnellen Zugriff auf der Baustelle direkt auf dem Startbildschirm installieren.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-basalt text-ash hover:text-ink focus:outline-none focus:ring-4 focus:ring-primary/20"
          onClick={dismissPrompt}
          aria-label="Installationshinweis ausblenden"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" className="btn-primary min-h-11 text-xs" onClick={installApp}>
          Installieren
        </button>
        <button type="button" className="btn-secondary min-h-11 text-xs" onClick={dismissPrompt}>
          Später
        </button>
      </div>
    </aside>
  );
}
