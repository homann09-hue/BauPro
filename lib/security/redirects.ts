export function safeReturnPath(value: FormDataEntryValue | string | null | undefined, fallback = "/dashboard") {
  const path = String(value ?? "").trim();

  if (!path.startsWith("/") || path.startsWith("//") || path.includes("://")) {
    return fallback;
  }

  return path;
}

export function withStatusMessage(path: string, type: "success" | "error", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${type}=${encodeURIComponent(message)}`;
}
