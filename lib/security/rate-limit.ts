import { SafeActionError } from "@/lib/security/errors";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    throw new SafeActionError("Zu viele Anfragen in kurzer Zeit. Bitte versuche es gleich erneut.");
  }

  current.count += 1;
}
