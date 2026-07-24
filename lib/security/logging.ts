type SafeLogMeta = Record<string, string | number | boolean | null | undefined>;

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9_\-]{16,}/g,
  /sk-proj-[A-Za-z0-9_\-]{16,}/g,
  /sb_secret_[A-Za-z0-9_\-]{8,}/g,
  /sb_publishable_[A-Za-z0-9_\-]{8,}/g,
  /Bearer\s+[A-Za-z0-9._\-]+/gi,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /api[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9._\-]+/gi,
  /(portal_token|token|access_token|refresh_token|signature)=([^&\s]+)/gi,
  /data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g
];

const SENSITIVE_META_KEY = /(token|secret|password|api[_-]?key|authorization|cookie|signed_?url|signature_?data|data_?url|ciphertext)/i;

function redact(value: string) {
  return SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, "[redacted]"), value);
}

function safeMetaValue(key: string, value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return value;
  if (SENSITIVE_META_KEY.test(key)) return "[redacted]";
  if (typeof value === "string") return redact(value).slice(0, 500);
  return value;
}

function safeLogMeta(meta: SafeLogMeta) {
  return Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, safeMetaValue(key, value)]));
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
  console.warn(label, { error: safeErrorDetails(error), ...safeLogMeta(meta) });
}

export function logServerError(label: string, error: unknown, meta: SafeLogMeta = {}) {
  console.error(label, { error: safeErrorDetails(error), ...safeLogMeta(meta) });
}
