import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ConsentBanner } from "@/components/consent-banner";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "BauPro",
  title: {
    default: "BauPro",
    template: "%s | BauPro"
  },
  description: "Betriebssoftware für Dachdecker- und Handwerksbetriebe",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "BauPro",
    statusBarStyle: "black-translucent"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }]
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "BauPro",
    "msapplication-TileColor": "#2E7D32"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2E7D32",
  colorScheme: "light"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="de">
      <body data-nonce-present={nonce ? "true" : undefined}>
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
