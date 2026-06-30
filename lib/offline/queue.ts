"use client";

import { useCallback, useEffect, useState } from "react";
import { del, get, set } from "idb-keyval";

const QUEUE_KEY = "baupro:offline-actions";

type SerializedTextEntry = {
  name: string;
  kind: "text";
  value: string;
};

type SerializedFileEntry = {
  name: string;
  kind: "file";
  value: string;
  fileName: string;
  mimeType: string;
  lastModified: number;
};

type SerializedLegacyEntry = {
  name: string;
  value: string;
};

type SerializedEntry = SerializedTextEntry | SerializedFileEntry | SerializedLegacyEntry;

export type QueuedOfflineAction = {
  id: string;
  actionName: string;
  entries: SerializedEntry[];
  createdAt: string;
};

function encodeBinaryAsBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";

  for (let i = 0; i < bytes.length; i += 0x8000) {
    const chunk = bytes.slice(i, i + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function decodeBase64ToFileBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

async function serializeFormData(formData: FormData) {
  const rows: SerializedEntry[] = [];

  for (const [name, value] of Array.from(formData.entries())) {
    if (typeof value === "string") {
      rows.push({
        name,
        kind: "text",
        value
      });
      continue;
    }

    const arrayBuffer = await value.arrayBuffer();
    rows.push({
      name,
      kind: "file",
      value: encodeBinaryAsBase64(arrayBuffer),
      fileName: value.name || "upload",
      mimeType: value.type || "application/octet-stream",
      lastModified: value.lastModified
    });
  }

  return rows;
}

function restoreFileEntry(entry: SerializedFileEntry) {
  const bytes = decodeBase64ToFileBytes(entry.value);
  return new File([bytes], entry.fileName, { type: entry.mimeType, lastModified: entry.lastModified });
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
  if (/^https?:\/\//i.test(actionName)) return actionName;
  if (actionName.startsWith("/")) return actionName;
  return `/api/offline/${encodeURIComponent(actionName)}`;
}

function isRedirectErrorResponse(response: Response) {
  if (response.status < 300 || response.status >= 400) return false;

  const location = response.headers.get("Location");
  if (!location) return false;

  try {
    const redirectUrl = new URL(location, window.location.href);
    if (redirectUrl.origin !== window.location.origin) return false;
    if (redirectUrl.pathname.startsWith("/login")) {
      return false;
    }

    if (redirectUrl.searchParams.get("error")) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function restoreFormData(entries: SerializedEntry[]) {
  const formData = new FormData();
  for (const entry of entries) {
    if ("kind" in entry && entry.kind === "file") {
      try {
        formData.append(entry.name, restoreFileEntry(entry));
      } catch {
        // Wenn ein einzelner Upload-Eintrag nicht korrekt wiederhergestellt werden kann, bleibt dieses Feld leer.
      }

      continue;
    }

    if (!("kind" in entry) || entry.kind === "text") {
      formData.append(entry.name, entry.value);
      continue;
    }

  }

  return formData;
}

export async function queueAction(actionName: string, formData: FormData) {
  const queue = await readQueue();
  const entries = await serializeFormData(formData);

  queue.push({
    id: crypto.randomUUID(),
    actionName,
    entries,
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

      const isSuccessfulResponse = response.ok || isRedirectErrorResponse(response);
      if (!isSuccessfulResponse) {
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
      void refreshQueuedCount().then(() => {
        if (navigator.onLine) {
          void flushQueue();
        }
      });
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
