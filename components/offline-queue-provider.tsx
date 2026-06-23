"use client";

import { useEffect, useState } from "react";
import { flushQueue, useOfflineQueue } from "@/lib/offline/queue";

type NetworkInformationLike = EventTarget & {
  effectiveType?: string;
  saveData?: boolean;
};

function getConnection() {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection ?? null;
}

function isSlowConnection() {
  const connection = getConnection();
  if (!connection) return false;
  return connection.saveData === true || connection.effectiveType === "slow-2g" || connection.effectiveType === "2g";
}

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const { isOffline, queuedCount } = useOfflineQueue();
  const [slowConnection, setSlowConnection] = useState(false);

  useEffect(() => {
    function handleOnline() {
      void flushQueue();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  useEffect(() => {
    const connection = getConnection();
    const timer = window.setTimeout(() => setSlowConnection(isSlowConnection()), 0);

    if (!connection) {
      return () => window.clearTimeout(timer);
    }

    function handleConnectionChange() {
      setSlowConnection(isSlowConnection());
    }

    connection.addEventListener("change", handleConnectionChange);
    return () => {
      window.clearTimeout(timer);
      connection.removeEventListener("change", handleConnectionChange);
    };
  }, []);

  const showNetworkWarning = isOffline || slowConnection;

  return (
    <>
      {showNetworkWarning ? (
        <div className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[80] mx-auto max-w-3xl rounded-md border border-warning/40 bg-warning px-4 py-3 text-sm font-black text-white shadow-lift">
          {isOffline
            ? "Offline - Entwürfe bleiben auf diesem Gerät. Sende erneut, sobald Empfang da ist."
            : "Langsame Verbindung - Uploads und Wetterdaten können dauern. Entwürfe werden lokal gesichert."}
          {queuedCount > 0 ? <span className="ml-2 rounded bg-white/20 px-2 py-1 text-xs">{queuedCount} offen</span> : null}
        </div>
      ) : null}
      {children}
    </>
  );
}
