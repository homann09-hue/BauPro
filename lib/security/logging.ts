type SafeLogMeta = Record<string, string | number | boolean | null | undefined>;

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_\-]{16,}/g,
  /sk-proj-[A-Za-z0-9_\-]{16,}/g,
  /sb_secret_[A-Za-z0-9_\-]{8,}/g,
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  /api[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9._\-]+/gi
];

function redact(value: string) {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[redacted]"), value);
}

function safeErrorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: redact(error.message).slice(0, 500)
    };
  }

  if (typeof error === "string") {
    return { name: "Error", message: redact(error).slice(0, 500) };
  }

  return { name: "UnknownError", message: "Unbekannter Fehler" };
}

export function logServerWarning(label: string, error: unknown, meta: SafeLogMeta = {}) {
  console.warn(label, { error: safeErrorDetails(error), ...meta });
}

export function logServerError(label: string, error: unknown, meta: SafeLogMeta = {}) {
  console.error(label, { error: safeErrorDetails(error), ...meta });
}
