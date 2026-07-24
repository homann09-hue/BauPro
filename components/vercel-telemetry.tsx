"use client";

import dynamic from "next/dynamic";

const Analytics = dynamic(() => import("@vercel/analytics/next").then((mod) => mod.Analytics), { ssr: false });
const SpeedInsights = dynamic(() => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights), { ssr: false });

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function VercelTelemetry() {
  if (typeof window === "undefined") return null;
  if (isLocalHost(window.location.hostname)) return null;

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  );
}
