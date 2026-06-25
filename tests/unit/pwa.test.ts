import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function read(file: string) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

describe("installable PWA", () => {
  it("ships an installable manifest for iPhone and Android", () => {
    const manifest = JSON.parse(read("public/manifest.json")) as {
      name: string;
      short_name: string;
      start_url: string;
      scope: string;
      display: string;
      theme_color: string;
      background_color: string;
      icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
      shortcuts?: Array<{ url: string }>;
    };

    expect(manifest.name).toContain("BauPro");
    expect(manifest.short_name).toBe("BauPro");
    expect(manifest.start_url).toContain("/dashboard");
    expect(manifest.scope).toBe("/");
    expect(manifest.display).toBe("standalone");
    expect(manifest.theme_color).toBe("#111110");
    expect(manifest.background_color).toBe("#111110");
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }),
        expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }),
        expect.objectContaining({ src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" })
      ])
    );
    expect(manifest.shortcuts?.map((shortcut) => shortcut.url)).toEqual(
      expect.arrayContaining(["/time-tracking/new?source=pwa-shortcut", "/berichte/neu?source=pwa-shortcut"])
    );
  });

  it("has actual PNG icon files for mobile install surfaces", () => {
    for (const file of [
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/maskable-512.png",
      "public/icons/apple-touch-icon.png"
    ]) {
      const buffer = fs.readFileSync(path.join(root, file));
      expect(buffer.subarray(0, 8).toString("hex"), file).toBe("89504e470d0a1a0a");
      expect(buffer.length, file).toBeGreaterThan(1000);
    }
  });

  it("configures offline fallback and avoids caching live API responses", () => {
    const config = read("next.config.mjs");
    expect(config).toContain("fallbacks");
    expect(config).toContain('document: "/offline"');
    expect(config).toContain('handler: "NetworkOnly"');
    expect(config).toContain("baupro-api-network-only");
    expect(config).toContain('{ url: "/offline", revision: null }');
    expect(config).toContain('handler: "NetworkFirst"');
    expect(config).toContain("baupro-app-shell-pages");
    expect(config).toContain("networkTimeoutSeconds");
    expect(config).toContain("Die öffentliche Startseite darf nicht aus einem alten PWA-Runtime-Cache kommen");
    expect(config).toContain("cacheStartUrl: false");
    expect(config).toContain("dynamicStartUrl: false");
    expect(config).not.toContain('["/", "/dashboard"');
    expect(config).not.toContain('{ url: "/dashboard", revision: null }');
    expect(config).not.toContain('{ url: "/baustellen", revision: null }');
    expect(config).not.toContain('{ url: "/berichte", revision: null }');
  });

  it("sets Apple PWA metadata and safe-area handling", () => {
    const layout = read("app/layout.tsx");
    const css = read("app/globals.css");
    const appShell = read("components/app-shell.tsx");
    const offlinePage = read("app/offline/page.tsx");

    expect(layout).toContain("appleWebApp");
    expect(layout).toContain("viewportFit");
    expect(layout).toContain("/icons/apple-touch-icon.png");
    expect(css).toContain("display-mode: standalone");
    expect(css).toContain("safe-area-inset-top");
    expect(appShell).toContain("safe-area-inset-bottom");
    expect(offlinePage).toContain("Offline-Modus");
  });

  it("renders Vercel telemetry only on Vercel to avoid local 404 console noise", () => {
    const layout = read("app/layout.tsx");
    const telemetry = read("components/vercel-telemetry.tsx");

    expect(layout).toContain("<VercelTelemetry />");
    expect(layout).not.toContain('@vercel/analytics/next');
    expect(layout).not.toContain('@vercel/speed-insights/next');
    expect(telemetry).toContain('"use client"');
    expect(telemetry).toContain("window.location.hostname");
    expect(telemetry).toContain('hostname === "localhost"');
    expect(telemetry).toContain("<Analytics />");
    expect(telemetry).toContain("<SpeedInsights />");
  });
});
