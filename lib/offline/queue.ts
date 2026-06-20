"use client";

import { useCallback, useEffect, useState } from "react";
import { del, get, set } from "idb-keyval";

const QUEUE_KEY = "baupro:offline-actions";

type SerializedEntry = {
  name: string;
  value: string;
};

export type QueuedOfflineAction = {
  id: string;
  actionName: string;
  entries: SerializedEntry[];
  createdAt: string;
};

function serializeFormData(formData: FormData) {
  return Array.from(formData.entries()).map(([name, value]) => ({
    name,
    value: typeof value === "string" ? value : value.name
  }));
}

async function readQueue() {
  return (await get<QueuedOfflineAction[]>(QUEUE_KEY)) ?? [];
}

async function writeQueue(queue: QueuedOfflineAction[]) {
  if (queue.length === 0) {
    await del(QUEUE_KEY);
    return;
  }

  await set(QUEUE_KEY, queue);
}

function actionEndpoint(actionName: string) {
  if (actionName.startsWith("/")) return actionName;
  return `/api/offline/${encodeURIComponent(actionName)}`;
}

function restoreFormData(entries: SerializedEntry[]) {
  const formData = new FormData();
  for (const entry of entries) {
    formData.append(entry.name, entry.value);
  }

  return formData;
}

export async function queueAction(actionName: string, formData: FormData) {
  const queue = await readQueue();

  queue.push({
    id: crypto.randomUUID(),
    actionName,
    entries: serializeFormData(formData),
    createdAt: new Date().toISOString()
  });

  await writeQueue(queue);
  window.dispatchEvent(new CustomEvent("baupro-offline-queue-changed", { detail: { count: queue.length } }));
}

export async function flushQueue() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;

  const queue = await readQueue();
  if (queue.length === 0) return 0;

  const remaining: QueuedOfflineAction[] = [];
  let sent = 0;

  for (const queuedAction of queue) {
    try {
      const response = await fetch(actionEndpoint(queuedAction.actionName), {
        method: "POST",
        body: restoreFormData(queuedAction.entries)
      });

      if (!response.ok) {
        remaining.push(queuedAction);
        continue;
      }

      sent += 1;
    } catch {
      remaining.push(queuedAction);
    }
  }

  await writeQueue(remaining);
  window.dispatchEvent(new CustomEvent("baupro-offline-queue-changed", { detail: { count: remaining.length } }));

  return sent;
}

export function useOfflineQueue() {
  const [isOffline, setIsOffline] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);

  const refreshQueuedCount = useCallback(async () => {
    setQueuedCount((await readQueue()).length);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsOffline(!navigator.onLine);
      void refreshQueuedCount();
    }, 0);

    function handleOnline() {
      setIsOffline(false);
      void flushQueue().then(refreshQueuedCount);
    }

    function handleOffline() {
      setIsOffline(true);
      void refreshQueuedCount();
    }

    function handleQueueChanged(event: Event) {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") {
        setQueuedCount(detail.count);
        return;
      }

      void refreshQueuedCount();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("baupro-offline-queue-changed", handleQueueChanged);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("baupro-offline-queue-changed", handleQueueChanged);
    };
  }, [refreshQueuedCount]);

  return {
    isOffline,
    queuedCount,
    queueAction,
    flushQueue
  };
}
