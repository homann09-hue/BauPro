"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  PREFETCH_CACHE_TTL_MS,
  PREFETCH_FETCH_TIMEOUT_MS,
  PREFETCH_PAYLOAD_MAX_CHARS,
  PREFETCH_ROUTE_LIMIT,
  PREFETCH_ROUTE_LIMIT_REDUCED,
  PREFETCH_SCOPE_GAP_MS,
  PREFETCH_SCOPE_LIMIT,
  PREFETCH_SCOPE_LIMIT_REDUCED,
  prefetchRoutesForRole,
  prefetchScopesForRole
} from "@/lib/performance/prefetch";
import type { Role } from "@/types/app";

function scheduleIdle(work: () => void) {
  if (typeof window === "undefined") return;

  const idleCallback = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 1 }), 500));
  idleCallback((deadline) => {
    if (document.visibilityState !== "visible") return;
    if (!deadline.didTimeout && deadline.timeRemaining() < 4) {
      window.setTimeout(work, 250);
      return;
    }
    work();
  }, { timeout: 2400 });
}

function recentlyPrefetched(key: string) {
  try {
    const value = window.sessionStorage.getItem(key);
    if (!value) return false;
    return Date.now() - Number(value) < PREFETCH_CACHE_TTL_MS;
  } catch {
    return false;
  }
}

function markPrefetched(key: string) {
  try {
    window.sessionStorage.setItem(key, String(Date.now()));
  } catch {
    // Browsers can block storage in strict privacy modes. Prefetching remains optional.
  }
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function shouldReduceBackgroundWork() {
  if (typeof navigator === "undefined") return false;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number }).connection;
  const effectiveType = connection?.effectiveType;
  const isSlowConnection = effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g";
  const isSmallDevice = (navigator.hardwareConcurrency ?? 8) <= 4 || ((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8) <= 4;
  return Boolean(connection?.saveData || isSlowConnection || isSmallDevice);
}

function canRunBackgroundPrefetch() {
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return false;
  if (typeof navigator === "undefined") return true;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !(connection?.saveData || connection?.effectiveType === "slow-2g" || connection?.effectiveType === "2g");
}

function cachePrefetchPayload(scope: string, payload: unknown) {
  try {
    const serialized = JSON.stringify({ cachedAt: Date.now(), payload });
    if (serialized.length <= PREFETCH_PAYLOAD_MAX_CHARS) {
      window.sessionStorage.setItem(`baupro-prefetch:payload:${scope}`, serialized);
    }
  } catch {
    // Der Cache ist nur Komfort. Wenn Storage voll oder blockiert ist, läuft die App normal weiter.
  }
}

async function prefetchDataScope(scope: string) {
  if (!canRunBackgroundPrefetch()) return;
  const key = `baupro-prefetch:data:${scope}`;
  if (recentlyPrefetched(key)) return;
  markPrefetched(key);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PREFETCH_FETCH_TIMEOUT_MS);
  const response = await fetch(`/api/prefetch/route-data?scope=${encodeURIComponent(scope)}`, {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
    priority: "low" as RequestPriority,
    signal: controller.signal
  })
    .catch(() => null)
    .finally(() => window.clearTimeout(timeout));

  if (!response?.ok) return;
  const payload = await response.json().catch(() => null);
  if (payload) cachePrefetchPayload(scope, payload);
}

async function prefetchDataScopes(scopes: readonly string[]) {
  const scopesToWarm = shouldReduceBackgroundWork() ? scopes.slice(0, PREFETCH_SCOPE_LIMIT_REDUCED) : scopes.slice(0, PREFETCH_SCOPE_LIMIT);
  for (const scope of scopesToWarm) {
    await prefetchDataScope(scope);
    await wait(PREFETCH_SCOPE_GAP_MS);
  }
}

export function PredictivePrefetch({ role, canManage }: { role: Role; canManage: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!canRunBackgroundPrefetch()) return;
    const routes = prefetchRoutesForRole(role, canManage).filter((route) => route !== pathname && !pathname.startsWith(`${route}/`));
    const scopes = prefetchScopesForRole(role, canManage);

    scheduleIdle(() => {
      if (!canRunBackgroundPrefetch()) return;
      const routeLimit = shouldReduceBackgroundWork() ? PREFETCH_ROUTE_LIMIT_REDUCED : PREFETCH_ROUTE_LIMIT;
      for (const route of routes.slice(0, routeLimit)) {
        const key = `baupro-prefetch:route:${route}`;
        if (recentlyPrefetched(key)) continue;
        markPrefetched(key);
        router.prefetch(route);
      }

      void prefetchDataScopes(scopes);
    });
  }, [canManage, pathname, role, router]);

  useEffect(() => {
    function handlePointerOver(event: PointerEvent) {
      if (!canRunBackgroundPrefetch()) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement)) return;
      if (target.origin !== window.location.origin) return;
      const href = `${target.pathname}${target.search}`;
      if (!href || href === pathname) return;

      const key = `baupro-prefetch:hover:${href}`;
      if (recentlyPrefetched(key)) return;
      markPrefetched(key);
      router.prefetch(href);
    }

    document.addEventListener("pointerover", handlePointerOver, { passive: true });
    return () => document.removeEventListener("pointerover", handlePointerOver);
  }, [pathname, router]);

  return null;
}
