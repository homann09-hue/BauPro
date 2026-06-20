"use client";

import { useEffect } from "react";
import { flushQueue, useOfflineQueue } from "@/lib/offline/queue";

export function OfflineQueueProvider({ children }: { children: React.ReactNode }) {
  const { isOffline, queuedCount } = useOfflineQueue();

  useEffect(() => {
    function handleOnline() {
      void flushQueue();
    }

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <>
      {isOffline ? (
        <div className="fixed inset-x-3 top-[calc(0.75rem+env(safe-area-inset-top))] z-[80] mx-auto max-w-3xl rounded-md border border-warning/40 bg-warning px-4 py-3 text-sm font-black text-white shadow-lift">
          Offline - Daten werden gespeichert und beim nächsten Empfang gesendet
          {queuedCount > 0 ? <span className="ml-2 rounded bg-white/20 px-2 py-1 text-xs">{queuedCount} offen</span> : null}
        </div>
      ) : null}
      {children}
    </>
  );
}
