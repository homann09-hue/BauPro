"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ShieldCheck, X } from "lucide-react";

const DISMISS_KEY = "baupro:mfa-recommendation-dismissed";

type MfaRecommendationBannerProps = {
  canManage: boolean;
  mfaEnabled: boolean;
};

export function MfaRecommendationBanner({ canManage, mfaEnabled }: MfaRecommendationBannerProps) {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDismissed(window.localStorage.getItem(DISMISS_KEY) === "true");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  if (!canManage || mfaEnabled || dismissed) return null;

  function dismiss() {
    window.localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  return (
    <section className="mb-4 rounded-lg border border-moss/20 bg-mint p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-moss">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-primary-dark">Schütze deinen Account zusätzlich mit Zwei-Faktor-Authentifizierung.</p>
          <p className="mt-1 text-sm leading-6 text-primary-dark/80">
            Besonders Systemadmin-Zugänge sollten neben dem Passwort einen Authenticator-Code nutzen.
          </p>
          <Link href="/settings/security" className="mt-3 inline-flex text-sm font-black text-moss hover:text-primary-dark">
            2FA einrichten
          </Link>
        </div>
        <button
          aria-label="2FA-Hinweis ausblenden"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-moss/20 bg-white text-moss hover:bg-mint"
          onClick={dismiss}
          type="button"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
