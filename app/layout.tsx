import type { Metadata } from "next";
import { ConsentBanner } from "@/components/consent-banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "BauPro",
  description: "Betriebssoftware fuer Dachdecker- und Handwerksbetriebe"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de">
      <body>
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
