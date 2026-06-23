import { captureActionException } from "@/lib/monitoring/sentry";
import { isMissingSchemaError } from "@/lib/supabase/errors";

export class SafeActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeActionError";
  }
}

export const DEFAULT_SAFE_ERROR_MESSAGE = "Aktion konnte nicht abgeschlossen werden. Bitte prüfe die Eingaben.";

export function safeErrorMessage(error: unknown, fallback = DEFAULT_SAFE_ERROR_MESSAGE) {
  if (error instanceof SafeActionError) return error.message;
  captureActionException(error);
  return fallback;
}

export function safeQueryErrorMessage(
  error:
    | {
        code?: string | null;
        message?: string | null;
        details?: string | null;
        hint?: string | null;
      }
    | null
    | undefined,
  fallback = "Daten konnten nicht geladen werden."
) {
  if (!error) return null;

  const text = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" ");
  if (isMissingSchemaError(error)) {
    if (text.includes("weather_summary") || text.includes("weather_temperature_c") || text.includes("weather_precipitation_mm")) {
      return "Datenbank-Update fehlt: Bitte `supabase/migrations/20260616_weather_fields.sql` oder die Sammel-Migration `supabase/migrations/20260621_schema_gap_fix.sql` ausführen.";
    }

    if (text.includes("archived_at")) {
      return "Datenbank-Update fehlt: Bitte `supabase/migrations/20260615_saas_hardening.sql` oder die Sammel-Migration `supabase/migrations/20260621_schema_gap_fix.sql` ausführen.";
    }

    return "Datenbank-Update fehlt. Bitte die aktuellen Supabase-Migrationen ausführen.";
  }

  return fallback;
}

export function toQuery(value: string) {
  return encodeURIComponent(value);
}
