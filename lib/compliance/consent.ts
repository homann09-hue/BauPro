export const CONSENT_STORAGE_KEY = "baupro-consent-v1";
export const CONSENT_VERSION = "2026-06-15";

export type ConsentState = {
  version: string;
  essential: true;
  analytics: boolean;
  marketing: boolean;
  decidedAt: string;
};

export function defaultConsentState(now = new Date()) {
  return {
    version: CONSENT_VERSION,
    essential: true as const,
    analytics: false,
    marketing: false,
    decidedAt: now.toISOString()
  };
}

export function buildConsentState({
  analytics,
  marketing,
  now = new Date()
}: {
  analytics: boolean;
  marketing: boolean;
  now?: Date;
}): ConsentState {
  return {
    ...defaultConsentState(now),
    analytics,
    marketing
  };
}

export function parseConsentState(value: string | null): ConsentState | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<ConsentState>;
    if (parsed.version !== CONSENT_VERSION || parsed.essential !== true || typeof parsed.decidedAt !== "string") {
      return null;
    }

    return {
      version: CONSENT_VERSION,
      essential: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      decidedAt: parsed.decidedAt
    };
  } catch {
    return null;
  }
}
