export class SafeActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeActionError";
  }
}

export const DEFAULT_SAFE_ERROR_MESSAGE = "Aktion konnte nicht abgeschlossen werden. Bitte pruefe die Eingaben.";

export function safeErrorMessage(error: unknown, fallback = DEFAULT_SAFE_ERROR_MESSAGE) {
  if (error instanceof SafeActionError) return error.message;
  return fallback;
}

export function toQuery(value: string) {
  return encodeURIComponent(value);
}
