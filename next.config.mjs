import withPWAInit from "next-pwa";
import defaultRuntimeCaching from "next-pwa/cache.js";
import { withSentryConfig } from "@sentry/nextjs";

const runtimeCaching = [
  {
    urlPattern: ({ request, url }) =>
      request.mode === "navigate" &&
      ["/", "/dashboard", "/baustellen", "/time-tracking", "/berichte", "/material-melden"].includes(url.pathname),
    handler: "NetworkFirst",
    options: {
      cacheName: "baupro-app-shell-pages",
      networkTimeoutSeconds: 4,
      expiration: {
        maxEntries: 12,
        maxAgeSeconds: 24 * 60 * 60
      }
    }
  },
  ...defaultRuntimeCaching.map((entry) => {
    if (entry.options?.cacheName !== "apis") return entry;

    return {
      ...entry,
      handler: "NetworkOnly",
      options: {
        cacheName: "baupro-api-network-only"
      }
    };
  })
];

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  clientsClaim: true,
  fallbacks: {
    document: "/offline"
  },
  runtimeCaching,
  additionalManifestEntries: [
    { url: "/offline", revision: null },
    { url: "/manifest.json", revision: null },
    { url: "/icons/icon-192.png", revision: null },
    { url: "/icons/icon-512.png", revision: null },
    { url: "/icons/apple-touch-icon.png", revision: null }
  ]
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  env: {
    NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN || ""
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb"
    }
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" }
        ]
      }
    ];
  }
};

const configWithPWA = withPWA(nextConfig);
const sentryReleaseUploadConfigured = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

export default sentryReleaseUploadConfigured
  ? withSentryConfig(configWithPWA, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      telemetry: false,
      sourcemaps: {
        disable: false
      },
      webpack: {
        treeshake: {
          removeDebugLogging: true
        }
      }
    })
  : configWithPWA;
