"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { signOutAction } from "@/lib/actions/auth-actions";

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;

const WARNING_TIMEOUT_MS = 60 * 1000;
const ACTIVITY_THROTTLE_MS = 10 * 1000;
const DEFAULT_TIMEOUT_MINUTES = INACTIVITY_TIMEOUT_MS / 60_000;

type SessionTimeoutGuardProps = {
  sessionTimeoutMinutes?: number | null;
};

function timeoutMsFromSetting(sessionTimeoutMinutes?: number | null) {
  if (sessionTimeoutMinutes === 0) return 0;
  if (!Number.isFinite(sessionTimeoutMinutes ?? NaN)) return INACTIVITY_TIMEOUT_MS;

  const minutes = Math.max(1, Math.floor(sessionTimeoutMinutes ?? DEFAULT_TIMEOUT_MINUTES));
  return minutes * 60_000;
}

export function SessionTimeoutGuard({ sessionTimeoutMinutes }: SessionTimeoutGuardProps) {
  const timeoutMs = useMemo(() => timeoutMsFromSetting(sessionTimeoutMinutes), [sessionTimeoutMinutes]);
  const [showWarning, setShowWarning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const inactivityTimerRef = useRef<number | null>(null);
  const warningTimerRef = useRef<number | null>(null);
  const warningVisibleRef = useRef(false);
  const lastActivityUpdateRef = useRef(0);
  const signingOutRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (inactivityTimerRef.current) window.clearTimeout(inactivityTimerRef.current);
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    inactivityTimerRef.current = null;
    warningTimerRef.current = null;
  }, []);

  const signOutForInactivity = useCallback(() => {
    if (signingOutRef.current) return;

    signingOutRef.current = true;
    const formData = new FormData();
    formData.set("reason", "inactivity");

    startTransition(() => {
      void signOutAction(formData);
    });
  }, []);

  const showTimeoutWarning = useCallback(() => {
    warningVisibleRef.current = true;
    setShowWarning(true);
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    warningTimerRef.current = window.setTimeout(signOutForInactivity, WARNING_TIMEOUT_MS);
  }, [signOutForInactivity]);

  const scheduleInactivityTimer = useCallback(() => {
    clearTimers();
    if (timeoutMs <= 0) return;

    inactivityTimerRef.current = window.setTimeout(showTimeoutWarning, timeoutMs);
  }, [clearTimers, showTimeoutWarning, timeoutMs]);

  const markActivity = useCallback(() => {
    if (timeoutMs <= 0 || signingOutRef.current) return;

    const now = Date.now();
    if (!warningVisibleRef.current && now - lastActivityUpdateRef.current < ACTIVITY_THROTTLE_MS) return;

    lastActivityUpdateRef.current = now;
    warningVisibleRef.current = false;
    setShowWarning(false);
    scheduleInactivityTimer();
  }, [scheduleInactivityTimer, timeoutMs]);

  useEffect(() => {
    if (timeoutMs <= 0) {
      clearTimers();
      warningVisibleRef.current = false;
      return undefined;
    }

    lastActivityUpdateRef.current = Date.now();
    scheduleInactivityTimer();

    const listenerOptions: AddEventListenerOptions = { passive: true };
    const activityEvents = ["mousedown", "keydown", "touchstart", "scroll"] as const;
    activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity, listenerOptions));

    return () => {
      clearTimers();
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
    };
  }, [clearTimers, markActivity, scheduleInactivityTimer, timeoutMs]);

  if (timeoutMs <= 0 || !showWarning) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
      <section
        aria-labelledby="session-timeout-title"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-line bg-white p-5 text-ink shadow-lift"
        role="dialog"
      >
        <p className="meta-label">Sicherheit</p>
        <h2 id="session-timeout-title" className="mt-1 text-xl font-black">
          Automatische Abmeldung
        </h2>
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Du wirst in 60 Sekunden automatisch abgemeldet wegen Inaktivität.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Das schützt geteilte Geräte im Bauwagen, Büro oder auf der Baustelle.
        </p>
        <button className="btn-primary mt-5 w-full" disabled={isPending} onClick={markActivity} type="button">
          Angemeldet bleiben
        </button>
      </section>
    </div>
  );
}
