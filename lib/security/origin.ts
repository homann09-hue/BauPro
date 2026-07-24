export function originOf(value?: string | null) {
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

  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

function validIpv4(value: string) {
  const parts = value.split(".");
  return (
    parts.length === 4 &&
    parts.every((part) => {
      if (!/^\d{1,3}$/.test(part)) return false;
      const octet = Number(part);
      return octet >= 0 && octet <= 255 && String(octet) === String(Number(part));
    })
  );
}

function validIpv6(value: string) {
  if (!value.includes(":") || value.length > 45 || !/^[0-9a-f:.]+$/i.test(value)) return false;

  const compressionCount = value.match(/::/g)?.length ?? 0;
  if (compressionCount > 1) return false;

  const compressed = compressionCount === 1;
  const parts = value.split(":");
  if (!compressed && parts.some((part) => part === "")) return false;

  const groups = parts.filter(Boolean);
  if (groups.length === 0) return compressed;

  let groupCount = 0;
  for (const group of groups) {
    if (validIpv4(group)) {
      groupCount += 2;
      continue;
    }
    if (!/^[0-9a-f]{1,4}$/i.test(group)) return false;
    groupCount += 1;
  }

  return compressed ? groupCount < 8 : groupCount === 8;
}

function normalizeClientIp(value?: string | null) {
  if (!value) return null;

  const trimmed = value.trim();
  const unbracketed = trimmed.startsWith("[") && trimmed.endsWith("]") ? trimmed.slice(1, -1) : trimmed;
  if (!unbracketed || unbracketed.length > 64) return null;

  if (validIpv4(unbracketed)) return unbracketed;
  if (validIpv6(unbracketed)) return unbracketed.toLowerCase();

  return null;
}

function firstValidIp(headerValue: string | null) {
  if (!headerValue) return null;

  for (const part of headerValue.split(",")) {
    const normalized = normalizeClientIp(part);
    if (normalized) return normalized;
  }

  return null;
}

export function getClientIp(headers: Headers) {
  const vercelForwardedFor = firstValidIp(headers.get("x-vercel-forwarded-for"));
  if (vercelForwardedFor) return vercelForwardedFor;

  const forwardedFor = firstValidIp(headers.get("x-forwarded-for"));
  if (forwardedFor) return forwardedFor;

  const realIp = normalizeClientIp(headers.get("x-real-ip"));
  if (realIp) return realIp;

  const cloudflareIp = normalizeClientIp(headers.get("cf-connecting-ip"));
  if (cloudflareIp) return cloudflareIp;

  return "unknown";
}
