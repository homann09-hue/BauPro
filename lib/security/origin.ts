function originOf(value?: string | null) {
  if (!value) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string) {
  try {
    const host = new URL(origin).hostname;
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

export function publicAppOrigin(requestOrigin?: string | null) {
  const configuredOrigin = originOf(process.env.NEXT_PUBLIC_APP_URL);
  if (configuredOrigin) return configuredOrigin;

  const safeRequestOrigin = originOf(requestOrigin);
  if (safeRequestOrigin && (process.env.NODE_ENV !== "production" || isLocalOrigin(safeRequestOrigin))) {
    return safeRequestOrigin;
  }

  return "http://localhost:3000";
}
