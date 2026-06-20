import * as Sentry from "@sentry/nextjs";

const SENTRY_TAGS = {
  app: "baupro",
  region: "de"
} as const;

export function isSafeActionError(error: unknown) {
  return error instanceof Error && error.name === "SafeActionError";
}

export function sentryBeforeSend(event: Sentry.ErrorEvent, hint: Sentry.EventHint) {
  if (isSafeActionError(hint.originalException)) {
    return null;
  }

  event.tags = {
    ...event.tags,
    ...SENTRY_TAGS
  };

  return event;
}

export function sentryBaseConfig() {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    tracesSampleRate: isProduction ? 0.1 : 0,
    beforeSend: sentryBeforeSend,
    initialScope: {
      tags: SENTRY_TAGS
    }
  };
}

export function captureActionException(error: unknown, actionName?: string) {
  if (isSafeActionError(error)) return;
  if (process.env.NODE_ENV === "test") return;

  Sentry.withScope((scope) => {
    scope.setTag("app", SENTRY_TAGS.app);
    scope.setTag("region", SENTRY_TAGS.region);
    if (actionName) scope.setTag("server_action", actionName);
    Sentry.captureException(error);
  });
}
