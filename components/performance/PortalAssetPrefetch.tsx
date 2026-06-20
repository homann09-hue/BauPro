"use client";

import { useEffect } from "react";

function scheduleIdle(work: () => void) {
  const idleCallback = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 1 }), 350));
  idleCallback(work, { timeout: 1800 });
}

export function PortalAssetPrefetch({ urls }: { urls: string[] }) {
  useEffect(() => {
    const uniqueUrls = Array.from(new Set(urls.filter(Boolean))).slice(0, 12);
    if (uniqueUrls.length === 0) return;

    scheduleIdle(() => {
      for (const url of uniqueUrls) {
        const existing = Array.from(document.head.querySelectorAll('link[rel="prefetch"]')).some(
          (link) => link.getAttribute("href") === url
        );
        if (existing) continue;
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = url;
        link.as = /\.(png|jpe?g|webp|heic|heif)(\?|$)/i.test(url) ? "image" : "fetch";
        document.head.appendChild(link);
      }
    });
  }, [urls]);

  return null;
}
