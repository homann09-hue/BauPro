"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const SLOW_NAVIGATION_MS = 700;
const MAX_NAVIGATION_MS = 10_000;

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
}

function findAnchor(target: EventTarget | null) {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLAnchorElement>("a[href]");
}

function isInternalNavigation(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;

  const url = new URL(anchor.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
  return true;
}

export function RouteProgress() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  const [showSlowHint, setShowSlowHint] = useState(false);
  const slowTimerRef = useRef<number | null>(null);
  const maxTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (slowTimerRef.current) {
      window.clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }

    if (maxTimerRef.current) {
      window.clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
  }, []);

  const finishNavigation = useCallback(() => {
    clearTimers();
    setIsNavigating(false);
    setShowSlowHint(false);
  }, [clearTimers]);

  const startNavigation = useCallback(() => {
    clearTimers();
    setIsNavigating(true);
    setShowSlowHint(false);

    slowTimerRef.current = window.setTimeout(() => {
      setShowSlowHint(true);
    }, SLOW_NAVIGATION_MS);

    maxTimerRef.current = window.setTimeout(() => {
      finishNavigation();
    }, MAX_NAVIGATION_MS);
  }, [clearTimers, finishNavigation]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || isModifiedClick(event)) return;

      const anchor = findAnchor(event.target);
      if (!anchor || !isInternalNavigation(anchor)) return;
      startNavigation();
    }

    document.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("pageshow", finishNavigation);
    window.addEventListener("popstate", startNavigation);

    return () => {
      clearTimers();
      document.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("pageshow", finishNavigation);
      window.removeEventListener("popstate", startNavigation);
    };
  }, [clearTimers, finishNavigation, startNavigation]);

  useEffect(() => {
    const id = window.setTimeout(finishNavigation, 120);
    return () => window.clearTimeout(id);
  }, [finishNavigation, pathname]);

  if (!isNavigating) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[95]" role="status" aria-live="polite" aria-label="Seite wird geöffnet">
      <div className="h-1 w-full overflow-hidden bg-primary/15">
        <div className="route-progress-bar h-full bg-primary shadow-[0_0_18px_rgba(46,125,50,0.65)]" />
      </div>
      {showSlowHint ? (
        <div className="mx-auto mt-[calc(0.75rem+env(safe-area-inset-top))] max-w-xs border border-line bg-surface px-3 py-2 text-center text-xs font-black text-ink shadow-lift sm:max-w-sm">
          Bereich wird geöffnet...
        </div>
      ) : null}
    </div>
  );
}
