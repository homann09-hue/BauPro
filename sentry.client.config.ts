import * as Sentry from "@sentry/nextjs";
import { sentryBaseConfig } from "@/lib/monitoring/sentry";

export function initSentryClient() {
  const options = sentryBaseConfig();
  if (!options.dsn) return;

  Sentry.init({
    ...options
  });
}
