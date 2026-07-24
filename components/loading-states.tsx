"use client";

import { useEffect, useState } from "react";

type LoadingStateMode = "loading" | "timed-out";

function isDevelopment() {
  return process.env.NODE_ENV === "development";
}

function LoadingStateShell({
  children,
  route,
  timeoutMs
}: {
  children: React.ReactNode;
  route: string;
  timeoutMs?: number;
}) {
  const [mode, setMode] = useState<LoadingStateMode>("loading");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setMode("timed-out");
    }, timeoutMs ?? 8_500);

    return () => window.clearTimeout(timeoutId);
  }, [timeoutMs]);

  if (mode !== "timed-out") return <>{children}</>;

  return (
    <section className="surface-strong construction-rail p-5" role="status" aria-live="polite">
      <p className="text-sm font-black uppercase tracking-[0.14em] text-warning">Ladevorgang hängend</p>
      <p className="mt-2 text-base font-black text-ink">Die Seite reagiert zu langsam.</p>
      <p className="mt-2 text-sm font-semibold text-ash">
        Dieser Bereich hat länger als {timeoutMs ?? 8_500} ms geladen. Leere Werte oder hohe Last sind oft die Ursache.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            window.location.reload();
          }}
        >
          Neu laden
        </button>
        <p className="self-center text-sm text-slate-600">Route: {route || "unbekannt"}</p>
      </div>
      <div className="mt-4 rounded-md bg-white/70 p-3 text-sm font-semibold text-slate-700">
        <p>Noch keine Daten vorhanden – die Seite lädt noch. Bitte erneut versuchen oder zurück navigieren.</p>
      </div>
      {isDevelopment() ? (
        <p className="mt-3 text-xs text-ash">Dev-Debug: Ladezustand aktiv seit {timeoutMs ?? 8_500} ms auf {route || "unbekannter Route"}.</p>
      ) : null}
    </section>
  );
}

function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`skeleton-line ${className}`} />;
}

export function PageSkeleton({ title = true }: { title?: boolean }) {
  const route = typeof window !== "undefined" ? window.location.pathname : "Seiten-Ladezustand";

  return (
    <LoadingStateShell route={route} timeoutMs={9_000}>
      <div className="space-y-5" aria-label="Inhalt wird geladen">
        {title ? (
          <div className="surface-strong construction-rail p-5">
            <SkeletonLine className="h-3 w-28" />
            <SkeletonLine className="mt-3 h-8 w-64 max-w-full" />
            <SkeletonLine className="mt-3 h-4 w-full max-w-2xl" />
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface p-4">
              <SkeletonLine className="h-10 w-10" />
              <SkeletonLine className="mt-4 h-7 w-20" />
              <SkeletonLine className="mt-2 h-4 w-32" />
            </div>
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="surface p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <SkeletonLine className="h-5 w-3/4" />
                  <SkeletonLine className="mt-3 h-4 w-1/2" />
                  <SkeletonLine className="mt-3 h-4 w-full" />
                </div>
                <SkeletonLine className="h-8 w-20" />
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2">
                <SkeletonLine className="h-16" />
                <SkeletonLine className="h-16" />
                <SkeletonLine className="h-16" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingStateShell>
  );
}

export function DashboardDetailsSkeleton() {
  return (
    <LoadingStateShell route="dashboard-details" timeoutMs={9_000}>
      <div className="mt-6 space-y-6" aria-label="Dashboard-Details werden geladen">
        <div className="surface-strong p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-4 w-32" />
              <SkeletonLine className="mt-3 h-7 w-64 max-w-full" />
              <SkeletonLine className="mt-3 h-4 w-full max-w-xl" />
            </div>
            <SkeletonLine className="h-10 w-24" />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
            <SkeletonLine className="h-24" />
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="surface p-4">
            <SkeletonLine className="h-6 w-52" />
            <SkeletonLine className="mt-3 h-4 w-72 max-w-full" />
            <div className="mt-5 space-y-3">
              <SkeletonLine className="h-20" />
              <SkeletonLine className="h-20" />
            </div>
          </div>
          <div className="surface p-4">
            <SkeletonLine className="h-6 w-48" />
            <SkeletonLine className="mt-3 h-4 w-72 max-w-full" />
            <div className="mt-5 grid grid-cols-2 gap-3">
              <SkeletonLine className="h-20" />
              <SkeletonLine className="h-20" />
            </div>
          </div>
        </div>
      </div>
    </LoadingStateShell>
  );
}

export function FormSkeleton() {
  const route = typeof window !== "undefined" ? window.location.pathname : "Formular";

  return (
    <LoadingStateShell route={route} timeoutMs={9_000}>
      <div className="space-y-4" aria-label="Formular wird geladen">
        <div className="surface-strong construction-rail p-5">
          <SkeletonLine className="h-3 w-28" />
          <SkeletonLine className="mt-3 h-7 w-56 max-w-full" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <SkeletonLine className="h-14" />
            <SkeletonLine className="h-14" />
            <SkeletonLine className="h-14 sm:col-span-2" />
          </div>
        </div>
        <div className="surface p-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SkeletonLine className="h-14" />
            <SkeletonLine className="h-14" />
            <SkeletonLine className="h-14" />
            <SkeletonLine className="h-14" />
          </div>
        </div>
        <div className="surface p-5">
          <SkeletonLine className="h-28" />
        </div>
      </div>
    </LoadingStateShell>
  );
}
