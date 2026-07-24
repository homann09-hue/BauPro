export function safeReturnPath(value: FormDataEntryValue | string | null | undefined, fallback = "/dashboard") {
  const path = String(value ?? "").trim();
  const lowerPath = path.toLowerCase();
  const lowerPathname = lowerPath.split(/[?#]/)[0] ?? "";

  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("://") ||
    /[\u0000-\u001f\u007f\\]/.test(path) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i.test(lowerPath) ||
    /%(?:2f|5c)/i.test(lowerPathname)
  ) {
    return fallback;
  }

  return path;
}

export function withStatusMessage(path: string, type: "success" | "error", message: string) {
  const safePath = safeReturnPath(path);
  const separator = safePath.includes("?") ? "&" : "?";
  return `${safePath}${separator}${type}=${encodeURIComponent(message)}`;
}
